import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calcular, LIMITES, validar } from '../js/calculo.js';
import { audiencia, proximoPaso } from '../js/producto.js';
import { MEDIA_ASTURIAS, ZONAS } from '../js/atlas.js';
import * as estadoUi from '../js/ui-state.js';

const {
  PASOS,
  erroresDelPaso,
  primerPasoConError,
  estadoDePasos,
  resumenEscenario,
  lecturaDecision,
} = estadoUi;

const datos = {
  tipoUsuario: 'ayuntamiento', objetivo: 'activar-activos', zonaId: 'centro',
  consumoAnualKwh: 25000, potenciaContratadaKw: 15, superficieM2: 200,
  tipoSuperficie: 'cubierta', participantes: 12, perfilConsumo: 'mixto',
  precioElectricidad: 0.18, precioExcedentes: 0.06, fraccionSuperficieUtil: 0.75,
  inclinacionDeg: 38, azimutDeg: -3, perdidasPct: 14,
  estrategiaDimensionado: 'equilibrio', capexPorKwp: 1100, opexPctCapex: 2,
  degradacionPct: 0.5, tasaDescuentoPct: 3, vidaUtilAnios: 25,
};

function csvDenso(energia = () => 1) {
  const filas = ['mes,hora,kwh'];
  for (let mes = 1; mes <= 12; mes += 1) {
    for (let hora = 0; hora < 24; hora += 1) {
      filas.push(`${mes},${hora},${energia(mes, hora)}`);
    }
  }
  return filas.join('\n');
}

function diferido() {
  let resolve;
  let reject;
  const promise = new Promise((aceptar, rechazar) => {
    resolve = aceptar;
    reject = rechazar;
  });
  return { promise, resolve, reject };
}

let moduloApp;

async function cargarAppProduccion() {
  try {
    moduloApp ??= await import('../js/app.js');
    const app = await moduloApp;
    assert.equal(
      typeof app.iniciarInteracciones,
      'function',
      'app.js debe exportar la inicialización usada por el navegador',
    );
    return app;
  } catch (error) {
    assert.fail(`app.js debe poder importarse sin navegador: ${error.message}`);
  }
}

class ElementoFalso {
  constructor({ id = '', dataset = {}, documento, tagName = 'div' } = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.documento = documento;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.className = '';
    this.hidden = false;
    this.tabIndex = 0;
    this.textContent = '';
    this.value = '';
    this.focused = false;
    this.style = {};
    this.disabled = false;
    this.open = false;
    this.returnValue = '';
    this.name = '';
    this.type = '';
    this.files = [];
    this.queryMap = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...nombres) => nombres.forEach((nombre) => this.classes.add(nombre)),
      remove: (...nombres) => nombres.forEach((nombre) => this.classes.delete(nombre)),
      toggle: (nombre, forzar) => {
        const activo = forzar ?? !this.classes.has(nombre);
        if (activo) this.classes.add(nombre);
        else this.classes.delete(nombre);
        return activo;
      },
      contains: (nombre) => this.classes.has(nombre),
    };
    Object.defineProperty(this, 'innerHTML', {
      set() {
        throw new Error('La producción no debe renderizar audiencia con innerHTML');
      },
    });
  }

  addEventListener(tipo, listener) {
    const listeners = this.listeners.get(tipo) ?? [];
    listeners.push(listener);
    this.listeners.set(tipo, listeners);
  }

  dispatch(tipo, init = {}) {
    const evento = {
      ...init,
      type: tipo,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.get(tipo) ?? []) listener(evento);
    return evento;
  }

  setAttribute(nombre, valor) {
    this.attributes.set(nombre, String(valor));
  }

  getAttribute(nombre) {
    return this.attributes.get(nombre) ?? null;
  }

  toggleAttribute(nombre, forzar) {
    if (forzar) this.attributes.set(nombre, '');
    else this.attributes.delete(nombre);
  }

  focus() {
    for (const elemento of this.documento?.todos ?? []) elemento.focused = false;
    this.focused = true;
    if (this.documento) this.documento.activeElement = this;
  }

  append(...children) {
    for (const child of children) child.parentElement = this;
    this.children.push(...children);
  }

  replaceChildren(...children) {
    for (const child of children) child.parentElement = this;
    this.children = children;
  }

  querySelector(selector) {
    if (this.queryMap.has(selector)) return this.queryMap.get(selector);
    if (selector === '.step-button__status') return this.estadoTexto ?? null;
    if (selector === 'h1') return this.heading ?? null;
    return null;
  }

  querySelectorAll(selector) {
    return this.queryMap.get(selector) ?? [];
  }

  matches(selector) {
    return selector.split(',').some((parte) => parte.trim().toUpperCase() === this.tagName);
  }

  closest() { return null; }

  showModal() {
    this.open = true;
  }

  close(returnValue) {
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.open = false;
    this.dispatch('close');
  }

  scrollIntoView() {}
}

