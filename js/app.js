// CERA — capa de UI. El cálculo vive en calculo.js; aquí solo se lee el
// formulario, se pinta el resultado y se prepara el informe imprimible.

import { CONFIG, calcular, validar } from './calculo.js';

const $ = (id) => document.getElementById(id);

const form = $('formulario');
const resultados = $('resultados');
const btnImprimir = $('imprimir');

// useGrouping 'always': es-ES no separa los miles en números de 4 cifras
// ("2549"), pero el informe debe leerse igual que el resto de cifras ("2.549").
const fmt = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  useGrouping: 'always',
});
const fmt1 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: 'always',
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
  animarEl($(id), valor, formateador, animar);
}

function animarEl(el, valor, formateador, animar = true) {
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

// El semáforo emite un pulso único cuando cambia de nivel: feedback visible
// sin ser decorativo.
let nivelAnterior = null;

function pintarResultado(r, datos, animar = true) {
  const veredicto = $('veredicto');
  veredicto.className = `veredicto ${r.semaforo.nivel}`;
  $('veredicto-texto').textContent = r.semaforo.veredicto;
  if (nivelAnterior && nivelAnterior !== r.semaforo.nivel && !REDUCIR.matches) {
    const punto = veredicto.querySelector('.punto');
    punto.classList.remove('pulso');
    void punto.offsetWidth;
    punto.classList.add('pulso');
  }
  nivelAnterior = r.semaforo.nivel;

  // El caso es del usuario: el resumen se construye con sus propios datos.
  $('resumen-caso').textContent =
    `${TIPOS[datos.tipoSuperficie]} de ${fmt.format(datos.superficieM2)} m² · ` +
    `${fmt.format(datos.consumoAnualKwh)} kWh/año · escenario ${datos.escenario}` +
    (datos.participantes >= 2 ? ` · ${fmt.format(datos.participantes)} participantes` : '');

  animarCifra('r-potencia', r.potenciaKwp, fmt1, animar);
  animarCifra('r-produccion', r.produccionAnualKwh, fmt, animar);
  animarCifra('r-ahorro', r.ahorroAnualEur, fmt, animar);
  animarCifra('r-co2', r.co2EvitadoKg, fmt, animar);
  animarCifra('r-cobertura', r.coberturaConsumo * 100, fmt, animar);
  animarCifra('r-payback', r.paybackAnios, fmt1, animar);
  animarCifra('r-inversion', r.capexEur, fmt, animar);
  animarCifra('r-ahorro25', r.ahorroAnualEur * 25, fmt, animar);

  // Coste de no actuar: solo cuando el proyecto tiene recorrido (verde/ámbar).
  const notaPerdida = $('nota-perdida');
  if (r.semaforo.nivel === 'rojo') {
    notaPerdida.hidden = true;
  } else {
    notaPerdida.hidden = false;
    notaPerdida.textContent =
      `Cada año sin instalación deja sin aprovechar unos ` +
      `${fmt.format(r.ahorroAnualEur)} EUR de ahorro.`;
  }

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
    'Ahorro acumulado a 25 años: ahorro anual × 25, sin degradación, inflación ni costes de mantenimiento.',
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

// Reciprocidad: la página entrega un resultado desde el primer segundo,
// calculado con los datos precargados; el usuario ajusta y ve su caso.
if (new URLSearchParams(window.location.search).get('caso') === 'ganaderia') {
  cargarCaso();
} else {
  ejecutar({ animar: true, desplazar: false });
}

// Confirmación sutil al salir de un campo válido (feedback sin ruido).
form.addEventListener('focusout', (evento) => {
  const control = evento.target;
  if (!control.matches?.('input[type="number"], input[type="text"], select')) return;
  if (control.value === '' || validar(leerFormulario())[control.name]) return;
  control.classList.remove('confirmado');
  void control.offsetWidth;
  control.classList.add('confirmado');
});

// Las métricas del hero cuentan al cargar, una sola vez.
for (const el of document.querySelectorAll('.hero-metricas strong[data-cifra]')) {
  animarEl(el, parseFloat(el.dataset.cifra), el.dataset.dec === '1' ? fmt1 : fmt);
}

// Cómo funciona: mapa interactivo sobre la ilustración del pueblo.
// Cada punto es un paso; el panel lateral muestra su explicación.
const PASOS_MAPA = [
  {
    titulo: 'Introduce siete datos',
    texto:
      'Consumo anual, potencia contratada, superficie, tipo de superficie, ' +
      'participantes, precio de la electricidad y escenario de producción. ' +
      'Valen datos aproximados.',
  },
  {
    titulo: 'Revisa el diagnóstico',
    texto:
      'Potencia recomendada, producción, ahorro, emisiones evitadas y retorno ' +
      'simple, con semáforo de viabilidad y avisos según tu caso. Todo se ' +
      'recalcula al instante al cambiar un dato.',
  },
  {
    titulo: 'Contrasta las hipótesis',
    texto:
      'Cada resultado publica las hipótesis exactas del cálculo. El informe ' +
      'imprimible las incluye para que un técnico pueda validarlas o ' +
      'corregirlas en el estudio profesional.',
  },
];

const puntosMapa = document.querySelectorAll('.punto-mapa');
const panelMapa = document.querySelector('.mapa-panel');

function mostrarPaso(indice) {
  const paso = PASOS_MAPA[indice];
  $('mapa-paso').textContent = `Paso ${indice + 1} de 3`;
  $('mapa-titulo').textContent = paso.titulo;
  $('mapa-texto').textContent = paso.texto;
  for (const punto of puntosMapa) {
    punto.classList.toggle('activo', Number(punto.dataset.paso) === indice);
  }
  if (!REDUCIR.matches) {
    panelMapa.classList.remove('cambia');
    void panelMapa.offsetWidth;
    panelMapa.classList.add('cambia');
  }
}

for (const punto of puntosMapa) {
  punto.addEventListener('click', () => mostrarPaso(Number(punto.dataset.paso)));
}

// Revelado al hacer scroll de las bandas informativas (una sola vez por
// elemento; sin JS o con movimiento reducido, todo queda visible).
if (!REDUCIR.matches && 'IntersectionObserver' in window) {
  const objetivos = document.querySelectorAll('.banda h2, .banda-sub, .mapa, .caso-datos, .caso-lectura');
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.classList.add('visible');
      observador.unobserve(entrada.target);
    }
  }, { threshold: 0.2 });
  for (const el of objetivos) {
    el.classList.add('revela');
    observador.observe(el);
  }
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
