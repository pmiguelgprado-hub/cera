// CERA — capa de UI. El cálculo vive en calculo.js; aquí solo se lee el
// formulario, se pinta el resultado y se prepara el informe imprimible.

import { CONFIG, calcular } from './calculo.js';

const $ = (id) => document.getElementById(id);

const form = $('formulario');
const resultados = $('resultados');
const btnImprimir = $('imprimir');

const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const ETIQUETAS = {
  consumoAnualKwh: ['Consumo eléctrico anual', 'kWh/año'],
  potenciaContratadaKw: ['Potencia contratada', 'kW'],
  superficieM2: ['Superficie disponible', 'm²'],
  tipoSuperficie: ['Tipo de superficie', ''],
  participantes: ['Participantes', ''],
  precioElectricidad: ['Precio medio de electricidad', 'EUR/kWh'],
  escenario: ['Escenario', ''],
};

const TIPOS = {
  cubierta: 'Cubierta o tejado',
  suelo: 'Suelo agrario (agrivoltaica)',
  aparcamiento: 'Aparcamiento (marquesina)',
};

function leerFormulario() {
  const fd = new FormData(form);
  // Acepta coma o punto decimal: "0,18" y "0.18" valen igual.
  const num = (k) => parseFloat(String(fd.get(k)).trim().replace(',', '.'));
  return {
    consumoAnualKwh: num('consumoAnualKwh'),
    potenciaContratadaKw: num('potenciaContratadaKw'),
    superficieM2: num('superficieM2'),
    tipoSuperficie: fd.get('tipoSuperficie'),
    participantes: num('participantes'),
    precioElectricidad: num('precioElectricidad'),
    escenario: fd.get('escenario'),
  };
}

function pintarErrores(errores) {
  for (const campo of Object.keys(ETIQUETAS)) {
    const errorEl = $(`error-${campo}`);
    const campoEl = $(campo)?.closest('.campo');
    const mensaje = errores[campo];
    if (errorEl) {
      errorEl.textContent = mensaje ?? '';
      errorEl.hidden = !mensaje;
    }
    campoEl?.classList.toggle('invalido', Boolean(mensaje));
  }
}

// Cuenta ascendente al revelar una cifra; salta al valor final si el usuario
// prefiere movimiento reducido.
const REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)');