function crearHarnessInteracciones(datosIniciales = datos) {
  const documento = {
    todos: [],
    ids: new Map(),
    activeElement: null,
    createElement(tagName) {
      const elemento = new ElementoFalso({ documento: this, tagName });
      this.todos.push(elemento);
      return elemento;
    },
    getElementById(id) {
      return this.ids.get(id) ?? null;
    },
    querySelectorAll(selector) {
      return {
        '[data-audience]': this.audiencias,
        '[data-step-target]': this.botonesPaso,
        '[data-edit-step]': [],
        '[data-step]': this.fieldsets,
      }[selector] ?? [];
    },
    querySelector(selector) {
      const paso = selector.match(/^\[data-step-target="(\d+)"\]$/)?.[1];
      if (paso !== undefined) return this.botonesPaso[Number(paso)] ?? null;
      const nombre = selector.match(/^\[name="([^"]+)"\]$/)?.[1];
      if (nombre === 'participantes') return this.participantes;
      return null;
    },
  };
  const crear = (opciones) => {
    const elemento = new ElementoFalso({ ...opciones, documento });
    documento.todos.push(elemento);
    if (elemento.id) documento.ids.set(elemento.id, elemento);
    return elemento;
  };

  documento.audiencias = [
    'ayuntamiento',
    'cooperativa',
    'particular',
    'empresa',
  ].map((id) =>
    crear({
      id: `audiencia-${id}`,
      dataset: { audience: id },
      tagName: 'button',
    })
  );
  documento.fieldsets = PASOS.map(({ id }, indice) => {
    const fieldset = crear({ dataset: { step: id }, tagName: 'fieldset' });
    fieldset.hidden = indice !== 0;
    return fieldset;
  });
  documento.botonesPaso = PASOS.map((_, indice) => {
    const boton = crear({
      dataset: { stepTarget: String(indice) },
      tagName: 'button',
    });
    boton.estadoTexto = crear({ tagName: 'span' });
    return boton;
  });
  documento.participantes = crear({ id: 'participantes', tagName: 'input' });

  for (const id of [
    'audience-panel',
    'tipoUsuario',
    'objetivo',
    'titulo-siguiente-paso',
    'accion-siguiente-paso',
    'progreso-texto',
    'anterior',
    'siguiente-paso',
    'calcular',
  ]) crear({ id });

  const erroresPintados = [];
  const dependencias = {
    documento,
    activarVista() {},
    leerDatos() {
      return { ...datosIniciales };
    },
    pintarErrores(errores) {
      erroresPintados.push({ ...errores });
    },
  };

  return {
    documento,
    dependencias,
    erroresPintados,
  };
}

function comprobarAudiencia(documento, id) {
  const contenido = audiencia(id);
  const siguiente = proximoPaso(id);
  assert.equal(documento.getElementById('tipoUsuario').value, id);
  assert.equal(
    documento.getElementById('objetivo').value,
    contenido.objetivo ?? contenido.objetivoRecomendado,
  );
  assert.equal(
    documento.getElementById('titulo-siguiente-paso').textContent,
    siguiente.titulo,
  );
  assert.equal(
    documento.getElementById('accion-siguiente-paso').textContent,
    siguiente.accion,
  );
  assert.equal(
    documento.getElementById('audience-panel').getAttribute('aria-labelledby'),
    `audiencia-${id}`,
  );
  for (const boton of documento.audiencias) {
    const activo = boton.dataset.audience === id;
    assert.equal(boton.getAttribute('aria-selected'), String(activo));
    assert.equal(boton.tabIndex, activo ? 0 : -1);
  }

  const panel = documento.getElementById('audience-panel');
  assert.equal(panel.children[0].tagName, 'H3');
  assert.equal(panel.children[0].textContent, contenido.nombre);
  assert.equal(panel.children[1].textContent, contenido.promesa);
  assert.deepEqual(
    panel.children[2].children.map(({ textContent }) => textContent),
    contenido.lecturas,
  );
  assert.equal(panel.children[3].tagName, 'BUTTON');
  assert.equal(panel.children[3].type, 'button');
}

