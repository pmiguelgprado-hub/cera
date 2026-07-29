// CERA — capa de presentación. El dominio permanece aislado en calculo.js.

import { calcular, validar } from './calculo.js';
import {
  PASOS,
  erroresDelPaso,
  primerPasoConError,
  estadoDePasos,
  resumenEscenario,
  lecturaDecision,
} from './ui-state.js';
import {
  ZONAS,
  MEDIA_ASTURIAS,
  serieMensual,
  comparacionRegional,
  buscarZonas,
  concejoCoincidente,
} from './atlas.js';
import { AUDIENCIAS, audiencia, matrizMadurez, proximoPaso } from './producto.js';
import { parsearPerfilCsv } from './perfiles-consumo.js';
import { crearPasaporte } from './pasaporte.js';
import { fuente } from './trazabilidad.js';

const $ = (id) => document.getElementById(id);
let form;
let resultados;
let btnImprimir;
let REDUCIR = { matches: false };

const fmt = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  useGrouping: 'always',
});
const fmt1 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: 'always',
});
const fmt2 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmt3 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const ETIQUETAS = {
  tipoUsuario: ['Tipo de usuario', ''],
  objetivo: ['Objetivo del análisis', ''],
  zonaId: ['Zona solar', ''],
  consumoAnualKwh: ['Consumo eléctrico anual', 'kWh/año'],
  potenciaContratadaKw: ['Potencia contratada', 'kW'],
  superficieM2: ['Superficie disponible', 'm²'],
  tipoSuperficie: ['Tipo de superficie', ''],
  participantes: ['Participantes', ''],
  perfilConsumo: ['Perfil de consumo', ''],
  precioElectricidad: ['Precio medio de electricidad', 'EUR/kWh'],
  precioExcedentes: ['Compensación de excedentes', 'EUR/kWh'],
  fraccionSuperficieUtil: ['Superficie utilizable', ''],
  inclinacionDeg: ['Inclinación', '°'],
  azimutDeg: ['Azimut', '°'],
  perdidasPct: ['Pérdidas globales', '%'],
  estrategiaDimensionado: ['Estrategia de dimensionamiento', ''],
  capexPorKwp: ['CAPEX unitario', 'EUR/kWp'],
  opexPctCapex: ['O&M anual', '% CAPEX/año'],
  degradacionPct: ['Degradación anual', '%/año'],
  tasaDescuentoPct: ['Tasa de descuento', '%'],
  vidaUtilAnios: ['Vida útil', 'años'],
};

const TIPOS = {
  cubierta: 'Cubierta o tejado',
  suelo: 'Suelo agrario (agrivoltaica)',
  aparcamiento: 'Aparcamiento (marquesina)',
};

let diagnosticoActivo = false;
let temporizador;
let zonaSeleccionada;
let mapaSvg;
let controladorPasos;
let aplicacionIniciada = false;
let perfilPersonalizado;
let audienciaSeleccionada = 'ayuntamiento';
let ultimoResultado;
const generacionesAnimacion = new Map();

export function leerFormulario(origen = form, perfil = perfilPersonalizado) {
  const fd = origen instanceof FormData ? origen : new FormData(origen);
  const numero = (campo) =>
    parseFloat(String(fd.get(campo)).trim().replace(',', '.'));
  const datos = {
    tipoUsuario: fd.get('tipoUsuario') ?? audienciaSeleccionada,
    objetivo: fd.get('objetivo'),
    zonaId: fd.get('zonaId'),
    consumoAnualKwh: numero('consumoAnualKwh'),
    potenciaContratadaKw: numero('potenciaContratadaKw'),
    superficieM2: numero('superficieM2'),
    tipoSuperficie: fd.get('tipoSuperficie'),
    participantes: numero('participantes'),
    perfilConsumo: fd.get('perfilConsumo'),
    precioElectricidad: numero('precioElectricidad'),
    precioExcedentes: numero('precioExcedentes'),
    fraccionSuperficieUtil: numero('fraccionSuperficieUtil') / 100,
    inclinacionDeg: numero('inclinacionDeg'),
    azimutDeg: numero('azimutDeg'),
    perdidasPct: numero('perdidasPct'),
    estrategiaDimensionado: fd.get('estrategiaDimensionado'),
    capexPorKwp: numero('capexPorKwp'),
    opexPctCapex: numero('opexPctCapex'),
    degradacionPct: numero('degradacionPct'),
    tasaDescuentoPct: numero('tasaDescuentoPct'),
    vidaUtilAnios: numero('vidaUtilAnios'),
  };
  if (Array.isArray(perfil) && perfil.length === 288) {
    datos.perfilPersonalizado = perfil;
  }
  return datos;
}

export function textoNumero(valor, formateador = fmt) {
  return Number.isFinite(valor) ? formateador.format(valor) : '—';
}

function activarVista(id, { actualizarHash = true, enfocar = false } = {}) {
  const destino = document.querySelector(`[data-view="${id}"]`);
  if (!destino) return;

  for (const vista of document.querySelectorAll('[data-view]')) {
    vista.hidden = vista !== destino;
  }

  for (const control of document.querySelectorAll('[data-view-target]')) {
    const activo = control.dataset.viewTarget === id;
    const esNavegacion = control.getAttribute('role') === 'tab' ||
      control.classList.contains('mobile-nav__button');
    if (esNavegacion) {
      control.classList.toggle('is-active', activo);
      control.toggleAttribute('aria-current', activo);
      if (activo) control.setAttribute('aria-current', 'page');
    }
    if (control.getAttribute('role') === 'tab') {
      control.setAttribute('aria-selected', String(activo));
      control.tabIndex = activo ? 0 : -1;
    }
  }

  if (actualizarHash) history.replaceState(null, '', `#${id}`);
  if (enfocar) {
    destino.querySelector('h1')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: REDUCIR.matches ? 'auto' : 'smooth' });
  }
}

function navegarPestanas(evento) {
  const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
  if (!teclas.includes(evento.key)) return;

  const pestanas = [
    ...document.querySelectorAll('.app-nav [role="tab"]'),
  ];
  const indiceActual = pestanas.indexOf(evento.currentTarget);
  if (indiceActual < 0) return;

  evento.preventDefault();
  let indiceDestino;
  if (evento.key === 'Home') indiceDestino = 0;
  if (evento.key === 'End') indiceDestino = pestanas.length - 1;
  if (evento.key === 'ArrowRight') {
    indiceDestino = (indiceActual + 1) % pestanas.length;
  }
  if (evento.key === 'ArrowLeft') {
    indiceDestino = (indiceActual - 1 + pestanas.length) % pestanas.length;
  }

  const destino = pestanas[indiceDestino];
  activarVista(destino.dataset.viewTarget);
  destino.focus();
}

