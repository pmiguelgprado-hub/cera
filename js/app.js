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

  // Espejo en directo del hero: refleja el caso actual del usuario, no un
  // ejemplo fijo. Se rellena en la primera ejecución (al cargar) y en cada
  // recálculo reactivo.
  animarCifra('hero-ahorro', r.ahorroAnualEur, fmt, animar);
  animarCifra('hero-produccion', r.produccionAnualKwh, fmt, animar);
  animarCifra('hero-potencia', r.potenciaKwp, fmt1, animar);

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
  pintarRetorno(r);

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

// Línea de retorno: cuándo se recupera la inversión dentro de la vida útil.
// Tramo ámbar = años amortizando; tramo verde = años de beneficio neto.
const VIDA_UTIL = 25;

function pintarRetorno(r) {
  const figura = $('linea-retorno');
  if (!Number.isFinite(r.paybackAnios)) {
    figura.hidden = true;
    return;
  }
  figura.hidden = false;
  const pct = Math.min(r.paybackAnios / VIDA_UTIL, 1) * 100;
  $('lr-pendiente').style.width = `${pct}%`;
  $('lr-beneficio').style.width = `${100 - pct}%`;
  $('lr-marca').style.left = `${pct}%`;
  $('lr-marca').classList.toggle('fuera', r.paybackAnios > VIDA_UTIL);
  $('lr-anio').textContent =
    r.paybackAnios > VIDA_UTIL ? '+25 años' : `${fmt1.format(r.paybackAnios)} años`;
  $('lr-lectura').textContent =
    r.paybackAnios > VIDA_UTIL
      ? 'Con estas hipótesis la inversión no se recupera dentro de la vida útil.'
      : `Inversión recuperada en ${fmt1.format(r.paybackAnios)} años; ` +
        `${fmt1.format(VIDA_UTIL - r.paybackAnios)} años restantes de ahorro neto.`;
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

// Cómo funciona: mapa interactivo sobre la ilustración del pueblo.
// Los tres pasos están siempre visibles en la lista lateral (lo oculto no se
// lee); punto e ítem se resaltan en espejo.
const puntosMapa = document.querySelectorAll('.punto-mapa');
const itemsPaso = document.querySelectorAll('.mapa-paso-item');

function mostrarPaso(indice) {
  for (const punto of puntosMapa) {
    punto.classList.toggle('activo', Number(punto.dataset.paso) === indice);
  }
  itemsPaso.forEach((item, i) => item.classList.toggle('activo', i === indice));
}

for (const punto of puntosMapa) {
  punto.addEventListener('click', () => mostrarPaso(Number(punto.dataset.paso)));
}

for (const boton of document.querySelectorAll('.mapa-paso-item button')) {
  boton.addEventListener('click', () => mostrarPaso(Number(boton.dataset.paso)));
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

// Recurso solar de Asturias: mapa coroplético estilo panel de datos.
// E_y = producción anual por kWp (PVGIS v5.2, pérdidas 14 %, inclinación
// óptima). Cada concejo toma el punto de medida más cercano (8 puntos).
// El rendimiento central de CERA (CONFIG.rendimiento.central) sirve de
// referencia para el contraste por zona.
const ZONAS = [
  { id: 0, nombre: 'Occidente costero', punto: 'Vegadeo', ey: 1112, angulo: 36,
    concejos: 'Castropol, Vegadeo, Tapia, Navia, Coaña, los Oscos y su entorno' },
  { id: 1, nombre: 'Suroccidente (Narcea)', punto: 'Cangas del Narcea', ey: 1243, angulo: 35,
    concejos: 'Cangas del Narcea, Tineo, Allande, Ibias, Degaña, Somiedo, Valdés' },
  { id: 2, nombre: 'Avilés y bajo Nalón', punto: 'Avilés', ey: 1210, angulo: 38,
    concejos: 'Avilés, Castrillón, Gozón, Corvera, Pravia, Cudillero, Salas' },
  { id: 3, nombre: 'Centro (Oviedo)', punto: 'Oviedo', ey: 1182, angulo: 39,
    concejos: 'Oviedo, Llanera, Grado, Las Regueras, Proaza y valles centrales' },
  { id: 4, nombre: 'Gijón y Cabo Peñas', punto: 'Gijón', ey: 1201, angulo: 37,
    concejos: 'Gijón, Carreño, Villaviciosa, Colunga, Cabranes' },
  { id: 5, nombre: 'Cuencas del Caudal', punto: 'Mieres', ey: 1125, angulo: 35,
    concejos: 'Mieres, Lena, Aller, Morcín, Riosa, Quirós, Teverga' },
  { id: 6, nombre: 'Cuencas del Nalón', punto: 'Langreo', ey: 1143, angulo: 37,
    concejos: 'Langreo, San Martín del Rey Aurelio, Laviana, Siero, Piloña, Nava' },
  { id: 7, nombre: 'Oriente', punto: 'Llanes', ey: 1115, angulo: 38,
    concejos: 'Llanes, Ribadesella, Cangas de Onís, Cabrales, Parres, los Picos' },
];
const REFERENCIA_CENTRAL = CONFIG.rendimiento.central; // 1050 kWh/kWp

// El epígrafe del panel muestra el concejo concreto sobre el que se apunta;
// si no hay uno (arranque), rotula la zona.
const rpEyebrow = document.querySelector('.rp-eyebrow');

function seleccionarZona(id, concejo) {
  const z = ZONAS[id];
  if (!z) return;
  if (rpEyebrow) rpEyebrow.textContent = concejo ? `Concejo de ${concejo}` : 'Zona seleccionada';
  $('rp-nombre').textContent = z.nombre;
  animarEl($('rp-ey'), z.ey, fmt, false);
  $('rp-punto').textContent = z.punto;
  $('rp-angulo').textContent = `${z.angulo}°`;
  const vs = Math.round(((z.ey - REFERENCIA_CENTRAL) / REFERENCIA_CENTRAL) * 100);
  $('rp-vs').textContent = `${vs >= 0 ? '+' : ''}${vs} %`;
  $('rp-concejos').textContent = `Incluye ${z.concejos}.`;
  const svg = document.querySelector('#mapa-recurso svg');
  if (svg) {
    for (const p of svg.querySelectorAll('path')) {
      p.classList.toggle('zona-activa', Number(p.dataset.zona) === id);
    }
  }
}

// El nombre del concejo va en el <title> del path: "Allande · Zona: 1243…".
function concejoDe(path) {
  const t = path.querySelector('title')?.textContent ?? '';
  return t.split('·')[0].trim() || undefined;
}

async function montarMapa() {
  const cont = $('mapa-recurso');
  if (!cont) return;
  try {
    const svgTexto = await fetch('assets/mapa-asturias.svg').then((r) => r.text());
    // Asset propio y estático, pero se parsea con DOMParser (no innerHTML):
    // construye nodos SVG sin ejecutar scripts embebidos.
    const doc = new DOMParser().parseFromString(svgTexto, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) throw new Error('svg no válido');
    svg.removeAttribute('aria-hidden');
    cont.replaceChildren(document.importNode(svg, true));
    const svgVivo = cont.querySelector('svg');
    for (const p of svgVivo.querySelectorAll('path')) {
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      const zi = Number(p.dataset.zona);
      const concejo = concejoDe(p);
      p.addEventListener('click', () => seleccionarZona(zi, concejo));
      p.addEventListener('mouseenter', () => seleccionarZona(zi, concejo));
      p.addEventListener('focus', () => seleccionarZona(zi, concejo));
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleccionarZona(zi, concejo); }
      });
    }
    seleccionarZona(1); // arranca en la zona de mayor recurso
  } catch {
    cont.closest('#recurso')?.setAttribute('hidden', '');
  }
}

montarMapa();

// PWA: la app funciona sin cobertura una vez visitada.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

btnImprimir.addEventListener('click', () => {
  $('hipotesis').open = true;
  window.print();
});

// También al imprimir con Cmd/Ctrl+P: el informe siempre publica sus hipótesis.
window.addEventListener('beforeprint', () => {
  $('hipotesis').open = true;
});

const fechaHoy = new Date().toLocaleDateString('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
for (const el of document.querySelectorAll('.fecha-doc')) el.textContent = fechaHoy;