test('el recorrido refleja exactamente los cuatro fieldsets v2', () => {
  assert.deepEqual(PASOS, [
    {
      id: 'contexto',
      titulo: 'Contexto',
      campos: ['tipoUsuario', 'objetivo', 'zonaId', 'tipoSuperficie', 'superficieM2'],
    },
    {
      id: 'consumo',
      titulo: 'Comunidad y consumo',
      campos: [
        'consumoAnualKwh',
        'potenciaContratadaKw',
        'participantes',
        'perfilConsumo',
        'perfilPersonalizado',
        'precioElectricidad',
        'precioExcedentes',
      ],
    },
    {
      id: 'generacion',
      titulo: 'Generación',
      campos: [
        'fraccionSuperficieUtil',
        'inclinacionDeg',
        'azimutDeg',
        'perdidasPct',
        'estrategiaDimensionado',
      ],
    },
    {
      id: 'economia',
      titulo: 'Economía y revisión',
      campos: [
        'capexPorKwp',
        'opexPctCapex',
        'degradacionPct',
        'tasaDescuentoPct',
        'vidaUtilAnios',
      ],
    },
  ]);

  const campos = PASOS.flatMap(({ campos }) => campos);
  assert.equal(new Set(campos).size, campos.length, 'cada campo aparece una vez');
  assert.equal(campos.filter((campo) => campo === 'perfilPersonalizado').length, 1);
});

test('los errores se filtran por la etapa que el usuario puede corregir', () => {
  const errores = validar({ ...datos, superficieM2: 2, precioElectricidad: 2 });
  assert.deepEqual(Object.keys(erroresDelPaso('contexto', errores)), ['superficieM2']);
  assert.deepEqual(Object.keys(erroresDelPaso('consumo', errores)), ['precioElectricidad']);
  assert.equal(primerPasoConError(errores), 0);
});

test('los listeners reales seleccionan las cuatro audiencias por clic', async () => {
  const { iniciarInteracciones } = await cargarAppProduccion();
  const harness = crearHarnessInteracciones();
  iniciarInteracciones(harness.dependencias);

  for (const boton of harness.documento.audiencias) {
    boton.dispatch('click');
    comprobarAudiencia(harness.documento, boton.dataset.audience);
    assert.equal(boton.getAttribute('aria-selected'), 'true');
    assert.equal(boton.tabIndex, 0);
    assert.equal(
      harness.documento.getElementById('audience-panel').children[0].textContent,
      audiencia(boton.dataset.audience).nombre,
    );
  }
});

test('los listeners reales resuelven flechas, Home y End con selección y foco', async () => {
  const { iniciarInteracciones } = await cargarAppProduccion();
  const casos = [
    ['ayuntamiento', 'ArrowRight', 'cooperativa'],
    ['ayuntamiento', 'ArrowLeft', 'empresa'],
    ['particular', 'Home', 'ayuntamiento'],
    ['cooperativa', 'End', 'empresa'],
  ];

  for (const [origen, tecla, destino] of casos) {
    const harness = crearHarnessInteracciones();
    iniciarInteracciones(harness.dependencias);
    const botonOrigen = harness.documento.audiencias.find(
      ({ dataset }) => dataset.audience === origen,
    );
    botonOrigen.dispatch('click');
    botonOrigen.focus();
    const evento = botonOrigen.dispatch('keydown', { key: tecla });
    const botonDestino = harness.documento.audiencias.find(
      ({ dataset }) => dataset.audience === destino,
    );

    assert.equal(evento.defaultPrevented, true, tecla);
    comprobarAudiencia(harness.documento, destino);
    assert.equal(botonDestino.focused, true, tecla);
    assert.equal(botonDestino.getAttribute('aria-selected'), 'true', tecla);
  }
});

test('el listener real de tipoUsuario propaga directamente las cuatro audiencias', async () => {
  const { iniciarInteracciones } = await cargarAppProduccion();
  const harness = crearHarnessInteracciones();
  iniciarInteracciones(harness.dependencias);
  const selector = harness.documento.getElementById('tipoUsuario');

  for (const id of ['ayuntamiento', 'cooperativa', 'particular', 'empresa']) {
    selector.value = id;
    selector.dispatch('change');
    comprobarAudiencia(harness.documento, id);
  }
});

test('el listener real bloquea participantes inválidos en la etapa 2 visible', async () => {
  const { iniciarInteracciones } = await cargarAppProduccion();
  const harness = crearHarnessInteracciones({
    ...datos,
    participantes: LIMITES.participantes[1] + 1,
  });
  iniciarInteracciones(harness.dependencias);
  const siguiente = harness.documento.getElementById('siguiente-paso');

  siguiente.dispatch('click');
  assert.equal(harness.documento.fieldsets[1].hidden, false);
  assert.equal(harness.documento.fieldsets[0].hidden, true);

  siguiente.dispatch('click');
  assert.equal(harness.documento.fieldsets[1].hidden, false);
  assert.equal(harness.documento.fieldsets[2].hidden, true);
  assert.equal(harness.documento.participantes.focused, true);
  assert.deepEqual(
    Object.keys(harness.erroresPintados.at(-1)),
    ['participantes'],
  );
  assert.equal(harness.documento.botonesPaso[1].dataset.state, 'error');
});