export function crearControladorAudiencias({ documento, activarVista }) {
  const porId = (id) => documento.getElementById(id);

  function seleccionarAudiencia(id, { abrirDiagnostico = false } = {}) {
    if (!Object.hasOwn(AUDIENCIAS, id)) throw new RangeError(`Audiencia desconocida: ${id}`);
    const contenido = audiencia(id);
    const siguiente = proximoPaso(id);
    const panel = porId('audience-panel');
    const botones = [...documento.querySelectorAll('[data-audience]')];

    audienciaSeleccionada = id;
    porId('tipoUsuario').value = id;
    porId('objetivo').value = contenido.objetivo ?? contenido.objetivoRecomendado;
    porId('titulo-siguiente-paso').textContent = siguiente.titulo;
    porId('accion-siguiente-paso').textContent = siguiente.accion;

    for (const boton of botones) {
      const activo = boton.dataset.audience === id;
      boton.setAttribute('aria-selected', String(activo));
      boton.tabIndex = activo ? 0 : -1;
      if (activo) panel.setAttribute('aria-labelledby', boton.id);
    }

    const titulo = documento.createElement('h3');
    const promesa = documento.createElement('p');
    const lecturas = documento.createElement('ul');
    const accion = documento.createElement('button');
    titulo.textContent = contenido.nombre;
    promesa.textContent = contenido.promesa;
    lecturas.append(
      ...contenido.lecturas.map((texto) =>
        Object.assign(documento.createElement('li'), { textContent: texto })
      )
    );
    accion.type = 'button';
    accion.className = 'button button--primary';
    accion.textContent = `Analizar como ${contenido.nombre.toLocaleLowerCase('es')}`;
    accion.addEventListener('click', () =>
      seleccionarAudiencia(id, { abrirDiagnostico: true })
    );
    panel.replaceChildren(titulo, promesa, lecturas, accion);

    if (abrirDiagnostico) activarVista('diagnostico', { enfocar: true });
  }

  function navegarAudiencias(evento) {
    const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!teclas.includes(evento.key)) return;
    const botones = [...documento.querySelectorAll('[data-audience]')];
    const indiceActual = botones.indexOf(evento.currentTarget);
    if (indiceActual < 0) return;

    evento.preventDefault();
    let indiceDestino = indiceActual;
    if (evento.key === 'Home') indiceDestino = 0;
    if (evento.key === 'End') indiceDestino = botones.length - 1;
    if (evento.key === 'ArrowRight') {
      indiceDestino = (indiceActual + 1) % botones.length;
    }
    if (evento.key === 'ArrowLeft') {
      indiceDestino = (indiceActual - 1 + botones.length) % botones.length;
    }
    seleccionarAudiencia(botones[indiceDestino].dataset.audience);
    botones[indiceDestino].focus();
  }

  function registrar() {
    for (const boton of documento.querySelectorAll('[data-audience]')) {
      boton.addEventListener('click', () =>
        seleccionarAudiencia(boton.dataset.audience)
      );
      boton.addEventListener('keydown', navegarAudiencias);
    }
    porId('tipoUsuario').addEventListener('change', (evento) =>
      seleccionarAudiencia(evento.target.value)
    );
  }

  return { seleccionarAudiencia, navegarAudiencias, registrar };
}

function pintarErrores(errores) {
  for (const campo of Object.keys(ETIQUETAS)) {
    const errorEl = $(`error-${campo}`);
    const controles = [
      ...document.querySelectorAll(`[name="${campo}"]`),
    ];
    const campoEl = controles[0]?.closest('.field');
    const mensaje = errores[campo];

    if (errorEl) {
      errorEl.textContent = mensaje ?? '';
      errorEl.hidden = !mensaje;
    }
    campoEl?.classList.toggle('is-invalid', Boolean(mensaje));
    for (const control of controles) {
      control.setAttribute('aria-invalid', String(Boolean(mensaje)));
    }
  }
}

export function crearControladorPasos({
  documento,
  leerDatos,
  pintarErrores,
}) {
  const porId = (id) => documento.getElementById(id);
  let pasoActual = 0;
  let maximoDisponible = 0;

  function actualizarEstadoPasos() {
    const estados = estadoDePasos(pasoActual, maximoDisponible);
    const botones = [...documento.querySelectorAll('[data-step-target]')];

    botones.forEach((boton, indice) => {
      const estado = estados[indice];
      const bloqueado = estado === 'bloqueado';
      const estadoTexto = boton.querySelector('.step-button__status');
      boton.dataset.state = estado;
      boton.toggleAttribute('aria-current', estado === 'actual');
      boton.setAttribute('aria-disabled', String(bloqueado));
      if (estadoTexto) {
        estadoTexto.textContent = {
          completado: 'Completado',
          actual: 'En curso',
          disponible: 'Disponible',
          bloqueado:
            indice > 0
              ? `Completa ${PASOS[indice - 1].titulo}`
              : 'Bloqueado',
        }[estado];
      }
    });

    porId('progreso-texto').textContent =
      `${pasoActual + 1} de ${PASOS.length}`;
  }

  function mostrarPaso(indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= PASOS.length) return;
    if (indice > maximoDisponible) return;

    pasoActual = indice;
    documento.querySelectorAll('[data-step]').forEach((fieldset, posicion) => {
      fieldset.hidden = posicion !== pasoActual;
    });
    actualizarEstadoPasos();

    const anterior = porId('anterior');
    const siguiente = porId('siguiente-paso');
    const calcularBtn = porId('calcular');
    anterior.hidden = pasoActual === 0;
    siguiente.hidden = pasoActual === PASOS.length - 1;
    calcularBtn.hidden = pasoActual !== PASOS.length - 1;
    if (!siguiente.hidden) {
      siguiente.textContent = `Continuar a ${PASOS[pasoActual + 1].titulo}`;
    }
  }

  function enfocarPrimerError(errores) {
    const campo = Object.keys(errores)[0];
    documento.querySelector(`[name="${campo}"]`)?.focus();
  }

  function avanzarPaso() {
    const errores = erroresDelPaso(PASOS[pasoActual].id, validar(leerDatos()));
    pintarErrores(errores);

    if (Object.keys(errores).length > 0) {
      const boton = documento.querySelector(
        `[data-step-target="${pasoActual}"]`,
      );
      if (boton) boton.dataset.state = 'error';
      enfocarPrimerError(errores);
      return;
    }

    maximoDisponible = Math.max(
      maximoDisponible,
      Math.min(pasoActual + 1, PASOS.length - 1),
    );
    mostrarPaso(Math.min(pasoActual + 1, PASOS.length - 1));
  }

  function volverPaso() {
    mostrarPaso(Math.max(0, pasoActual - 1));
  }

  function mostrarPrimerError(errores) {
    const indice = primerPasoConError(errores);
    maximoDisponible = Math.max(maximoDisponible, indice);
    mostrarPaso(indice);
    enfocarPrimerError(errores);
  }

  function registrar() {
    for (const boton of documento.querySelectorAll('[data-step-target]')) {
      boton.addEventListener('click', () => {
        if (boton.getAttribute('aria-disabled') === 'true') return;
        mostrarPaso(Number(boton.dataset.stepTarget));
      });
    }

    for (const boton of documento.querySelectorAll('[data-edit-step]')) {
      boton.addEventListener('click', () => {
        const indice = Number(boton.dataset.editStep);
        maximoDisponible = Math.max(maximoDisponible, indice);
        mostrarPaso(indice);
      });
    }

    porId('siguiente-paso').addEventListener('click', avanzarPaso);
    porId('anterior').addEventListener('click', volverPaso);
  }

  return {
    mostrarPaso,
    mostrarPrimerError,
    registrar,
  };
}