function animarCifra(id, valor, formateador, animar = true) {
  const el = $(id);
  if (!animar || REDUCIR.matches || !Number.isFinite(valor)) {
    el.textContent = Number.isFinite(valor) ? formateador.format(valor) : '—';
    return;
  }
  const duracion = 550;
  const inicio = performance.now();
  const paso = (ahora) => {
    const t = Math.min((ahora - inicio) / duracion, 1);
    const suavizado = 1 - (1 - t) ** 3;
    el.textContent = formateador.format(valor * suavizado);
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pintarResultado(r, datos, animar = true) {
  const veredicto = $('veredicto');
  veredicto.className = `veredicto ${r.semaforo.nivel}`;
  $('veredicto-texto').textContent = r.semaforo.veredicto;

  animarCifra('r-potencia', r.potenciaKwp, fmt1, animar);
  animarCifra('r-produccion', r.produccionAnualKwh, fmt, animar);
  animarCifra('r-ahorro', r.ahorroAnualEur, fmt, animar);
  animarCifra('r-co2', r.co2EvitadoKg, fmt, animar);
  animarCifra('r-cobertura', r.coberturaConsumo * 100, fmt, animar);
  animarCifra('r-payback', r.paybackAnios, fmt1, animar);

  const filaReparto = $('fila-reparto');
  filaReparto.hidden = datos.participantes < 2;
  animarCifra('r-reparto', r.ahorroPorParticipanteEur, fmt, animar);

  pintarGrafico(r, datos);

  const avisos = $('avisos');
  avisos.replaceChildren(
    ...r.avisos.map((texto) => {
      const li = document.createElement('li');
      li.textContent = texto;
      return li;
    })
  );

  pintarHipotesis(datos);
  pintarEntradasImpresion(datos);

  resultados.hidden = false;
  btnImprimir.disabled = false;
}

// Gráfico de barras horizontales: a dónde va la energía (kWh/año).
// El ancho de cada barra es el porcentaje sobre el consumo anual introducido,
// acotado visualmente a 0–100 %.
function pintarGrafico(r, datos) {
  const noCubierto = Math.max(datos.consumoAnualKwh - r.autoconsumoKwh, 0);
  const series = [
    ['autoconsumo', r.autoconsumoKwh],
    ['excedentes', r.excedentesKwh],
    ['no-cubierto', noCubierto],
  ];
  const partes = [];
  for (const [clave, valor] of series) {
    const pct = (valor / datos.consumoAnualKwh) * 100;
    const pctVisual = Math.min(Math.max(pct, 0), 100);
    $(`barra-${clave}`).style.width = `${pctVisual}%`;
    $(`valor-${clave}`).textContent =
      `${fmt.format(valor)} kWh · ${fmt.format(pct)} %`;
    partes.push(`${fmt.format(valor)} kWh (${fmt.format(pct)} % del consumo)`);
  }
  $('nota-excedentes').hidden = !(r.produccionAnualKwh > datos.consumoAnualKwh);
  $('grafico').setAttribute(
    'aria-label',
    `Destino de la energía respecto al consumo anual: autoconsumo ${partes[0]}, ` +
      `excedentes a red ${partes[1]}, consumo no cubierto ${partes[2]}.`
  );
}

function pintarHipotesis(datos) {
  const rendimiento = CONFIG.rendimiento[datos.escenario];
  const hipotesis = [
    `Superficie necesaria por kWp instalado: ${fmt1.format(CONFIG.m2PorKwp)} m²/kWp.`,
    `Rendimiento específico del escenario ${datos.escenario}: ${fmt.format(rendimiento)} kWh/kWp y año.`,
    `Fracción de la producción autoconsumida de forma simultánea: ${fmt.format(CONFIG.fraccionAutoconsumo * 100)} %.`,
    `Compensación simplificada de excedentes: ${CONFIG.precioExcedentes.toLocaleString('es-ES')} EUR/kWh.`,
    `Factor de emisiones evitadas: ${CONFIG.factorCo2.toLocaleString('es-ES')} kg CO₂/kWh.`,
    `Coste orientativo llave en mano para el retorno: ${fmt.format(CONFIG.capexPorKwp)} EUR/kWp.`,
    `Semáforo: verde si el retorno simple es menor de ${CONFIG.paybackVerde} años; ámbar hasta ${CONFIG.paybackAmbar}; rojo por encima o con menos de ${CONFIG.potenciaMinima} kWp.`,
    'La potencia recomendada es la menor entre la que cabe en la superficie y la que dimensiona el consumo anual.',
    'No se consideran sombras, orientación, inclinación, curva horaria real ni tramitación administrativa.',
  ];
  $('lista-hipotesis').replaceChildren(
    ...hipotesis.map((texto) => {
      const li = document.createElement('li');
      li.textContent = texto;
      return li;
    })
  );
}

function pintarEntradasImpresion(datos) {
  const valores = {
    consumoAnualKwh: fmt.format(datos.consumoAnualKwh),
    potenciaContratadaKw: fmt1.format(datos.potenciaContratadaKw),
    superficieM2: fmt.format(datos.superficieM2),
    tipoSuperficie: TIPOS[datos.tipoSuperficie],
    participantes: fmt.format(datos.participantes),
    precioElectricidad: datos.precioElectricidad.toLocaleString('es-ES'),
    escenario: datos.escenario,
  };
  $('print-entradas').replaceChildren(
    ...Object.entries(ETIQUETAS).map(([campo, [etiqueta, unidad]]) => {
      const div = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = etiqueta;
      const dd = document.createElement('dd');
      dd.textContent = unidad ? `${valores[campo]} ${unidad}` : valores[campo];
      div.append(dt, dd);
      return div;
    })
  );
}

// Tras el primer cálculo válido, el panel se vuelve reactivo: cualquier
// cambio válido en el formulario recalcula al instante, sin animación.
let dashboardActivo = false;

function ejecutar({ animar, desplazar }) {
  const datos = leerFormulario();
  const r = calcular(datos);
  if (!r.ok) {
    pintarErrores(r.errores);
    if (!dashboardActivo) {
      resultados.hidden = true;
      btnImprimir.disabled = true;
    }
    return;
  }
  pintarErrores({});
  pintarResultado(r, datos, animar);
  if (!dashboardActivo) {
    dashboardActivo = true;
    $('nota-reactiva').hidden = false;
  }
  if (desplazar && window.matchMedia('(max-width: 959px)').matches) {
    resultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  ejecutar({ animar: true, desplazar: true });
});

let temporizador;
form.addEventListener('input', () => {
  if (!dashboardActivo) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => ejecutar({ animar: false, desplazar: false }), 150);
});

// Caso demostrativo: precarga los datos simulados de la ganadería El Cierru.
const CASO_GANADERIA = {
  consumoAnualKwh: '30000',
  potenciaContratadaKw: '20',
  superficieM2: '120',
  tipoSuperficie: 'cubierta',
  participantes: '4',
  precioElectricidad: '0,17',
};

function cargarCaso() {
  for (const [campo, valor] of Object.entries(CASO_GANADERIA)) {
    $(campo).value = valor;
  }
  form.querySelector('input[name="escenario"][value="central"]').checked = true;
  ejecutar({ animar: true, desplazar: false });
  document.getElementById('calculadora').scrollIntoView({
    behavior: REDUCIR.matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

$('cargar-caso')?.addEventListener('click', cargarCaso);

if (new URLSearchParams(window.location.search).get('caso') === 'ganaderia') {
  cargarCaso();
}

// PWA: la app funciona sin cobertura una vez visitada.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

btnImprimir.addEventListener('click', () => {
  $('hipotesis').open = true;
  window.print();
});

$('fecha-informe').textContent = new Date().toLocaleDateString('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