test('el estado de pasos diferencia completado, actual, disponible y bloqueado', () => {
  assert.deepEqual(estadoDePasos(1, 2), [
    'completado',
    'actual',
    'disponible',
    'bloqueado',
  ]);
});

test('el resumen usa lenguaje territorial y conserva unidades', () => {
  assert.equal(
    resumenEscenario(datos),
    'Ayuntamiento · Centro · 25.000 kWh/año · 12 participantes · equilibrio recomendado'
  );
});

test('la lectura principal traduce el semáforo sin prometer una garantía', () => {
  const lectura = lecturaDecision(calcular(datos));
  assert.equal(lectura.titulo, 'Previabilidad favorable con datos pendientes');
  assert.match(lectura.explicacion, /orientación preliminar/i);
  assert.equal(lectura.accion, 'Preparar una validación técnica');
});

test('leerFormulario devuelve todos los tipos v2 y conserva porcentajes en puntos', async () => {
  const { leerFormulario } = await cargarAppProduccion();
  const fd = new FormData();
  for (const [campo, valor] of Object.entries({
    ...datos,
    fraccionSuperficieUtil: 75,
    degradacionPct: '0,5',
  })) fd.set(campo, String(valor).replace('.', campo === 'precioElectricidad' ? ',' : '.'));
  const perfil = Array(288).fill(0);
  perfil[12] = datos.consumoAnualKwh;

  const lectura = leerFormulario(fd, perfil);
  assert.deepEqual(lectura, { ...datos, perfilPersonalizado: perfil });
  assert.equal(lectura.opexPctCapex, 2);
  assert.equal(lectura.degradacionPct, 0.5);
  assert.equal(lectura.tasaDescuentoPct, 3);
});

test('el controlador CSV renormaliza desde el texto original sin subir ni persistir', async () => {
  const { crearControladorPerfilLocal } = await cargarAppProduccion();
  assert.equal(typeof crearControladorPerfilLocal, 'function');
  let lecturas = 0;
  const archivo = {
    name: 'curva-local.csv',
    async text() {
      lecturas += 1;
      return csvDenso((mes, hora) => mes * 24 + hora + 1);
    },
  };
  const controlador = crearControladorPerfilLocal();
  const inicial = await controlador.cargar(archivo, 25000);
  const renormalizado = controlador.renormalizar(40000);

  assert.equal(lecturas, 1, 'renormaliza desde memoria, no vuelve a leer ni sube el archivo');
  assert.equal(inicial.nombre, 'curva-local.csv');
  assert.equal(inicial.perfil.length, 288);
  assert.ok(Math.abs(inicial.perfil.reduce((a, b) => a + b, 0) - 25000) < 1e-6);
  assert.ok(Math.abs(renormalizado.perfil.reduce((a, b) => a + b, 0) - 40000) < 1e-6);
});

function crearDocumentoPerfil(consumo = '25000') {
  const ids = new Map();
  const documento = {
    todos: [],
    activeElement: null,
    getElementById(id) { return ids.get(id) ?? null; },
  };
  for (const [id, value = ''] of [
    ['consumoAnualKwh', consumo],
    ['perfil-archivo-estado', ''],
    ['perfilArchivo', 'seleccionado.csv'],
  ]) {
    const elemento = new ElementoFalso({ id, documento, tagName: id === 'perfilArchivo' ? 'input' : 'div' });
    elemento.value = value;
    documento.todos.push(elemento);
    ids.set(id, elemento);
  }
  return documento;
}

async function conDocumento(documento, accion) {
  const anterior = globalThis.document;
  globalThis.document = documento;
  try {
    return await accion();
  } finally {
    if (anterior === undefined) delete globalThis.document;
    else globalThis.document = anterior;
  }
}

test('el loader real ignora éxito viejo lento después de uno nuevo rápido', async () => {
  const { cargarPerfilPersonalizado } = await cargarAppProduccion();
  const documento = crearDocumentoPerfil();
  await conDocumento(documento, async () => {
    await cargarPerfilPersonalizado(undefined);
    const lento = diferido();
    const cargaVieja = cargarPerfilPersonalizado({ name: 'viejo.csv', text: () => lento.promise });
    const nuevo = await cargarPerfilPersonalizado({ name: 'nuevo.csv', text: async () => csvDenso(() => 2) });
    lento.resolve(csvDenso(() => 1));
    await cargaVieja;

    assert.ok(Math.abs(nuevo.reduce((a, b) => a + b, 0) - 25000) < 1e-6);
    assert.match(documento.getElementById('perfil-archivo-estado').textContent, /^nuevo\.csv:/);
  });
});