export function iniciarInteracciones({
  documento,
  activarVista: activarVistaControlada,
  leerDatos,
  pintarErrores: pintarErroresControlados,
}) {
  const audiencias = crearControladorAudiencias({
    documento,
    activarVista: activarVistaControlada,
  });
  const pasos = crearControladorPasos({
    documento,
    leerDatos,
    pintarErrores: pintarErroresControlados,
  });
  audiencias.registrar();
  pasos.registrar();
  audiencias.seleccionarAudiencia('ayuntamiento');
  pasos.mostrarPaso(0);
  return { audiencias, pasos };
}

function actualizarResumen() {
  const datos = leerFormulario();
  const superficie = textoNumero(datos.superficieM2);
  const consumo = textoNumero(datos.consumoAnualKwh);
  const potencia = textoNumero(datos.potenciaContratadaKw, fmt1);
  const precio = textoNumero(datos.precioElectricidad, fmt2);
  const participantes = textoNumero(datos.participantes);
  const tipo = TIPOS[datos.tipoSuperficie] ?? 'Superficie por definir';
  const estrategias = {
    ajuste: 'ajuste a consumo',
    equilibrio: 'equilibrio recomendado',
    maximo: 'máximo aprovechamiento',
  };
  const estrategia = estrategias[datos.estrategiaDimensionado] ?? 'por definir';
  const palabraParticipantes =
    datos.participantes === 1 ? 'participante' : 'participantes';

  $('resumen-lugar').textContent = `${superficie} m² · ${tipo}`;
  $('resumen-energia').textContent = `${consumo} kWh/año · ${potencia} kW`;
  $('resumen-comunidad').textContent =
    `${participantes} ${palabraParticipantes} · ${estrategia}`;

  $('revision-lugar').textContent = `${superficie} m² · ${tipo}`;
  $('revision-energia').textContent =
    `${consumo} kWh/año · ${potencia} kW · ${precio} EUR/kWh`;
  $('revision-comunidad').textContent =
    `${participantes} ${palabraParticipantes} · ${estrategia}`;
}

