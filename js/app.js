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

function pintarResultado(r, datos) {
  const veredicto = $('veredicto');
  veredicto.className = `veredicto ${r.semaforo.nivel}`;
  $('veredicto-texto').textContent = r.semaforo.veredicto;

  $('r-potencia').textContent = fmt1.format(r.potenciaKwp);
  $('r-produccion').textContent = fmt.format(r.produccionAnualKwh);
  $('r-autoconsumo').textContent = fmt.format(r.autoconsumoKwh);
  $('r-cobertura').textContent = fmt.format(r.coberturaConsumo * 100);
  $('r-excedentes').textContent = fmt.format(r.excedentesKwh);
  $('r-ahorro').textContent = fmt.format(r.ahorroAnualEur);
  $('r-co2').textContent = fmt.format(r.co2EvitadoKg);
  $('r-payback').textContent = Number.isFinite(r.paybackAnios)
    ? fmt1.format(r.paybackAnios)
    : '—';

  const filaReparto = $('fila-reparto');
  filaReparto.hidden = datos.participantes < 2;
  $('r-reparto').textContent = fmt.format(r.ahorroPorParticipanteEur);

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

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const datos = leerFormulario();
  const r = calcular(datos);
  if (!r.ok) {
    pintarErrores(r.errores);
    resultados.hidden = true;
    btnImprimir.disabled = true;
    return;
  }
  pintarErrores({});
  pintarResultado(r, datos);
  if (window.matchMedia('(max-width: 959px)').matches) {
    resultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

btnImprimir.addEventListener('click', () => {
  $('hipotesis').open = true;
  window.print();
});

$('fecha-informe').textContent = new Date().toLocaleDateString('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