test('limpiar invalida una lectura CSV todavía pendiente', async () => {
  const { cargarPerfilPersonalizado } = await cargarAppProduccion();
  const documento = crearDocumentoPerfil();
  await conDocumento(documento, async () => {
    const lectura = diferido();
    const pendiente = cargarPerfilPersonalizado({ name: 'pendiente.csv', text: () => lectura.promise });
    await cargarPerfilPersonalizado(undefined);
    lectura.resolve(csvDenso());
    const resultado = await pendiente;

    assert.equal(resultado, undefined);
    assert.equal(documento.getElementById('perfil-archivo-estado').textContent, 'Ningún perfil personalizado cargado.');
  });
});

test('un error CSV obsoleto no borra el perfil nuevo ni su estado', async () => {
  const { cargarPerfilPersonalizado } = await cargarAppProduccion();
  const documento = crearDocumentoPerfil();
  await conDocumento(documento, async () => {
    await cargarPerfilPersonalizado(undefined);
    const lento = diferido();
    const cargaVieja = cargarPerfilPersonalizado({ name: 'error-viejo.csv', text: () => lento.promise });
    await cargarPerfilPersonalizado({ name: 'nuevo.csv', text: async () => csvDenso() });
    lento.reject(new Error('lectura vieja fallida'));
    await cargaVieja;

    assert.match(documento.getElementById('perfil-archivo-estado').textContent, /^nuevo\.csv:/);
    assert.notEqual(documento.getElementById('perfilArchivo').value, '');
  });
});

test('el loader real usa el consumo más reciente después de leer el archivo', async () => {
  const { cargarPerfilPersonalizado } = await cargarAppProduccion();
  const documento = crearDocumentoPerfil('25000');
  await conDocumento(documento, async () => {
    await cargarPerfilPersonalizado(undefined);
    const lectura = diferido();
    const pendiente = cargarPerfilPersonalizado({ name: 'cambio.csv', text: () => lectura.promise });
    documento.getElementById('consumoAnualKwh').value = '40000';
    lectura.resolve(csvDenso());
    const perfil = await pendiente;

    assert.ok(Math.abs(perfil.reduce((a, b) => a + b, 0) - 40000) < 1e-6);
  });
});

test('el controlador Atlas cancela sin mutar y confirma una sola transferencia', async () => {
  const { crearControladorTransferenciaAtlas } = await cargarAppProduccion();
  assert.equal(typeof crearControladorTransferenciaAtlas, 'function');
  const aplicadas = [];
  const controlador = crearControladorTransferenciaAtlas({
    transferir(zona) { aplicadas.push(zona.id); },
  });
  const zona = { id: 'centro', angulo: 38, azimut: -3 };

  const aviso = controlador.solicitar(zona, true);
  assert.equal(aviso.requiereConfirmacion, true);
  assert.deepEqual(aviso.campos, ['zonaId', 'inclinacionDeg', 'azimutDeg']);
  controlador.cerrar(false);
  assert.deepEqual(aplicadas, []);

  controlador.solicitar(zona, true);
  controlador.cerrar(true);
  controlador.cerrar(true);
  assert.deepEqual(aplicadas, ['centro']);
});