function animarCifra(id, valor, formateador, animar = true) {
  const elemento = $(id);
  if (!elemento) return;
  const generacion = (generacionesAnimacion.get(id) ?? 0) + 1;
  generacionesAnimacion.set(id, generacion);
  if (!animar || REDUCIR.matches || !Number.isFinite(valor)) {
    elemento.textContent = Number.isFinite(valor)
      ? formateador.format(valor)
      : '—';
    return;
  }

  const duracion = 460;
  const inicio = performance.now();
  const paso = (ahora) => {
    if (generacionesAnimacion.get(id) !== generacion) return;
    const t = Math.min((ahora - inicio) / duracion, 1);
    const suavizado = 1 - (1 - t) ** 3;
    elemento.textContent = formateador.format(valor * suavizado);
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pintarCifras(r, animar) {
  animarCifra('r-potencia', r.potenciaKwp, fmt1, animar);
  animarCifra('r-produccion', r.produccionAnualKwh, fmt, animar);
  animarCifra('r-ahorro', r.ahorroAnualEur, fmt, animar);
  animarCifra('r-autoconsumo', r.tasaAutoconsumo * 100, fmt, animar);
  animarCifra('r-cobertura', r.coberturaConsumo * 100, fmt, animar);
  animarCifra('r-excedentes', r.excedentesKwh, fmt, animar);
  animarCifra('r-inversion', r.capexEur, fmt, animar);
  animarCifra('r-van', r.vanEur, fmt, animar);
  animarCifra('r-lcoe', r.lcoeEurKwh, fmt3, animar);
  animarCifra('r-payback', r.paybackAnios, fmt1, animar);
  animarCifra('r-payback-desc', r.paybackDescontadoAnios, fmt1, animar);
  animarCifra('r-reparto', r.ahorroPorParticipanteEur, fmt, animar);
}

function pintarFlujo(r, datos) {
  const series = [
    ['generacion-autoconsumo', r.autoconsumoKwh, r.produccionAnualKwh],
    ['generacion-excedentes', r.excedentesKwh, r.produccionAnualKwh],
    ['demanda-solar', r.autoconsumoKwh, r.balance.consumoKwh],
    ['demanda-red', r.balance.compraRedKwh, r.balance.consumoKwh],
  ];
  const lectura = new Map();

  for (const [clave, valor, denominador] of series) {
    const porcentaje = denominador > 0 ? (valor / denominador) * 100 : 0;
    const porcentajeVisual = Math.min(Math.max(porcentaje, 0), 100);
    $(`barra-${clave}`).style.width = `${porcentajeVisual}%`;
    $(`valor-${clave}`).textContent =
      `${fmt.format(valor)} kWh · ${fmt.format(porcentaje)} %`;
    lectura.set(clave, `${fmt.format(valor)} kWh, ${fmt.format(porcentaje)} %`);
  }

  $('nota-excedentes').hidden =
    !(r.produccionAnualKwh > datos.consumoAnualKwh);
  $('grafico').setAttribute(
    'aria-label',
    `Destino de la generación: autoconsumo ${lectura.get('generacion-autoconsumo')}; ` +
      `excedente a red ${lectura.get('generacion-excedentes')}. ` +
      `Cobertura de la demanda: solar ${lectura.get('demanda-solar')}; ` +
      `red ${lectura.get('demanda-red')}.`
  );
}

function textoRetorno(valor) {
  return Number.isFinite(valor) ? `${fmt1.format(valor)} años` : 'No recupera en el horizonte';
}

function pintarRetorno(r, datos) {
  const figura = $('linea-retorno');
  $('lr-titulo').textContent =
    `Recuperación simple dentro de una vida útil de ${datos.vidaUtilAnios} años`;
  $('lr-horizonte').textContent = `Año ${datos.vidaUtilAnios}`;
  $('r-payback-unidad').hidden = !Number.isFinite(r.paybackAnios);
  $('r-payback-desc-unidad').hidden = !Number.isFinite(r.paybackDescontadoAnios);
  if (!Number.isFinite(r.paybackAnios)) {
    figura.hidden = true;
    $('r-payback').textContent = 'No recupera';
    $('r-payback-desc').textContent = Number.isFinite(r.paybackDescontadoAnios)
      ? fmt1.format(r.paybackDescontadoAnios)
      : 'No recupera';
    return;
  }

  figura.hidden = false;
  const porcentaje = Math.min(r.paybackAnios / datos.vidaUtilAnios, 1) * 100;
  $('lr-pendiente').style.width = `${porcentaje}%`;
  $('lr-beneficio').style.width = `${100 - porcentaje}%`;
  $('lr-marca').style.left = `${porcentaje}%`;
  $('lr-marca').classList.toggle('fuera', r.paybackAnios > datos.vidaUtilAnios);
  $('lr-anio').textContent =
    r.paybackAnios > datos.vidaUtilAnios
      ? `+${datos.vidaUtilAnios} años`
      : `${fmt1.format(r.paybackAnios)} años`;
  $('lr-lectura').textContent =
    r.paybackAnios > datos.vidaUtilAnios
      ? 'Con estas hipótesis la inversión no se recupera dentro de la vida útil.'
      : `Retorno simple en ${fmt1.format(r.paybackAnios)} años; ` +
        `${fmt1.format(datos.vidaUtilAnios - r.paybackAnios)} años restantes dentro de la vida útil.`;
}

function pintarHipotesis(resultado) {
  $('lista-hipotesis').replaceChildren(
    ...resultado.hipotesis.map((texto) => {
      const li = document.createElement('li');
      li.textContent = texto;
      return li;
    })
  );
}

const passportNode = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

function renderPasaporte(datos, resultado) {
  const passport = crearPasaporte({
    datos,
    resultado,
    audienciaId: datos.tipoUsuario,
    fechaIso: new Date().toISOString(),
  });
  $('pasaporte-resumen').textContent =
    'Seis bloques para transferir la orientación al siguiente profesional.';
  $('pasaporte-secciones').replaceChildren(...passport.secciones.map((section) => {
    const article = document.createElement('article');
    article.className = 'passport-section';
    article.id = `pasaporte-${section.id}`;
    article.dataset.estado = section.estado;

    const header = document.createElement('header');
    header.append(
      passportNode('h3', 'passport-section__title', section.titulo),
      passportNode('p', 'passport-section__state', section.estado),
    );

    const evidence = document.createElement('ul');
    evidence.className = 'passport-section__evidence';
    evidence.append(...section.evidencias.map((item) =>
      passportNode('li', 'passport-section__evidence-item', item)
    ));

    const uncertainty = passportNode(
      'p',
      'passport-section__uncertainty',
      `Incertidumbre · ${section.incertidumbre}`,
    );
    const next = passportNode(
      'p',
      'passport-section__next',
      `Siguiente acción · ${section.siguienteAccion}`,
    );

    const sources = document.createElement('p');
    sources.className = 'passport-section__sources';
    section.fuenteIds.forEach((id, index) => {
      const item = fuente(id);
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = item.organismo;
      if (index > 0) {
        sources.append(passportNode('span', 'passport-section__separator', ' · '));
      }
      sources.append(link);
    });

    article.append(header, evidence, uncertainty, next);
    if (section.fuenteIds.length > 0) article.append(sources);
    return article;
  }));
}

function pintarEntradasImpresion(datos) {
  const textos = {
    tipoUsuario: audiencia(datos.tipoUsuario).nombre,
    objetivo: datos.objetivo,
    zonaId: datos.zonaId,
    tipoSuperficie: TIPOS[datos.tipoSuperficie],
    perfilConsumo: datos.perfilPersonalizado ? 'CSV local' : datos.perfilConsumo,
    estrategiaDimensionado: datos.estrategiaDimensionado,
    fraccionSuperficieUtil: `${fmt.format(datos.fraccionSuperficieUtil * 100)} %`,
  };

  $('print-entradas').replaceChildren(
    ...Object.entries(ETIQUETAS).map(([campo, [etiqueta, unidad]]) => {
      const fila = document.createElement('div');
      const termino = document.createElement('dt');
      const definicion = document.createElement('dd');
      termino.textContent = etiqueta;
      const bruto = textos[campo] ?? datos[campo];
      const valor = typeof bruto === 'number'
        ? textoNumero(bruto, Number.isInteger(bruto) ? fmt : fmt2)
        : bruto;
      definicion.textContent = unidad
        ? `${valor} ${unidad}`
        : valor;
      fila.append(termino, definicion);
      return fila;
    })
  );
}

function celda(texto, etiqueta, { cabecera = false } = {}) {
  const elemento = document.createElement(cabecera ? 'th' : 'td');
  if (cabecera) elemento.scope = 'row';
  if (etiqueta) elemento.dataset.label = etiqueta;
  elemento.textContent = texto;
  return elemento;
}

function porcentajeCambio(factor) {
  const cambio = Math.round((factor - 1) * 100);
  if (cambio === 0) return 'Sin cambio';
  return `${cambio > 0 ? '+' : '−'}${Math.abs(cambio)} %`;
}

function pintarEscenarios(escenarios) {
  const cuerpo = $('tabla-escenarios').querySelector('tbody');
  cuerpo.replaceChildren(...escenarios.map((escenario) => {
    const fila = document.createElement('tr');
    const regla = escenario.id === 'ajuste' && !escenario.cumpleRegla
      ? `${escenario.regla}. Fallback explícito.`
      : escenario.regla;
    fila.append(
      celda(escenario.label, 'Alternativa', { cabecera: true }),
      celda(regla, 'Regla'),
      celda(`${fmt1.format(escenario.potenciaKwp)} kWp`, 'Potencia'),
      celda(`${fmt.format(escenario.balance.tasaAutoconsumo * 100)} %`, 'Autoconsumo'),
      celda(`${fmt.format(escenario.balance.coberturaSolar * 100)} %`, 'Cobertura'),
      celda(`${fmt.format(escenario.capexEur)} EUR`, 'CAPEX'),
      celda(`${fmt.format(escenario.vanEur)} EUR`, 'VAN'),
    );
    return fila;
  }));
}

function pintarSensibilidad(sensibilidad) {
  const etiquetas = { conservador: 'Conservador', central: 'Central', favorable: 'Favorable' };
  const cuerpo = $('tabla-sensibilidad').querySelector('tbody');
  cuerpo.replaceChildren(...sensibilidad.map((escenario) => {
    const fila = document.createElement('tr');
    fila.append(
      celda(etiquetas[escenario.id], 'Escenario', { cabecera: true }),
      celda(porcentajeCambio(escenario.supuestos.capexFactor), 'CAPEX'),
      celda(porcentajeCambio(escenario.supuestos.compraFactor), 'Compra'),
      celda(porcentajeCambio(escenario.supuestos.excedenteFactor), 'Excedentes'),
      celda(`${fmt.format(escenario.vanEur)} EUR`, 'VAN'),
      celda(textoRetorno(escenario.paybackDescontadoAnios), 'Retorno descontado'),
    );
    return fila;
  }));
}

function slugEstado(estado) {
  return estado
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, '-');
}

function pintarMadurez(fases) {
  $('matriz-madurez').replaceChildren(...fases.map((fase) => {
    const fila = document.createElement('li');
    const titulo = document.createElement('strong');
    const estado = document.createElement('span');
    titulo.textContent = fase.titulo;
    estado.textContent = fase.estado;
    estado.dataset.confidence = slugEstado(fase.estado);
    fila.append(titulo, estado);
    return fila;
  }));
}

function puntos(values, maximum) {
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : index / (values.length - 1) * 100;
    const y = maximum > 0 ? 40 - value / maximum * 36 : 40;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function pintarGraficoHorario(horas) {
  const produccion = horas.map(({ generacionKwh }) => generacionKwh);
  const consumo = horas.map(({ consumoKwh }) => consumoKwh);
  const maximum = Math.max(...produccion, ...consumo, 1);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 44');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Curvas horarias medias de generación y consumo');
  for (const [serie, clase] of [[produccion, 'generation-line'], [consumo, 'load-line']]) {
    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    linea.setAttribute('points', puntos(serie, maximum));
    linea.setAttribute('fill', 'none');
    linea.setAttribute('vector-effect', 'non-scaling-stroke');
    linea.setAttribute('class', clase);
    svg.append(linea);
  }
  $('grafico-horario').querySelector('.technical-chart__plot').replaceChildren(svg);
  $('grafico-horario-texto').textContent = horas.map((hora, index) =>
    `${String(index).padStart(2, '0')}:00: generación ${fmt1.format(hora.generacionKwh)} kWh; consumo ${fmt1.format(hora.consumoKwh)} kWh`
  ).join('. ');
}

function pintarGraficoMensual(meses) {
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const maximum = Math.max(...meses.flatMap(({ generacionKwh, consumoKwh }) => [generacionKwh, consumoKwh]), 1);
  const plot = $('grafico-mensual').querySelector('.technical-chart__plot');
  plot.replaceChildren(...meses.map((mes, index) => {
    const grupo = document.createElement('span');
    const generacion = document.createElement('i');
    const consumo = document.createElement('i');
    grupo.className = 'monthly-balance-bin';
    generacion.className = 'monthly-balance-bin__generation';
    consumo.className = 'monthly-balance-bin__load';
    generacion.style.height = `${Math.max(mes.generacionKwh / maximum * 100, 1)}%`;
    consumo.style.height = `${Math.max(mes.consumoKwh / maximum * 100, 1)}%`;
    grupo.setAttribute('aria-hidden', 'true');
    grupo.append(generacion, consumo);
    return grupo;
  }));
  $('grafico-mensual-texto').textContent = meses.map((mes, index) =>
    `${nombres[index]}: generación ${fmt.format(mes.generacionKwh)} kWh; consumo ${fmt.format(mes.consumoKwh)} kWh; autoconsumo ${fmt.format(mes.autoconsumoKwh)} kWh`
  ).join('. ');
}

function pintarFormulas() {
  const formulas = [
    'autoconsumo_h = min(generación_h, consumo_h); excedente_h = max(generación_h − consumo_h, 0); compra_red_h = max(consumo_h − generación_h, 0).',
    'VAN = −CAPEX + Σ(flujo_neto_t / (1 + r)^t).',
    'LCOE = Σ(costes_t / (1 + r)^t) / Σ(energía_t / (1 + r)^t).',
  ];
  $('lista-formulas').replaceChildren(...formulas.map((texto) => {
    const li = document.createElement('li');
    li.textContent = texto;
    return li;
  }));
}

function esFuenteConfiable(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (
      hostname === 're.jrc.ec.europa.eu' ||
      hostname === 'joint-research-centre.ec.europa.eu'
    );
  } catch {
    return false;
  }
}

function pintarFuentes(fuentes) {
  $('lista-fuentes').replaceChildren(...fuentes.map((fuente) => {
    const li = document.createElement('li');
    if (esFuenteConfiable(fuente)) {
      const enlace = document.createElement('a');
      enlace.href = fuente;
      enlace.target = '_blank';
      enlace.rel = 'noreferrer';
      enlace.textContent = fuente.includes('seriescalc') ? 'Serie territorial JRC PVGIS 5.3' : 'Metodología JRC PVGIS';
      li.append(enlace);
    } else {
      li.textContent = fuente;
    }
    return li;
  }));
}

function pintarAvisos(resultado) {
  const avisos = [];
  if (resultado.confianza.encajeEnergetico === 'Estimado') {
    avisos.push('El encaje energético usa un perfil CERA estimado; aportar una curva local reduce incertidumbre.');
  }
  const ajuste = resultado.escenariosDimensionado.find(({ id }) => id === 'ajuste');
  if (ajuste && !ajuste.cumpleRegla) avisos.push(ajuste.regla);
  avisos.push(`Implantación: ${resultado.confianza.implantacion}. Diseño eléctrico y certificación: ${resultado.confianza.certificacion}.`);
  $('avisos').replaceChildren(...avisos.map((texto) => {
    const li = document.createElement('li');
    li.textContent = texto;
    return li;
  }));
}

function concejoDe(path) {
  const titulo = path?.querySelector('title')?.textContent ?? '';
  return titulo.split('·')[0].trim() || undefined;
}

export function actualizarEstadoPathAtlas(path, activo) {
  path.classList.toggle('concejo-activo', activo);
  if (path.getAttribute('role') === 'button') {
    path.setAttribute('aria-pressed', String(activo));
  } else {
    path.removeAttribute('aria-pressed');
  }
}

export function configurarInteraccionMapaAtlas({
  svg,
  coarsePointer,
  seleccionar = seleccionarZona,
} = {}) {
  for (const path of svg?.querySelectorAll('path[data-zona]') ?? []) {
    const zona = ZONAS[Number(path.dataset.zona)];
    if (!zona) continue;
    if (coarsePointer) {
      for (const attribute of ['tabindex', 'role', 'aria-label', 'aria-pressed']) {
        path.removeAttribute(attribute);
      }
      continue;
    }
    const etiqueta = path.querySelector('title')?.textContent ??
      `${zona.nombre}, ${fmt.format(zona.ey)} kWh por kWp y año`;
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'button');
    path.setAttribute('aria-label', etiqueta);
    path.setAttribute('aria-pressed', 'false');
    path.addEventListener('click', () => seleccionar(zona, path));
    path.addEventListener('focus', () => seleccionar(zona, path));
    path.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      evento.preventDefault();
      seleccionar(zona, path);
    });
  }
}