function parsearAtributos(source) {
  const atributos = {};
  const patron = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(patron)) {
    atributos[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return atributos;
}

async function crearHarnessAplicacion() {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const documento = {
    todos: [],
    ids: new Map(),
    activeElement: null,
    createElement(tagName) {
      const elemento = new ElementoFalso({ documento: this, tagName });
      this.todos.push(elemento);
      return elemento;
    },
    createElementNS(_namespace, tagName) {
      return this.createElement(tagName);
    },
    importNode(node) { return node; },
    getElementById(id) { return this.ids.get(id) ?? null; },
    querySelectorAll(selector) {
      if (selector === '[data-view-target]') return this.todos.filter(({ dataset }) => dataset.viewTarget);
      if (selector === '[data-view]') return this.todos.filter(({ dataset }) => dataset.view);
      if (selector === '.app-nav [role="tab"]') {
        return this.todos.filter(({ id, attributes }) => id.startsWith('tab-') && attributes.get('role') === 'tab');
      }
      if (selector === '[data-start-analysis]') return this.todos.filter(({ dataset }) => dataset.startAnalysis !== undefined);
      if (selector === '[data-audience]') return this.todos.filter(({ dataset }) => dataset.audience);
      if (selector === '[data-step-target]') return this.todos.filter(({ dataset }) => dataset.stepTarget !== undefined);
      if (selector === '[data-edit-step]') return this.todos.filter(({ dataset }) => dataset.editStep !== undefined);
      if (selector === '[data-step]') return this.todos.filter(({ dataset }) => dataset.step);
      if (selector === '.primary-reading .confidence-label') {
        return this.todos.filter(({ classes }) => classes.has('confidence-label')).slice(0, 2);
      }
      if (selector === '.fecha-doc') return this.todos.filter(({ classes }) => classes.has('fecha-doc'));
      if (selector === '#atlas-zonas button') {
        return this.getElementById('atlas-zonas').children.flatMap((item) => item.children)
          .filter(({ tagName }) => tagName === 'BUTTON');
      }
      const nombre = selector.match(/^\[name="([^"]+)"\]$/)?.[1];
      if (nombre) return this.todos.filter((elemento) => elemento.name === nombre);
      return [];
    },
    querySelector(selector) {
      const vista = selector.match(/^\[data-view="([^"]+)"\]$/)?.[1];
      if (vista) return this.todos.find(({ dataset }) => dataset.view === vista) ?? null;
      const paso = selector.match(/^\[data-step-target="(\d+)"\]$/)?.[1];
      if (paso !== undefined) return this.todos.find(({ dataset }) => dataset.stepTarget === paso) ?? null;
      const nombre = selector.match(/^\[name="([^"]+)"\]$/)?.[1];
      if (nombre) return this.todos.find((elemento) => elemento.name === nombre) ?? null;
      if (selector === '.regional-comparison__average') {
        return this.todos.find(({ classes }) => classes.has('regional-comparison__average')) ?? null;
      }
      return null;
    },
  };

  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^<>]*)>/gi)) {
    const tagName = match[1];
    const atributos = parsearAtributos(match[2]);
    const elemento = new ElementoFalso({
      id: atributos.id ?? '',
      documento,
      tagName,
    });
    elemento.name = atributos.name ?? '';
    elemento.type = atributos.type ?? '';
    elemento.value = atributos.value ?? '';
    elemento.hidden = Object.hasOwn(atributos, 'hidden');
    elemento.disabled = Object.hasOwn(atributos, 'disabled');
    elemento.tabIndex = Number(atributos.tabindex ?? 0);
    elemento.className = atributos.class ?? '';
    for (const clase of elemento.className.split(/\s+/).filter(Boolean)) elemento.classes.add(clase);
    for (const [nombre, valor] of Object.entries(atributos)) {
      elemento.setAttribute(nombre, valor);
      if (nombre.startsWith('data-')) {
        const clave = nombre.slice(5).replace(/-([a-z])/g, (_, letra) => letra.toUpperCase());
        elemento.dataset[clave] = valor;
      }
    }
    documento.todos.push(elemento);
    if (elemento.id) documento.ids.set(elemento.id, elemento);
  }

  for (const vista of documento.todos.filter(({ dataset }) => dataset.view)) {
    vista.heading = documento.getElementById(`titulo-${vista.dataset.view}`);
  }
  for (const boton of documento.querySelectorAll('[data-step-target]')) {
    boton.estadoTexto = documento.createElement('span');
  }
  for (const id of ['tabla-escenarios', 'tabla-sensibilidad']) {
    documento.getElementById(id).queryMap.set('tbody', documento.createElement('tbody'));
  }
  for (const id of ['grafico-horario', 'grafico-mensual']) {
    documento.getElementById(id).queryMap.set('.technical-chart__plot', documento.createElement('div'));
  }

  const valores = { ...datos, fraccionSuperficieUtil: 75 };
  for (const [id, valor] of Object.entries(valores)) {
    documento.getElementById(id).value = String(valor);
  }

  class FormDataFalso {
    constructor(origen) {
      this.origen = origen;
      this.valores = new Map();
    }
    get(nombre) {
      if (this.valores.has(nombre)) return this.valores.get(nombre);
      return documento.todos.find((elemento) => elemento.name === nombre)?.value ?? null;
    }
    set(nombre, valor) { this.valores.set(nombre, valor); }
  }

  const windowListeners = new Map();
  const ventana = {
    location: { hash: '' },
    matchMedia: (consulta) => ({ matches: consulta.includes('prefers-reduced-motion') }),
    scrollTo() {},
    print() {},
    addEventListener(tipo, listener) { windowListeners.set(tipo, listener); },
  };
  const historia = {
    replaceState(_state, _title, hash) { ventana.location.hash = hash; },
  };
  return { documento, FormDataFalso, ventana, historia };
}

async function conNavegadorFalso(harness, accion) {
  const valores = {
    document: harness.documento,
    window: harness.ventana,
    history: harness.historia,
    FormData: harness.FormDataFalso,
    navigator: { serviceWorker: { register: async () => undefined } },
    fetch: async () => { throw new Error('mapa no disponible en prueba'); },
    requestAnimationFrame: (callback) => callback(500),
  };
  const descriptores = new Map();
  for (const [nombre, valor] of Object.entries(valores)) {
    descriptores.set(nombre, Object.getOwnPropertyDescriptor(globalThis, nombre));
    Object.defineProperty(globalThis, nombre, { configurable: true, writable: true, value: valor });
  }
  try {
    return await accion();
  } finally {
    for (const [nombre, descriptor] of descriptores) {
      if (descriptor) Object.defineProperty(globalThis, nombre, descriptor);
      else delete globalThis[nombre];
    }
  }
}