function pathDeZona(zonaId) {
  const indice = ZONAS.findIndex(({ id }) => id === zonaId);
  return indice < 0
    ? undefined
    : mapaSvg?.querySelector(`path[data-zona="${indice}"]`) ?? undefined;
}

function pathDeConcejo(nombre, zonaId) {
  const indice = ZONAS.findIndex(({ id }) => id === zonaId);
  return (
    [...(mapaSvg?.querySelectorAll(`path[data-zona="${indice}"]`) ?? [])]
      .find((path) => concejoDe(path) === nombre) ??
    pathDeZona(zonaId)
  );
}

function pintarSerieMensual(zonaId) {
  const serie = serieMensual(zonaId);
  const maximo = Math.max(...serie.map(({ valor }) => valor));
  $('rp-barras').replaceChildren(
    ...serie.map(({ mes, nombre, valor }) => {
      const columna = document.createElement('div');
      const barra = document.createElement('span');
      const etiqueta = document.createElement('span');
      columna.className = 'month-bar';
      barra.className = 'month-bar__value';
      barra.style.height = `${Math.max((valor / maximo) * 100, 2)}%`;
      barra.setAttribute(
        'aria-label',
        `${nombre}: ${fmt.format(valor)} kWh por kWp`
      );
      etiqueta.className = 'month-bar__label';
      etiqueta.textContent = mes;
      columna.append(barra, etiqueta);
      return columna;
    })
  );
  $('rp-barras-texto').textContent = serie
    .map(({ nombre, valor }) => `${nombre}: ${fmt.format(valor)} kWh`)
    .join('; ');
}

function pintarComparacion(zona) {
  const comparacion = comparacionRegional(zona.ey);
  const minimo = Math.min(...ZONAS.map(({ ey }) => ey));
  const maximo = Math.max(...ZONAS.map(({ ey }) => ey));
  const posicionZona = ((zona.ey - minimo) / (maximo - minimo)) * 100;
  const posicionMedia =
    ((MEDIA_ASTURIAS - minimo) / (maximo - minimo)) * 100;
  $('rp-comparacion').style.left = `${posicionZona}%`;
  document.querySelector(
    '.regional-comparison__average'
  ).style.left = `${posicionMedia}%`;
  $('rp-comparacion-texto').textContent =
    `${fmt.format(zona.ey)} kWh/kWp·año: ` +
    `${fmt.format(comparacion.diferencia)} kWh y ` +
    `${fmt.format(comparacion.porcentaje)} % ${comparacion.posicion} ` +
    `de la media regional de ${fmt.format(MEDIA_ASTURIAS)}.`;
}

function pintarEscalaAtlas() {
  const minimo = Math.min(...ZONAS.map(({ ey }) => ey));
  const maximo = Math.max(...ZONAS.map(({ ey }) => ey));
  $('atlas-minimo').textContent = fmt.format(minimo);
  $('atlas-maximo').textContent = `${fmt.format(maximo)} kWh/kWp·año`;
  $('rp-comparacion-texto').textContent =
    `La media de las ${ZONAS.length} zonas es ${fmt.format(MEDIA_ASTURIAS)} kWh/kWp·año.`;
}

function marcarZonaSeleccionada(zona) {
  for (const boton of document.querySelectorAll('#atlas-zonas button')) {
    boton.classList.toggle(
      'is-active',
      boton.dataset.zonaId === zona.id
    );
    boton.setAttribute(
      'aria-pressed',
      String(boton.dataset.zonaId === zona.id)
    );
  }
}

function seleccionarZona(
  zona,
  path = pathDeConcejo(zona.punto, zona.id),
  nombreConcejo
) {
  if (!zona) return;
  zonaSeleccionada = zona;
  const concejo = nombreConcejo ?? concejoDe(path) ?? zona.punto;
  $('rp-nombre').textContent = concejo ?? zona.nombre;
  $('rp-zona').textContent = `Zona ${zona.nombre}`;
  $('rp-ey').textContent = fmt.format(zona.ey);
  $('rp-punto').textContent = `${zona.punto} · ${zona.nombre}`;
  $('rp-angulo').textContent = `${zona.angulo}°`;
  $('rp-vs').textContent = `${zona.lat.toLocaleString('es-ES')}, ${zona.lon.toLocaleString('es-ES')} · ${zona.azimut}°`;
  $('rp-fuente').href = zona.sourceUrl;

  pintarSerieMensual(zona.id);
  pintarComparacion(zona);
  marcarZonaSeleccionada(zona);
  $('usar-zona').disabled = false;

  if (mapaSvg) {
    for (const candidato of mapaSvg.querySelectorAll('path')) {
      actualizarEstadoPathAtlas(candidato, candidato === path);
    }
  }
}

function renderizarListaZonas(zonas, consulta = '') {
  const lista = $('atlas-zonas');
  if (zonas.length === 0) {
    const vacio = document.createElement('li');
    vacio.className = 'atlas-zone-list__empty';
    vacio.textContent =
      'No hay coincidencias. Prueba con un concejo, una cuenca o una zona.';
    lista.replaceChildren(vacio);
    $('atlas-resultados').textContent = 'Sin coincidencias';
    return;
  }

  lista.replaceChildren(
    ...zonas.map((zona) => {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      const nombre = document.createElement('span');
      const valor = document.createElement('span');
      const concejo = concejoCoincidente(zona, consulta);
      boton.type = 'button';
      boton.dataset.zonaId = String(zona.id);
      boton.setAttribute(
        'aria-label',
        `${concejo}, zona ${zona.nombre}, ${fmt.format(zona.ey)} kWh por kWp y año`
      );
      boton.setAttribute(
        'aria-pressed',
        String(zonaSeleccionada?.id === zona.id)
      );
      boton.classList.toggle(
        'is-active',
        zonaSeleccionada?.id === zona.id
      );
      nombre.textContent = consulta.trim()
        ? `${concejo} · ${zona.nombre}`
        : zona.nombre;
      valor.textContent = fmt.format(zona.ey);
      boton.append(nombre, valor);
      boton.addEventListener('click', () =>
        seleccionarZona(
          zona,
          pathDeConcejo(concejo, zona.id),
          concejo
        )
      );
      li.append(boton);
      return li;
    })
  );
  $('atlas-resultados').textContent =
    `${zonas.length} ${zonas.length === 1 ? 'zona encontrada' : 'zonas encontradas'}`;
}

export function crearControladorPerfilLocal({ parsear = parsearPerfilCsv } = {}) {
  let original;
  let perfil;
  let solicitud = 0;
  const estado = (extra = {}) => ({ nombre: original?.nombre, perfil, ...extra });
  return {
    async cargar(file, consumoAnualKwh) {
      if (!file) {
        solicitud += 1;
        original = undefined;
        perfil = undefined;
        return estado();
      }
      const idSolicitud = ++solicitud;
      let texto;
      try {
        texto = await file.text();
      } catch (error) {
        if (idSolicitud !== solicitud) return estado({ obsoleta: true });
        throw error;
      }
      if (idSolicitud !== solicitud) return estado({ obsoleta: true });
      const consumoActual = typeof consumoAnualKwh === 'function'
        ? consumoAnualKwh()
        : consumoAnualKwh;
      perfil = parsear(texto, consumoActual);
      original = { texto, nombre: file.name };
      return estado({ obsoleta: false });
    },
    renormalizar(consumoAnualKwh) {
      if (!original) return estado();
      perfil = parsear(original.texto, consumoAnualKwh);
      return estado();
    },
    limpiar() {
      solicitud += 1;
      original = undefined;
      perfil = undefined;
      return estado();
    },
  };
}

const controladorPerfilLocal = crearControladorPerfilLocal();

function actualizarEstadoPerfil(texto, estado = '') {
  const status = $('perfil-archivo-estado');
  status.textContent = texto;
  status.className = `file-status${estado ? ` is-${estado}` : ''}`;
}

export async function cargarPerfilPersonalizado(file) {
  if (!file) {
    perfilPersonalizado = controladorPerfilLocal.limpiar().perfil;
    actualizarEstadoPerfil('Ningún perfil personalizado cargado.');
    return undefined;
  }
  try {
    const estado = await controladorPerfilLocal.cargar(
      file,
      () => Number(String($('consumoAnualKwh').value).replace(',', '.')),
    );
    if (estado.obsoleta) return perfilPersonalizado;
    perfilPersonalizado = estado.perfil;
    actualizarEstadoPerfil(`${estado.nombre}: 288 intervalos normalizados localmente.`, 'success');
    return perfilPersonalizado;
  } catch (error) {
    perfilPersonalizado = controladorPerfilLocal.limpiar().perfil;
    actualizarEstadoPerfil(error.message, 'error');
    $('perfilArchivo').value = '';
    return undefined;
  }
}

function renormalizarPerfilPersonalizado() {
  try {
    const consumoAnualKwh = Number(String($('consumoAnualKwh').value).replace(',', '.'));
    const estado = controladorPerfilLocal.renormalizar(consumoAnualKwh);
    if (!estado.nombre) return;
    perfilPersonalizado = estado.perfil;
    actualizarEstadoPerfil(
      `${estado.nombre}: 288 intervalos renormalizados localmente a ${fmt.format(consumoAnualKwh)} kWh/año.`,
      'success',
    );
  } catch (error) {
    perfilPersonalizado = undefined;
    actualizarEstadoPerfil(error.message, 'error');
  }
}

export function transferirZonaAlDiagnostico(
  zone,
  {
    documento = document,
    activar = activarVista,
    resumir = actualizarResumen,
    invalidar = invalidarResultadosAtlas,
  } = {},
) {
  documento.getElementById('zonaId').value = zone.id;
  documento.getElementById('inclinacionDeg').value = String(Math.round(zone.angulo));
  documento.getElementById('azimutDeg').value = String(Math.round(zone.azimut));
  invalidar(documento);
  resumir();
  activar('diagnostico', { enfocar: true });
}

function invalidarResultadosAtlas(documento = document) {
  const resultadosAnteriores = documento.getElementById('resultados');
  const habiaResultadosVisibles = !resultadosAnteriores.hidden;
  resultadosAnteriores.hidden = true;
  documento.getElementById('imprimir').disabled = true;
  const estado = documento.getElementById('nota-reactiva');
  estado.textContent = habiaResultadosVisibles
    ? 'Supuestos de zona aplicados. Los resultados anteriores se han ocultado; vuelve a calcular el diagnóstico.'
    : 'Supuestos de zona aplicados. Cálculo pendiente: completa o revisa el diagnóstico y calcula los resultados.';
  estado.hidden = false;
  diagnosticoActivo = false;
}

export function crearControladorTransferenciaAtlas({ transferir }) {
  let pendiente;
  return {
    solicitar(zone, diagnosticoEstaActivo) {
      const campos = ['zonaId', 'inclinacionDeg', 'azimutDeg'];
      if (!diagnosticoEstaActivo) {
        transferir(zone);
        return { requiereConfirmacion: false, campos };
      }
      pendiente = zone;
      return { requiereConfirmacion: true, campos };
    },
    cerrar(confirmar) {
      const zone = pendiente;
      pendiente = undefined;
      if (confirmar && zone) transferir(zone);
      return confirmar ? zone : undefined;
    },
  };
}

const controladorTransferenciaAtlas = crearControladorTransferenciaAtlas({
  transferir: (zone) => transferirZonaAlDiagnostico(zone),
});

function solicitarTransferenciaZona(zone) {
  if (!zone) return;
  const solicitud = controladorTransferenciaAtlas.solicitar(zone, diagnosticoActivo);
  if (!solicitud.requiereConfirmacion) return;
  $('cambio-zona').textContent = `${$('zonaId').value} → ${zone.id}`;
  $('cambio-inclinacion').textContent = `${$('inclinacionDeg').value}° → ${Math.round(zone.angulo)}°`;
  $('cambio-azimut').textContent = `${$('azimutDeg').value}° → ${Math.round(zone.azimut)}°`;
  const dialogo = $('confirmar-zona');
  dialogo.returnValue = '';
  dialogo.showModal();
}

async function montarAtlas() {
  const contenedor = $('mapa-recurso');
  const estado = $('mapa-estado');
  pintarEscalaAtlas();
  renderizarListaZonas(ZONAS);

  $('atlas-busqueda').addEventListener('input', (evento) => {
    const consulta = evento.target.value;
    renderizarListaZonas(buscarZonas(consulta), consulta);
  });

  try {
    const respuesta = await fetch('assets/mapa-asturias.svg');
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const texto = await respuesta.text();
    const documento = new DOMParser().parseFromString(
      texto,
      'image/svg+xml'
    );
    const svg = documento.querySelector('svg');
    if (!svg || documento.querySelector('parsererror')) {
      throw new Error('Mapa SVG no válido');
    }

    for (const script of svg.querySelectorAll('script')) script.remove();
    svg.removeAttribute('aria-hidden');
    contenedor.replaceChildren(document.importNode(svg, true));
    mapaSvg = contenedor.querySelector('svg');

    configurarInteraccionMapaAtlas({
      svg: mapaSvg,
      coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    });

    estado.hidden = true;
  } catch {
    estado.textContent =
      'El mapa no está disponible. La lista territorial y sus datos siguen operativos.';
    estado.classList.add('is-error');
    seleccionarZona(ZONAS[0], undefined);
  }
}