test('bootstrap real, submit completo, balances, horizonte y Atlas funcionan en las cuatro audiencias', async (t) => {
  const app = await cargarAppProduccion();
  const harness = await crearHarnessAplicacion();
  await conNavegadorFalso(harness, async () => {
    assert.equal(app.iniciarAplicacion(), true);
    await app.cargarPerfilPersonalizado(undefined);
    await new Promise((resolve) => setImmediate(resolve));
    const { documento } = harness;
    const form = documento.getElementById('formulario');

    await t.test('la primera transferencia Atlas aplica supuestos sin afirmar que ocultó resultados', () => {
      documento.getElementById('tab-atlas').dispatch('click');
      documento.getElementById('usar-zona').dispatch('click');

      assert.equal(documento.getElementById('resultados').hidden, true);
      assert.match(documento.getElementById('nota-reactiva').textContent, /supuestos de zona.*aplicados/i);
      assert.match(documento.getElementById('nota-reactiva').textContent, /cálculo pendiente/i);
      assert.doesNotMatch(documento.getElementById('nota-reactiva').textContent, /resultados anteriores|se han ocultado/i);
      assert.equal(documento.activeElement, documento.getElementById('titulo-diagnostico'));
    });

    await t.test('ambas navegaciones activan la misma vista y sincronizan aria-current', () => {
      const destinos = ['inicio', 'diagnostico', 'atlas', 'metodo'];
      const navegacion = documento.todos.filter(({ id }) =>
        /^tab-|^mobile-nav-/.test(id)
      );
      assert.equal(navegacion.length, 8);
      for (const destino of destinos) {
        documento.getElementById(`mobile-nav-${destino}`).dispatch('click');
        assert.equal(documento.querySelector(`[data-view="${destino}"]`).hidden, false);
        for (const control of navegacion) {
          const activo = control.dataset.viewTarget === destino;
          assert.equal(control.getAttribute('aria-current'), activo ? 'page' : null);
          assert.equal(control.classList.contains('is-active'), activo);
        }
      }
    });

    await t.test('el submit por defecto renderiza por completo las cuatro audiencias', () => {
      for (const id of ['ayuntamiento', 'cooperativa', 'particular', 'empresa']) {
        documento.getElementById(`audiencia-${id}`).dispatch('click');
        assert.doesNotThrow(() => form.dispatch('submit'), id);
        assert.equal(documento.getElementById('resultados').hidden, false, id);
        assert.equal(
          documento.getElementById('titulo-siguiente-paso').textContent,
          proximoPaso(id).titulo,
          id,
        );
      }
    });

    await t.test('el submit real renderiza seis bloques de pasaporte con estados y fuentes', () => {
      form.dispatch('submit');
      const container = documento.getElementById('pasaporte-secciones');
      assert.equal(container.children.length, 6);
      assert.deepEqual(container.children.map(({ id }) => id), [
        'pasaporte-territorio',
        'pasaporte-comunidad',
        'pasaporte-energia',
        'pasaporte-economia',
        'pasaporte-regulacion',
        'pasaporte-proyecto',
      ]);
      assert.deepEqual(
        container.children.map(({ children }) => children[0].children[1].textContent),
        ['Calculado', 'Estimado', 'Estimado', 'Estimado', 'Dato pendiente', 'Validación técnica'],
      );
      for (const article of container.children) {
        assert.ok(article.children[1].children.length >= 2, article.id);
        assert.match(article.children[2].textContent, /^Incertidumbre · /);
        assert.match(article.children[3].textContent, /^Siguiente acción · /);
      }
      const regulation = container.children[4];
      assert.match(
        regulation.children[1].children.map(({ textContent }) => textContent).join(' '),
        /500 m.*5\.000 m.*hasta 5 MW/,
      );
      const sourceLinks = regulation.children[4].children.filter(({ tagName }) => tagName === 'A');
      assert.equal(sourceLinks.length, 2);
      assert.ok(sourceLinks.every(({ href, rel, target }) =>
        href.startsWith('https://www.boe.es/') && rel === 'noreferrer' && target === '_blank'
      ));
    });

    await t.test('el horizonte 10..40 actualiza caption y eje con vidaUtilAnios', () => {
      for (const vida of [10, 40]) {
        documento.getElementById('vidaUtilAnios').value = String(vida);
        form.dispatch('submit');
        assert.match(documento.getElementById('lr-titulo').textContent, new RegExp(`${vida} años`));
        assert.equal(documento.getElementById('lr-horizonte').textContent, `Año ${vida}`);
      }
    });

    await t.test('la impresión expresa la fracción útil como 75 %', () => {
      const fila = documento.getElementById('print-entradas').children.find(
        ({ children }) => children[0]?.textContent === 'Superficie utilizable',
      );
      assert.equal(fila.children[1].textContent, '75 %');
    });

    await t.test('los dos balances usan su denominador y reconcilian al 100 %', () => {
      const ancho = (id) => Number.parseFloat(documento.getElementById(id).style.width);
      assert.ok(Math.abs(ancho('barra-generacion-autoconsumo') + ancho('barra-generacion-excedentes') - 100) < 1e-9);
      assert.ok(Math.abs(ancho('barra-demanda-solar') + ancho('barra-demanda-red') - 100) < 1e-9);
    });

    await t.test('el Atlas pinta rango y media desde los datos generados', () => {
      const formato = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });
      const minimo = Math.min(...ZONAS.map(({ ey }) => ey));
      const maximo = Math.max(...ZONAS.map(({ ey }) => ey));
      assert.equal(documento.getElementById('atlas-minimo').textContent, formato.format(minimo));
      assert.equal(documento.getElementById('atlas-maximo').textContent, `${formato.format(maximo)} kWh/kWp·año`);
      assert.match(documento.getElementById('rp-comparacion-texto').textContent, new RegExp(formato.format(MEDIA_ASTURIAS).replace('.', '\\.')));
    });

    await t.test('Atlas confirma A, recalcula y Escape en B no reutiliza el retorno anterior', () => {
      documento.getElementById('vidaUtilAnios').value = '25';
      form.dispatch('submit');
      documento.getElementById('tab-atlas').dispatch('click');
      const campos = Object.keys({ ...datos, fraccionSuperficieUtil: 75 });
      const trigger = documento.getElementById('usar-zona');
      const dialogo = documento.getElementById('confirmar-zona');
      const zonas = documento.querySelectorAll('#atlas-zonas button');
      assert.ok(zonas.length >= 3);

      zonas[1].dispatch('click');
      const antesA = Object.fromEntries(campos.map((nombre) => [nombre, documento.querySelector(`[name="${nombre}"]`)?.value]));

      trigger.dispatch('click');
      assert.equal(dialogo.returnValue, '');
      dialogo.close('cancelar');
      assert.deepEqual(
        Object.fromEntries(campos.map((nombre) => [nombre, documento.querySelector(`[name="${nombre}"]`)?.value])),
        antesA,
      );
      assert.equal(documento.getElementById('resultados').hidden, false);
      assert.equal(documento.activeElement, trigger);
      assert.equal(documento.getElementById('vista-atlas').hidden, false);
      assert.equal(documento.getElementById('titulo-diagnostico').focused, false);

      trigger.dispatch('click');
      assert.equal(dialogo.returnValue, '');
      dialogo.close('confirmar');
      const despuesA = Object.fromEntries(campos.map((nombre) => [nombre, documento.querySelector(`[name="${nombre}"]`)?.value]));
      assert.deepEqual(
        campos.filter((nombre) => antesA[nombre] !== despuesA[nombre]).sort(),
        ['azimutDeg', 'inclinacionDeg', 'zonaId'],
      );
      assert.equal(documento.getElementById('resultados').hidden, true);
      assert.equal(documento.getElementById('imprimir').disabled, true);
      assert.match(documento.getElementById('nota-reactiva').textContent, /resultados anteriores.*ocult/i);
      assert.equal(documento.getElementById('vista-diagnostico').hidden, false);
      assert.equal(documento.activeElement, documento.getElementById('titulo-diagnostico'));
      assert.equal(documento.getElementById('titulo-diagnostico').focused, true);
      assert.equal(trigger.focused, false, 'no devuelve foco a un control oculto tras confirmar');

      form.dispatch('submit');
      assert.equal(documento.getElementById('resultados').hidden, false);
      documento.getElementById('tab-atlas').dispatch('click');
      zonas[2].dispatch('click');
      const antesB = Object.fromEntries(campos.map((nombre) => [nombre, documento.querySelector(`[name="${nombre}"]`)?.value]));

      trigger.dispatch('click');
      assert.equal(dialogo.returnValue, '', 'showModal debe limpiar el confirmar anterior');
      const cancelacionNativa = dialogo.dispatch('cancel');
      if (!cancelacionNativa.defaultPrevented) dialogo.close();

      assert.deepEqual(
        Object.fromEntries(campos.map((nombre) => [nombre, documento.querySelector(`[name="${nombre}"]`)?.value])),
        antesB,
        'Escape no transfiere la zona B',
      );
      assert.equal(documento.getElementById('resultados').hidden, false);
      assert.equal(documento.getElementById('vista-atlas').hidden, false);
      assert.equal(documento.activeElement, trigger);
      assert.equal(trigger.focused, true);
      assert.equal(documento.getElementById('titulo-diagnostico').focused, false);
    });
  });
});