function pintarResultado(r, datos, animar = true) {
  ultimoResultado = r;
  const lectura = lecturaDecision(r);
  const siguiente = proximoPaso(datos.tipoUsuario);
  const veredicto = $('veredicto');
  veredicto.className = `decision-block ${r.semaforo.nivel}`;
  $('decision-titulo').textContent = lectura.titulo;
  $('veredicto-texto').textContent = lectura.explicacion;
  $('resumen-caso').textContent = resumenEscenario(datos);
  $('resultado-accion').textContent = lectura.accion;

  pintarCifras(r, animar);

  $('fila-reparto').hidden = datos.participantes < 2;
  $('nota-perdida').hidden = false;
  $('nota-perdida').textContent =
    'Antes de decidir, valida sombras, estructura, curvas horarias, conexión y presupuesto real.';

  pintarFlujo(r, datos);
  pintarRetorno(r, datos);
  pintarHipotesis(r);
  pintarEntradasImpresion(datos);
  pintarAvisos(r);
  pintarGraficoHorario(r.balance.horariaMedia);
  pintarGraficoMensual(r.balance.mensual);
  pintarEscenarios(r.escenariosDimensionado);
  pintarSensibilidad(r.sensibilidad);
  pintarMadurez(matrizMadurez(r));
  renderPasaporte(datos, r);
  pintarFormulas();
  pintarFuentes(r.fuentes);
  $('titulo-siguiente-paso').textContent = siguiente.titulo;
  $('accion-siguiente-paso').textContent = siguiente.accion;

  const etiquetasConfianza = document.querySelectorAll('.primary-reading .confidence-label');
  if (etiquetasConfianza[0]) {
    etiquetasConfianza[0].textContent = r.confianza.encajeEnergetico;
    etiquetasConfianza[0].dataset.confidence = slugEstado(r.confianza.encajeEnergetico);
  }
  if (etiquetasConfianza[1]) {
    etiquetasConfianza[1].textContent = r.confianza.encajeEnergetico;
    etiquetasConfianza[1].dataset.confidence = slugEstado(r.confianza.encajeEnergetico);
  }

  resultados.hidden = false;
  btnImprimir.disabled = false;
}

function ejecutar({ animar = true, desplazar = true } = {}) {
  const datos = leerFormulario();
  const calculo = calcular(datos);

  if (!calculo.ok) {
    pintarErrores(calculo.errores);
    controladorPasos.mostrarPrimerError(calculo.errores);
    return;
  }

  pintarErrores({});
  pintarResultado(calculo, datos, animar);
  diagnosticoActivo = true;
  $('nota-reactiva').hidden = false;
  $('nota-reactiva').textContent = 'El resultado se actualiza cuando modificas un dato válido.';

  if (
    desplazar &&
    window.matchMedia('(max-width: 959px)').matches
  ) {
    resultados.scrollIntoView({
      behavior: REDUCIR.matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

export function iniciarAplicacion() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  if (aplicacionIniciada) return true;
  aplicacionIniciada = true;

  form = $('formulario');
  resultados = $('resultados');
  btnImprimir = $('imprimir');
  REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)');

  for (const control of document.querySelectorAll('[data-view-target]')) {
    control.addEventListener('click', () => {
      activarVista(control.dataset.viewTarget, { enfocar: true });
    });
  }

  for (const pestana of document.querySelectorAll('.app-nav [role="tab"]')) {
    pestana.addEventListener('keydown', navegarPestanas);
  }

  for (const button of document.querySelectorAll('[data-start-analysis]')) {
    button.addEventListener('click', () =>
      activarVista('diagnostico', { enfocar: true })
    );
  }

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    ejecutar({ animar: true, desplazar: true });
  });

  form.addEventListener('input', (evento) => {
    if (evento.target.id === 'consumoAnualKwh') {
      renormalizarPerfilPersonalizado();
    }
    actualizarResumen();
    if (!diagnosticoActivo) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const datos = leerFormulario();
      const calculo = calcular(datos);
      if (calculo.ok) {
        pintarErrores({});
        pintarResultado(calculo, datos, false);
      }
    }, 180);
  });

  $('perfilArchivo').addEventListener('change', async (evento) => {
    await cargarPerfilPersonalizado(evento.target.files?.[0]);
    if (diagnosticoActivo) ejecutar({ animar: false, desplazar: false });
  });

  $('usar-zona').addEventListener('click', () =>
    solicitarTransferenciaZona(zonaSeleccionada)
  );

  const dialogoZona = $('confirmar-zona');
  dialogoZona.addEventListener('cancel', (evento) => {
    evento.preventDefault();
    dialogoZona.close('cancelar');
  });
  dialogoZona.addEventListener('close', () => {
    const transferida = controladorTransferenciaAtlas.cerrar(
      dialogoZona.returnValue === 'confirmar',
    );
    if (!transferida) $('usar-zona').focus();
  });

  form.addEventListener('focusout', (evento) => {
    const control = evento.target;
    if (!control.matches?.('input, select')) return;
    const errores = validar(leerFormulario());
    if (errores[control.name]) return;
    control.classList.remove('confirmado');
    void control.offsetWidth;
    control.classList.add('confirmado');
  });

  btnImprimir.addEventListener('click', () => {
    if (ultimoResultado) pintarCifras(ultimoResultado, false);
    $('hipotesis').open = true;
    pintarEntradasImpresion(leerFormulario());
    window.print();
  });

  window.addEventListener('beforeprint', () => {
    if (ultimoResultado) pintarCifras(ultimoResultado, false);
    $('hipotesis').open = true;
    pintarEntradasImpresion(leerFormulario());
  });

  const hashInicial = window.location.hash.slice(1);
  activarVista(
    ['inicio', 'diagnostico', 'atlas', 'metodo'].includes(hashInicial)
      ? hashInicial
      : 'inicio',
    { actualizarHash: false },
  );
  controladorPasos = iniciarInteracciones({
    documento: document,
    activarVista,
    leerDatos: leerFormulario,
    pintarErrores,
  }).pasos;
  actualizarResumen();
  montarAtlas();

  const fechaHoy = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  for (const elemento of document.querySelectorAll('.fecha-doc')) {
    elemento.textContent = fechaHoy;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  return true;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  iniciarAplicacion();
}
