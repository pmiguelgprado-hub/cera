import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { validar } from '../js/calculo.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const calculoV2 = await readFile(new URL('../js/calculo-v2.js', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const casoEstudio = await readFile(new URL('../docs/caso-estudio.md', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const manifest = JSON.parse(
  await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'),
);

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function parseElements(source) {
  return [...source.matchAll(/<([a-z][\w:-]*)\b([^<>]*)>/gi)].map((match) => ({
    tag: match[1].toLowerCase(),
    attributes: parseAttributes(match[2]),
  }));
}

function parseDeclarations(source) {
  const declarations = [];
  for (const entry of source.split(';')) {
    const separator = entry.indexOf(':');
    if (separator < 0) continue;
    const property = entry.slice(0, separator).trim().toLowerCase();
    if (!property) continue;
    let value = entry.slice(separator + 1).trim();
    const important = /\s*!important\s*$/i.test(value);
    value = value.replace(/\s*!important\s*$/i, '').trim();
    declarations.push({ property, value, important });
  }
  return declarations;
}

function splitSelectors(source) {
  const selectors = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    if ('(['.includes(source[index])) depth += 1;
    if (')]'.includes(source[index])) depth -= 1;
    if (source[index] === ',' && depth === 0) {
      selectors.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(source.slice(start).trim());
  return selectors.filter(Boolean);
}

function parseCssRules(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let order = 0;

  function walk(block, media = []) {
    let cursor = 0;
    while (cursor < block.length) {
      const open = block.indexOf('{', cursor);
      if (open < 0) break;
      const prelude = block.slice(cursor, open).trim();
      let depth = 1;
      let close = open + 1;
      while (close < block.length && depth > 0) {
        if (block[close] === '{') depth += 1;
        if (block[close] === '}') depth -= 1;
        close += 1;
      }
      assert.equal(depth, 0, `bloque CSS sin cerrar: ${prelude}`);
      const body = block.slice(open + 1, close - 1);
      if (prelude.startsWith('@media')) {
        walk(body, [...media, prelude.slice('@media'.length).trim()]);
      } else if (!prelude.startsWith('@')) {
        const declarations = parseDeclarations(body);
        for (const selector of splitSelectors(prelude)) {
          rules.push({ selector, declarations, media, order: order++ });
        }
      }
      cursor = close;
    }
  }

  walk(clean);
  return rules;
}

function specificity(selector) {
  const withoutPseudoElements = selector.replace(/::[\w-]+/g, '');
  return [
    (withoutPseudoElements.match(/#[\w-]+/g) ?? []).length,
    (withoutPseudoElements.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length,
    (withoutPseudoElements.match(/(?:^|[\s>+~])(?:[a-z][\w-]*)/gi) ?? []).length,
  ];
}

function compareSpecificity(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function elementNode({ tag = 'div', id, classes = [], attributes = {}, states = [], pseudo, parent } = {}) {
  return {
    tag: tag.toLowerCase(), id, classes: new Set(classes), attributes,
    states: new Set(states), pseudo, parent,
  };
}

function matchesSimpleSelector(source, element) {
  const pseudoElement = source.match(/::([\w-]+)/)?.[1];
  if ((pseudoElement ?? undefined) !== element.pseudo) return false;
  let simple = source.replace(/::[\w-]+/g, '');

  for (const match of simple.matchAll(/:not\(([^)]+)\)/g)) {
    if (matchesSimpleSelector(match[1], { ...element, pseudo: undefined })) return false;
  }
  simple = simple.replace(/:not\([^)]+\)/g, '');

  for (const match of simple.matchAll(/:(?!:)([\w-]+)/g)) {
    const state = match[1];
    if (state === 'root') {
      if (element.tag !== 'html') return false;
    } else if (!element.states.has(state)) {
      return false;
    }
  }
  simple = simple.replace(/:(?!:)[\w-]+/g, '');

  for (const match of simple.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (!(match[1] in element.attributes)) return false;
    if (match[2] !== undefined && element.attributes[match[1]] !== match[2]) return false;
  }
  simple = simple.replace(/\[[^\]]+\]/g, '');

  const id = simple.match(/#([\w-]+)/)?.[1];
  if (id && id !== element.id) return false;
  for (const className of [...simple.matchAll(/\.([\w-]+)/g)].map((match) => match[1])) {
    if (!element.classes.has(className)) return false;
  }
  const tag = simple.match(/^[a-z][\w-]*/i)?.[0]?.toLowerCase();
  return !tag || tag === element.tag;
}

function matchesSelector(selector, element) {
  if (/[+~]/.test(selector)) return false;
  const parts = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
  let index = parts.length - 1;
  let current = element;
  if (!matchesSimpleSelector(parts[index], current)) return false;
  index -= 1;
  while (index >= 0) {
    const direct = parts[index] === '>';
    if (direct) index -= 1;
    const expected = parts[index];
    current = current.parent;
    if (direct) {
      if (!current || !matchesSimpleSelector(expected, current)) return false;
    } else {
      while (current && !matchesSimpleSelector(expected, current)) current = current.parent;
      if (!current) return false;
    }
    index -= 1;
  }
  return true;
}

function mediaMatches(queries, environment) {
  return queries.every((query) => {
    if (/^print$/i.test(query)) return environment.medium === 'print';
    if (/pointer:\s*coarse/.test(query)) return environment.pointer === 'coarse';
    if (/prefers-reduced-motion:\s*reduce/.test(query)) return environment.reducedMotion;
    if (/forced-colors:\s*active/.test(query)) return environment.forcedColors;
    const maximum = Number(query.match(/max-width:\s*(\d+)px/)?.[1]);
    if (Number.isFinite(maximum)) return environment.width <= maximum;
    return false;
  });
}

const cssRules = parseCssRules(css);
const rootVariables = Object.fromEntries(
  cssRules
    .filter(({ selector, media }) => selector === ':root' && media.length === 0)
    .flatMap(({ declarations }) => declarations)
    .filter(({ property }) => property.startsWith('--'))
    .map(({ property, value }) => [property, value]),
);

function resolveCssValue(value) {
  let resolved = value;
  for (let pass = 0; pass < 8 && /var\(/.test(resolved); pass += 1) {
    resolved = resolved.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fallback) =>
      rootVariables[name] ?? fallback ?? `var(${name})`
    );
  }
  return resolved;
}

function computedStyle(element, environment = {}) {
  const env = {
    width: 1440, pointer: 'fine', medium: 'screen', reducedMotion: false,
    forcedColors: false, ...environment,
  };
  const winners = new Map();
  for (const rule of cssRules) {
    if (!mediaMatches(rule.media, env) || !matchesSelector(rule.selector, element)) continue;
    const weight = specificity(rule.selector);
    for (const declaration of rule.declarations) {
      const previous = winners.get(declaration.property);
      const wins = !previous ||
        Number(declaration.important) > Number(previous.important) ||
        (declaration.important === previous.important && (
          compareSpecificity(weight, previous.specificity) > 0 ||
          (compareSpecificity(weight, previous.specificity) === 0 && rule.order > previous.order)
        ));
      if (wins) winners.set(declaration.property, {
        ...declaration, specificity: weight, order: rule.order, selector: rule.selector,
      });
    }
  }
  return Object.fromEntries(
    [...winners].map(([property, declaration]) => [property, resolveCssValue(declaration.value)]),
  );
}

function effectiveDisplay(element, environment = {}) {
  const declared = computedStyle(element, environment).display;
  if (declared) return declared;
  if ('hidden' in element.attributes) return 'none';
  return ['article', 'aside', 'div', 'figure', 'footer', 'form', 'header', 'main', 'nav', 'section']
    .includes(element.tag) ? 'block' : 'inline';
}

function luminance(hex) {
  const channels = hex.replace('#', '').match(/[\da-f]{2}/gi)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function textById(id) {
  const match = html.match(
    new RegExp(`<([a-z][\\w:-]*)\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'),
  );
  assert.ok(match, id);
  return match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const elements = parseElements(html);
const elementsById = new Map();
for (const element of elements.filter(({ attributes }) => attributes.id)) {
  const matches = elementsById.get(element.attributes.id) ?? [];
  matches.push(element);
  elementsById.set(element.attributes.id, matches);
}

test('la aplicación contiene las cuatro vistas del producto', () => {
  for (const vista of ['inicio', 'diagnostico', 'atlas', 'metodo']) {
    assert.match(html, new RegExp(`data-view="${vista}"`));
    assert.match(html, new RegExp(`id="tab-${vista}"`));
  }
  assert.equal((html.match(/data-view="/g) ?? []).length, 4);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 4);
  assert.equal((html.match(/data-step="/g) ?? []).length, 4);
});

test('los cuatro fieldsets comparten IDs y lenguaje con el contrato de pasos', () => {
  const fieldsets = elements.filter(
    ({ tag, attributes }) => tag === 'fieldset' && 'data-step' in attributes,
  );
  assert.deepEqual(
    fieldsets.map(({ attributes }) => attributes['data-step']),
    ['contexto', 'consumo', 'generacion', 'economia'],
  );

  const legends = [...html.matchAll(
    /<fieldset\b[^>]*data-step="[^"]+"[^>]*>[\s\S]*?<legend>([^<]+)<\/legend>/gi,
  )].map((match) => match[1].trim());
  assert.deepEqual(legends, [
    'Contexto',
    'Comunidad y consumo',
    'Generación',
    'Economía y revisión',
  ]);
});

test('Inicio explica producto, audiencias y comunidad', () => {
  for (const id of [
    'inicio-hero',
    'selector-audiencia',
    'comunidad-sistema',
    'entregables-cera',
    'prueba-producto',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  for (const audiencia of ['ayuntamiento', 'cooperativa', 'particular', 'empresa']) {
    assert.match(html, new RegExp(`data-audience="${audiencia}"`), audiencia);
  }
  assert.equal((html.match(/data-audience="/g) ?? []).length, 4);
  assert.match(html, /Entender si una comunidad energética tiene sentido antes de encargar el proyecto/);
  assert.match(html, /Activos[\s\S]*Participantes[\s\S]*Consumo[\s\S]*Red/);
  assert.match(html, /complementariedad|complementarios/i);
  assert.match(html, /generación local compartida|compartir generación/i);
  assert.match(html, /Ejemplo/);
});

test('IDs, labels y referencias ARIA resuelven a un único elemento', () => {
  for (const [id, matches] of elementsById) {
    assert.equal(matches.length, 1, `id duplicado: ${id}`);
  }

  for (const element of elements) {
    for (const attribute of ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
      const references = element.attributes[attribute]?.split(/\s+/).filter(Boolean) ?? [];
      for (const reference of references) {
        assert.equal(
          elementsById.get(reference)?.length,
          1,
          `${element.tag}[${attribute}] -> #${reference}`,
        );
      }
    }
  }

  const labels = elements.filter(({ tag, attributes }) => tag === 'label' && attributes.for);
  for (const control of elements.filter(({ tag, attributes }) =>
    ['input', 'select', 'textarea'].includes(tag) &&
    attributes.id &&
    attributes.type !== 'hidden'
  )) {
    assert.equal(
      labels.filter(({ attributes }) => attributes.for === control.attributes.id).length,
      1,
      `label de #${control.attributes.id}`,
    );
  }
});

test('cada pestaña controla un tabpanel real y el panel referencia una pestaña válida', () => {
  const tablists = elements.filter(({ attributes }) => attributes.role === 'tablist');
  const tabs = elements.filter(({ attributes }) => attributes.role === 'tab');
  const panels = elements.filter(({ attributes }) => attributes.role === 'tabpanel');
  assert.deepEqual(
    tablists.map(({ attributes }) => attributes['aria-label']),
    ['Vistas de CERA', 'Tipo de análisis'],
  );
  assert.equal(tabs.length, 8);
  assert.equal(panels.length, 5);

  for (const tab of tabs) {
    const [panel] = elementsById.get(tab.attributes['aria-controls']) ?? [];
    assert.equal(panel?.attributes.role, 'tabpanel', `tabpanel de #${tab.attributes.id}`);
  }
  for (const panel of panels) {
    const [tab] = elementsById.get(panel.attributes['aria-labelledby']) ?? [];
    assert.equal(tab?.attributes.role, 'tab', `tab de #${panel.attributes.id}`);
    assert.equal(tab?.attributes['aria-controls'], panel.attributes.id);
  }
});

test('desktop y móvil ofrecen cuatro destinos sincronizables con toque mínimo', () => {
  const mobileButtons = elements.filter(({ attributes }) =>
    (attributes.class ?? '').split(/\s+/).includes('mobile-nav__button')
  );
  assert.deepEqual(
    mobileButtons.map(({ attributes }) => attributes['data-view-target']),
    ['inicio', 'diagnostico', 'atlas', 'metodo'],
  );
  assert.ok(mobileButtons.every(({ attributes }) => attributes['aria-label']?.length > 3));
  for (const button of mobileButtons) {
    const styleNode = elementNode({
      tag: button.tag,
      id: button.attributes.id,
      classes: (button.attributes.class ?? '').split(/\s+/).filter(Boolean),
      attributes: button.attributes,
    });
    assert.equal(
      computedStyle(styleNode, { width: 390 })['min-height'],
      '44px',
      button.attributes.id,
    );
  }
  const mobileNavSource = elements.find(({ attributes }) =>
    (attributes.class ?? '').split(/\s+/).includes('mobile-nav')
  );
  const mobileNav = elementNode({
    tag: mobileNavSource.tag,
    classes: (mobileNavSource.attributes.class ?? '').split(/\s+/).filter(Boolean),
    attributes: mobileNavSource.attributes,
  });
  assert.equal(computedStyle(mobileNav, { width: 390 }).position, 'fixed');
  assert.equal(computedStyle(mobileNav, { width: 768 }).display, 'none');
});

test('el formulario contiene las entradas trazables del motor v2', () => {
  const ids = [
    'tipoUsuario', 'objetivo', 'zonaId', 'superficieM2', 'tipoSuperficie',
    'consumoAnualKwh', 'potenciaContratadaKw', 'participantes', 'perfilConsumo', 'perfilArchivo',
    'precioElectricidad', 'precioExcedentes', 'fraccionSuperficieUtil', 'inclinacionDeg', 'azimutDeg',
    'perdidasPct', 'estrategiaDimensionado', 'capexPorKwp', 'opexPctCapex', 'degradacionPct',
    'tasaDescuentoPct', 'vidaUtilAnios',
  ];
  for (const id of ids) {
    assert.match(html, new RegExp(`id="${id}"`), id);
    assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `label:${id}`);
  }
  assert.match(html, /id="opexPctCapex"[\s\S]*?value="2"/);
  assert.match(html, /id="perfilArchivo"[^>]*aria-describedby="perfil-archivo-ayuda perfil-archivo-estado"/);
  assert.match(html, /id="perfil-archivo-estado"[^>]*role="status"/);
});

test('perfiles sintéticos y densidades geométricas son visibles', () => {
  assert.match(html, /Perfil sintético CERA/);
  assert.match(html, /Sustitúyelo por un CSV local para usar datos propios/);
  for (const text of [
    'Cubierta · 5,0 m²/kWp',
    'Aparcamiento · 6,5 m²/kWp',
    'Suelo · 8,0 m²/kWp',
  ]) {
    assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(html, /perfil oficial/i);
});

test('el default v2 de participantes admite doce y conserva el máximo público', () => {
  const control = html.match(
    /<input\b(?=[^>]*id="participantes")[^>]*>/s,
  )?.[0];
  assert.ok(control, 'participantes');
  const participantes = Number(control.match(/\bvalue="([^"]+)"/)?.[1]);
  const maximo = Number(control.match(/\bmax="([^"]+)"/)?.[1]);
  const errores = validar({
    tipoUsuario: 'ayuntamiento', objetivo: 'activar-activos', zonaId: 'centro',
    consumoAnualKwh: 25000, potenciaContratadaKw: 15, superficieM2: 200,
    tipoSuperficie: 'cubierta', participantes, perfilConsumo: 'mixto',
    precioElectricidad: 0.18, precioExcedentes: 0.06, fraccionSuperficieUtil: 0.75,
    inclinacionDeg: 38, azimutDeg: -3, perdidasPct: 14,
    estrategiaDimensionado: 'equilibrio', capexPorKwp: 1100, opexPctCapex: 2,
    degradacionPct: 0.5, tasaDescuentoPct: 3, vidaUtilAnios: 25,
  });

  assert.equal(errores.participantes, undefined);
  assert.equal(participantes, 12);
  assert.equal(maximo, 1000);
  assert.equal(textById('revision-comunidad'), '12 participantes · equilibrio recomendado');
  assert.equal(textById('resumen-comunidad'), '12 participantes · equilibrio recomendado');
});

test('el nuevo HTML conserva el contrato completo del motor y del informe', () => {
  const ids = [
    'formulario',
    'consumoAnualKwh',
    'potenciaContratadaKw',
    'superficieM2',
    'tipoSuperficie',
    'participantes',
    'precioElectricidad',
    'resultados',
    'veredicto',
    'veredicto-texto',
    'r-ahorro',
    'r-potencia',
    'r-produccion',
    'impacto-emisiones',
    'r-cobertura',
    'r-payback',
    'r-inversion',
    'r-reparto',
    'avisos',
    'hipotesis',
    'lista-hipotesis',
    'print-entradas',
  ];
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(html, /<input[^>]*type="hidden"[^>]*name="escenario"/);
});

test('el resultado separa decisión, técnica, economía y madurez', () => {
  for (const id of [
    'r-autoconsumo', 'r-cobertura', 'r-excedentes', 'r-van', 'r-lcoe', 'r-payback-desc',
    'grafico-horario', 'grafico-horario-texto', 'grafico-mensual', 'grafico-mensual-texto',
    'tabla-escenarios', 'tabla-sensibilidad', 'matriz-madurez',
    'lista-hipotesis', 'lista-formulas', 'lista-fuentes', 'siguiente-paso-audiencia',
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /Calculado/);
  assert.match(html, /Estimado/);
  assert.match(html, /Dato pendiente/);
  assert.match(html, /Validación técnica/);
  assert.ok(elementsById.has('titulo-siguiente-paso'));
  assert.ok(elementsById.has('accion-siguiente-paso'));
});

test('el resultado reserva un pasaporte semántico y Método condiciona regulación', () => {
  assert.match(
    html,
    /<section[^>]*id="pasaporte"[^>]*aria-labelledby="titulo-pasaporte"[\s\S]*?<p class="view-location">Entregable · Predesarrollo<\/p>[\s\S]*?<h2 id="titulo-pasaporte">Pasaporte del escenario<\/h2>[\s\S]*?<p id="pasaporte-resumen"><\/p>[\s\S]*?<div id="pasaporte-secciones" class="passport-grid"><\/div>/,
  );
  for (const id of ['pasaporte', 'titulo-pasaporte', 'pasaporte-resumen', 'pasaporte-secciones']) {
    assert.ok(elementsById.has(id), id);
  }
  assert.match(html, /Regla general[\s\S]*?inferior a 500 m/i);
  assert.match(html, /inferior a 5\.000 m[\s\S]*?hasta 5 MW[\s\S]*?conectad[ao]s? a través de red/i);
  assert.match(html, /gestor de autoconsumo[\s\S]*?modalidad[\s\S]*?puntos de medida[\s\S]*?coeficientes de reparto/i);
  assert.match(html, /tierra de cultivo o cultivo permanente[\s\S]*?actividad\s+agraria[\s\S]*?principal/i);
  for (const sourceId of ['BOE-A-2026-6544', 'BOE-A-2025-20583']) {
    assert.match(html, new RegExp(`href="https://www\\.boe\\.es/[^"]*${sourceId}`));
  }
});

test('el impacto climático queda pendiente sin cálculo ni afirmación de kg evitados', () => {
  assert.match(textById('impacto-emisiones'), /Dato pendiente/i);
  assert.match(textById('impacto-emisiones'), /factor de emisiones no incorporado/i);
  for (const source of [html, app, calculoV2, readme, casoEstudio]) {
    assert.doesNotMatch(source, /r-co2|co2EvitadoKg|factorCo2KgKwh|kg\s*CO₂|emisiones evitadas/i);
  }
});

test('la documentación pública describe v2 y excluye hipótesis y salidas climáticas obsoletas', () => {
  const documentacion = `${readme}\n${casoEstudio}`;
  assert.match(documentacion, /288/);
  assert.match(documentacion, /intersecci[oó]n temporal/i);
  assert.match(documentacion, /autoconsumo[\s\S]*cobertura|cobertura[\s\S]*autoconsumo/i);
  assert.match(documentacion, /tres escenarios/i);
  assert.match(documentacion, /VAN/);
  assert.match(documentacion, /LCOE/);
  assert.match(documentacion, /retorno descontado/i);
  assert.match(documentacion, /O&M[^\n]*2\s*%[^\n]*editable/i);
  assert.match(documentacion, /alcance preliminar|previabilidad/i);
  assert.match(documentacion, /Dato pendiente/i);
  assert.match(documentacion, /factor de emisiones[^\n]*(?:fecha|tratamiento de excedentes)/i);
  assert.doesNotMatch(documentacion, /\b65\s*%/i);
  assert.doesNotMatch(documentacion, /\b0[,.]18\b/);
  assert.doesNotMatch(documentacion, /emisiones? evitadas?|CO₂ evitado/i);
});

test('el flujo presenta dos balances con denominadores explícitos', () => {
  assert.match(textById('grafico'), /Destino de la generación/i);
  assert.match(textById('grafico'), /Cobertura de la demanda/i);
  for (const id of [
    'barra-generacion-autoconsumo', 'barra-generacion-excedentes',
    'barra-demanda-solar', 'barra-demanda-red',
    'valor-generacion-autoconsumo', 'valor-generacion-excedentes',
    'valor-demanda-solar', 'valor-demanda-red',
  ]) assert.ok(elementsById.has(id), id);
  assert.doesNotMatch(textById('grafico'), /porcentajes se comparan con el consumo introducido/i);
});

test('Atlas confirma cambios y Método conserva el orden profesional', () => {
  assert.match(html, /<button[^>]*id="usar-zona"[^>]*disabled/);
  assert.match(html, /<dialog[^>]*id="confirmar-zona"/);
  const methodIds = [
    'metodo-calculo',
    'metodo-datos',
    'metodo-economia',
    'metodo-madurez',
    'metodo-proyecto',
    'metodo-privacidad',
  ];
  let previous = -1;
  for (const id of methodIds) {
    const current = html.indexOf(`id="${id}"`);
    assert.ok(current > previous, id);
    previous = current;
  }
  assert.match(html, /mes,hora,kWh/);
  assert.match(html, /procesa[^.]*en (?:este|tu) navegador/i);
});

test('los botones declaran tipo y la interfaz evita promesas indebidas', () => {
  assert.doesNotMatch(html, /<button(?![^>]*\btype=)[^>]*>/);
  assert.doesNotMatch(html, /Universidad de Oviedo|Tecnología Energética|Diseño, Verificación/i);
  assert.doesNotMatch(html, /rentabilidad garantizada|proyecto certificado|clientes satisfechos/i);
});

test('la interfaz abandona el patrón de landing promocional', () => {
  assert.doesNotMatch(html, /class="hero(?:\s|")/);
  assert.doesNotMatch(html, /Calcular mi ahorro/);
  assert.doesNotMatch(html, /inicio de sesión|testimonios|clientes/i);
});

test('cada vista tiene un único título principal asociable', () => {
  assert.equal((html.match(/<h1\b/g) ?? []).length, 4);
  assert.match(html, /href="#contenido-principal"/);
  assert.match(html, /id="contenido-principal" tabindex="-1"/);
  assert.match(html, /aria-controls="vista-inicio"/);
  assert.match(html, /aria-controls="vista-diagnostico"/);
  assert.match(html, /aria-controls="vista-atlas"/);
  assert.match(html, /aria-controls="vista-metodo"/);
  for (const vista of ['inicio', 'diagnostico', 'atlas', 'metodo']) {
    assert.match(html, new RegExp(`id="tab-${vista}"`));
    assert.match(
      html,
      new RegExp(
        `id="vista-${vista}"[\\s\\S]*?aria-labelledby="tab-${vista}"`,
      ),
    );
  }
});

test('el CSS declara exactamente el sistema profesional aprobado', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(rootVariables).filter(([name]) => [
      '--ink', '--forest', '--mineral', '--white', '--solar', '--cantabrian',
      '--fern', '--amber', '--rust', '--muted', '--line',
    ].includes(name))),
    {
      '--ink': '#102820', '--forest': '#164A3B', '--mineral': '#F4F5F1',
      '--white': '#FFFFFF', '--solar': '#F1C644', '--cantabrian': '#2D6875',
      '--fern': '#2F704B', '--amber': '#A66A21', '--rust': '#A14838',
      '--muted': '#52635A', '--line': '#CBD3CE',
    },
  );
  assert.ok(contrast(rootVariables['--muted'], rootVariables['--mineral']) >= 4.5);
  assert.ok(contrast(rootVariables['--muted'], rootVariables['--white']) >= 4.5);
});

test('Inicio usa composición editorial de producto y no una pared de tarjetas', () => {
  const home = computedStyle(elementNode({ classes: ['product-home'] }));
  const hero = computedStyle(elementNode({ classes: ['product-hero'] }));
  const proof = computedStyle(elementNode({ classes: ['product-proof'] }));
  assert.equal(home.width, 'min(100% - 48px, 1440px)');
  assert.equal(hero['grid-template-columns'], 'minmax(0, 5fr) minmax(0, 7fr)');
  assert.equal(proof.background, rootVariables['--white']);
  assert.equal(proof.border, '1px solid color-mix(in srgb, #102820 16%, transparent)');
  assert.ok(!('backdrop-filter' in proof));
  assert.ok(!('box-shadow' in proof));
});

test('Método tiene cobertura CSS editorial y estados de confianza equivalentes a Resultados', () => {
  const criticalClasses = [
    'method-layout', 'method-section', 'formula-list', 'maturity-matrix',
    'atlas-layout', 'atlas-reading', 'atlas-legend', 'atlas-zone-list',
    'diagnostic-layout', 'product-proof',
  ];
  for (const className of criticalClasses) {
    assert.ok(
      elements.some(({ attributes }) => attributes.class?.split(/\s+/).includes(className)),
      `DOM .${className}`,
    );
    assert.ok(
      cssRules.some(({ selector }) => new RegExp(`\\.${className}(?![\\w-])`).test(selector)),
      `CSS .${className}`,
    );
  }
  const method = html.match(/<section\b[^>]*id="metodo-madurez"[\s\S]*?<\/section>/i)?.[0];
  assert.ok(method, 'metodo-madurez');
  for (const state of ['calculado', 'estimado', 'dato-pendiente', 'validacion-tecnica']) {
    assert.match(method, new RegExp(`data-confidence="${state}"`), state);
  }
  const methodSection = computedStyle(elementNode({ classes: ['method-section'] }));
  const formulaList = computedStyle(elementNode({ tag: 'dl', classes: ['formula-list'] }));
  assert.equal(methodSection['border-bottom'], `1px solid ${rootVariables['--line']}`);
  assert.equal(formulaList['border-top'], `1px solid ${rootVariables['--line']}`);
  assert.ok(cssRules.every(({ selector }) => !/\.support-(?:section|table|disclaimer)/.test(selector)));
});

test('diagnóstico, resultados y Atlas resuelven jerarquía y confianza sin depender del color', () => {
  assert.equal(
    computedStyle(elementNode({ classes: ['diagnostic-layout'] }))['grid-template-columns'],
    '248px minmax(0, 1fr) 320px',
  );
  assert.equal(computedStyle(elementNode({ classes: ['diagnostic-form'] }))['max-width'], '760px');
  assert.equal(
    computedStyle(elementNode({ classes: ['atlas-layout'] }))['grid-template-columns'],
    '260px minmax(0, 1fr) 320px',
  );
  assert.ok(html.indexOf('class="atlas-data"') < html.indexOf('id="usar-zona"'));
  for (const [state, textColor, markerColor] of [
    ['calculado', '--fern', '--fern'], ['estimado', '--cantabrian', '--cantabrian'],
    ['dato-pendiente', '--ink', '--amber'], ['validacion-tecnica', '--rust', '--rust'],
  ]) {
    const attributes = { 'data-confidence': state };
    const label = computedStyle(elementNode({ tag: 'span', attributes }));
    const marker = computedStyle(elementNode({ tag: 'span', attributes, pseudo: 'before' }));
    assert.equal(label.color, rootVariables[textColor], `texto ${state}`);
    assert.equal(marker.color, rootVariables[markerColor], `marcador ${state}`);
    assert.ok(contrast(label.color, rootVariables['--white']) >= 4.5, `${state}/white`);
    assert.ok(contrast(label.color, rootVariables['--mineral']) >= 4.5, `${state}/mineral`);
  }
  assert.match(html, /id="grafico-horario-texto"/);
  assert.match(html, /id="grafico-mensual-texto"/);
});

test('la cascada del enlace fuente Atlas conserva contraste, foco y toque accesibles', () => {
  const atlas = elementNode({ tag: 'aside', classes: ['atlas-reading'] });
  const note = elementNode({ tag: 'p', classes: ['source-note'], parent: atlas });
  const link = elementNode({ tag: 'a', id: 'rp-fuente', parent: note });
  const focused = elementNode({ tag: 'a', id: 'rp-fuente', states: ['focus-visible'], parent: note });
  const normalStyle = computedStyle(link);
  const focusStyle = computedStyle(focused);
  const background = computedStyle(atlas).background;
  assert.equal(normalStyle.color, rootVariables['--solar']);
  assert.ok(contrast(normalStyle.color, background) >= 4.5);
  assert.equal(normalStyle['min-height'], '44px');
  assert.equal(normalStyle.display, 'inline-flex');
  assert.equal(focusStyle.outline, `3px solid ${rootVariables['--solar']}`);
  assert.ok(Number.parseFloat(focusStyle['outline-offset']) >= 3);
});

test('responsive declara reflow estructural sin ocultar overflow global', () => {
  const compact = { width: 959 };
  assert.equal(computedStyle(elementNode({ classes: ['diagnostic-layout'] }), compact)['grid-template-columns'], '1fr');
  assert.equal(computedStyle(elementNode({ classes: ['atlas-layout'] }), compact)['grid-template-columns'], '1fr');

  for (const width of [320, 375]) {
    const environment = { width };
    assert.equal(computedStyle(elementNode({ tag: 'html' }), environment)['overflow-x'], undefined);
    assert.equal(computedStyle(elementNode({ tag: 'body' }), environment)['overflow-x'], undefined);
    assert.equal(computedStyle(elementNode({ classes: ['product-home'] }), environment).width, 'min(100% - 32px, 1440px)');
    assert.equal(computedStyle(elementNode({ classes: ['product-hero'] }), environment)['grid-template-columns'], '1fr');
    assert.equal(computedStyle(elementNode({ tag: 'h1', parent: elementNode({ classes: ['product-hero'] }) }), environment)['max-width'], '11ch');
    assert.equal(computedStyle(elementNode({ tag: 'h1', parent: elementNode({ classes: ['product-hero'] }) }), environment)['font-size'], 'clamp(36px, 10.2vw, 48px)');
    assert.equal(computedStyle(elementNode({ classes: ['atlas-layout'] }), environment)['grid-template-columns'], '1fr');
    assert.equal(computedStyle(elementNode({ classes: ['atlas-zone-list'] }), environment)['grid-template-columns'], '1fr');
    for (const className of ['atlas-selector', 'atlas-map-panel', 'atlas-reading']) {
      const minimum = computedStyle(elementNode({ classes: [className] }), environment)['min-width'];
      assert.ok(minimum === undefined || minimum === '0', `${className}: ${minimum}`);
    }
    const table = elementNode({ tag: 'table', classes: ['comparison-table'] });
    const tbody = elementNode({ tag: 'tbody', parent: table });
    assert.equal(computedStyle(elementNode({ classes: ['table-scroll'] }), environment)['overflow-x'], 'auto');
    assert.equal(computedStyle(table, environment).display, 'block');
    assert.equal(computedStyle(tbody, environment).display, 'block');
  }

  for (const [selector, property] of [
    ['.diagnostic-layout', 'grid-template-columns'],
    ['.atlas-layout', 'grid-template-columns'],
    ['.scenario-summary', 'grid-column'],
    ['.atlas-reading', 'grid-column'],
  ]) {
    const declarations = cssRules.filter(({ selector: candidate, media }) =>
      candidate === selector && media.includes('(max-width: 959px)')
    ).flatMap(({ declarations: entries }) => entries.filter(({ property: name }) => name === property));
    assert.equal(declarations.length, 1, `${selector} ${property}: ${declarations.length}`);
  }
});

test('interacción, movimiento, alto contraste e impresión siguen reglas efectivas', () => {
  const durations = cssRules.flatMap(({ declarations }) => declarations)
    .flatMap(({ value }) => [...value.matchAll(/(?<![\d.])(\d{3,})ms\b/g)])
    .map((match) => Number(match[1]));
  assert.deepEqual(durations.filter((duration) => duration > 250), []);
  for (const selector of ['.flow-fill', '.monthly-balance-bin i', '.month-bar__value']) {
    const transitions = cssRules.filter((rule) => rule.selector === selector)
      .flatMap(({ declarations }) => declarations)
      .filter(({ property }) => property === 'transition');
    assert.ok(transitions.every(({ value }) => !/\b(?:width|height)\b/.test(value)), selector);
  }

  const hiddenResults = elementNode({ tag: 'section', classes: ['results'], attributes: { hidden: '' } });
  const visibleResults = elementNode({ tag: 'section', classes: ['results'] });
  assert.equal(effectiveDisplay(hiddenResults, { medium: 'print' }), 'none');
  assert.equal(effectiveDisplay(visibleResults, { medium: 'print' }), 'block');
  assert.ok(elementsById.get('resultados')?.[0]?.attributes.hidden !== undefined);
  assert.equal(
    computedStyle(elementNode({ tag: 'section', id: 'vista-atlas' }), { medium: 'print' }).display,
    'none',
  );
  assert.equal(
    computedStyle(elementNode({ tag: 'a', classes: ['skip-link'] }), { medium: 'print' }).display,
    'none',
  );
  for (const required of [
    '(prefers-reduced-motion: reduce)', '(forced-colors: active)', 'print', '(pointer: coarse)',
  ]) assert.ok(cssRules.some(({ media }) => media.includes(required)), required);
});

test('Atlas usa escala discreta canónica y etiquetas esenciales legibles', () => {
  const map = elementNode({ id: 'mapa-recurso' });
  const fills = [];
  for (let zone = 0; zone < 8; zone += 1) {
    fills.push(computedStyle(elementNode({ tag: 'path', attributes: { 'data-zona': String(zone) }, parent: map })).fill);
  }
  const approved = new Set(Object.values(rootVariables));
  assert.ok(fills.every((fill) => approved.has(fill)), fills.join(', '));
  assert.equal(new Set(fills).size, 4);
  assert.equal((html.match(/class="atlas-legend__step"/g) ?? []).length, 4);

  const labelNodes = [
    elementNode({ classes: ['atlas-selector__count'] }),
    elementNode({ classes: ['atlas-reading__label'] }),
    elementNode({ classes: ['month-bar__label'] }),
    elementNode({ classes: ['atlas-legend'] }),
    elementNode({ classes: ['technical-chart__plot'], pseudo: 'before' }),
  ];
  for (const node of labelNodes) {
    assert.ok(Number.parseFloat(computedStyle(node)['font-size']) >= 11, [...node.classes].join(','));
  }
});

test('la auditoría de declaraciones bloquea radios, glass, gradientes y slop', () => {
  const declarations = cssRules.flatMap(({ declarations }) => declarations);
  const radii = declarations.filter(({ property }) => property === 'border-radius')
    .map(({ value }) => value.match(/^(\d+(?:\.\d+)?)px$/)?.[1])
    .filter(Boolean).map(Number);
  assert.ok(radii.every((radius) => radius <= 16), `radios: ${radii.filter((radius) => radius > 16)}`);
  assert.ok(declarations.every(({ value }) => !/\b(?:repeating-)?linear-gradient\(/.test(value)));
  assert.ok(declarations.every(({ property }) => property !== 'backdrop-filter'));
  assert.ok(declarations.every(({ property, value }) => !/background-clip/.test(property) || value !== 'text'));
  assert.ok(declarations.every(({ property, value }) => property !== 'font-family' || !/\bInter\b/i.test(value)));
  assert.ok(declarations.every(({ value }) => !/#000(?:000)?\b/i.test(value)));
});

test('Atlas coarse usa la lista y retira semántica interactiva de paths; fine la conserva', async () => {
  const production = await import('../js/app.js');
  assert.equal(typeof production.configurarInteraccionMapaAtlas, 'function');
  assert.equal(typeof production.actualizarEstadoPathAtlas, 'function');

  function fakePath(zone) {
    const attributes = new Map([['data-zona', String(zone)]]);
    const listeners = new Map();
    return {
      dataset: { zona: String(zone) }, attributes, listeners,
      classList: { toggle() {} },
      querySelector: () => ({ textContent: `Zona ${zone}` }),
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: (name) => attributes.get(name) ?? null,
      removeAttribute: (name) => attributes.delete(name),
      addEventListener: (type, listener) => listeners.set(type, listener),
    };
  }

  const finePath = fakePath(0);
  const coarsePath = fakePath(1);
  const selected = [];
  production.configurarInteraccionMapaAtlas({
    svg: { querySelectorAll: () => [finePath] },
    coarsePointer: false,
    seleccionar: (zone) => selected.push(zone.id),
  });
  assert.equal(finePath.getAttribute('role'), 'button');
  assert.equal(finePath.getAttribute('tabindex'), '0');
  assert.deepEqual([...finePath.listeners.keys()].sort(), ['click', 'focus', 'keydown']);
  finePath.listeners.get('click')();
  assert.equal(selected.length, 1);
  production.actualizarEstadoPathAtlas(finePath, true);
  assert.equal(finePath.getAttribute('aria-pressed'), 'true');

  production.configurarInteraccionMapaAtlas({
    svg: { querySelectorAll: () => [coarsePath] },
    coarsePointer: true,
    seleccionar: () => assert.fail('path coarse no selecciona'),
  });
  production.actualizarEstadoPathAtlas(coarsePath, true);
  assert.equal(coarsePath.getAttribute('role'), null);
  assert.equal(coarsePath.getAttribute('tabindex'), null);
  assert.equal(coarsePath.getAttribute('aria-pressed'), null);
  assert.deepEqual([...coarsePath.listeners.keys()], []);

  const map = elementNode({ id: 'mapa-recurso' });
  const coarseStyle = computedStyle(elementNode({ tag: 'path', parent: map }), { pointer: 'coarse' });
  const list = elementNode({ classes: ['atlas-zone-list'] });
  const button = elementNode({ tag: 'button', parent: list });
  assert.equal(coarseStyle['pointer-events'], 'none');
  assert.ok(Number.parseFloat(computedStyle(button, { pointer: 'coarse' })['min-height']) >= 48);
});

test('el corte v2 retira compatibilidad oculta y restaura doce participantes', () => {
  assert.doesNotMatch(html, /<input[^>]*type="hidden"[^>]*name="escenario"/);
  const control = html.match(/<input\b(?=[^>]*id="participantes")[^>]*>/s)?.[0];
  assert.ok(control, 'participantes');
  assert.equal(control.match(/\bvalue="([^"]+)"/)?.[1], '12');
  assert.equal(control.match(/\bmax="([^"]+)"/)?.[1], '1000');
  assert.equal(textById('revision-comunidad'), '12 participantes · equilibrio recomendado');
  assert.equal(textById('resumen-comunidad'), '12 participantes · equilibrio recomendado');
});

test('la lectura de formulario contiene todos los campos v2 y porcentajes correctos', () => {
  for (const campo of [
    'tipoUsuario', 'objetivo', 'zonaId', 'consumoAnualKwh',
    'potenciaContratadaKw', 'superficieM2', 'tipoSuperficie',
    'participantes', 'perfilConsumo', 'precioElectricidad',
    'precioExcedentes', 'fraccionSuperficieUtil', 'inclinacionDeg',
    'azimutDeg', 'perdidasPct', 'estrategiaDimensionado', 'capexPorKwp',
    'opexPctCapex', 'degradacionPct', 'tasaDescuentoPct', 'vidaUtilAnios',
  ]) assert.match(app, new RegExp(`['"]${campo}['"]`), campo);
  assert.match(app, /fraccionSuperficieUtil[\s\S]*\/\s*100/);
  assert.doesNotMatch(app, /opexPctCapex[\s\S]{0,80}\/\s*100/);
});

test('el atlas usa el módulo territorial sin gráfico de anillo', () => {
  assert.match(app, /from '\.\/atlas\.js'/);
  assert.match(app, /async function montarAtlas\(/);
  assert.match(app, /comparacionRegional/);
  assert.match(app, /concejoCoincidente/);
  assert.doesNotMatch(app, /svgRosco|rp-rosco/);
});

test('la ilustración generativa está integrada como activo local', async () => {
  assert.match(html, /assets\/cera-mesa-territorial\.png/);
  const url = new URL('../assets/cera-mesa-territorial.png', import.meta.url);
  const info = await stat(url);
  assert.ok(info.size > 100_000);
  const bytes = await readFile(url);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
});

test('la PWA precarga el rediseño y cierra recursivamente el grafo ES de app.js', async () => {
  assert.match(sw, /const CACHE = 'cera-pasaporte-v1'/);
  for (const recurso of [
    'css/styles.css',
    'js/app.js',
    'js/pasaporte.js',
    'js/trazabilidad.js',
    'js/calculo.js',
    'js/ui-state.js',
    'js/atlas.js',
    'assets/mapa-asturias.svg',
    'assets/cera-mesa-territorial.png',
    'assets/fonts/geist-sans-latin.woff2',
    'assets/fonts/geist-mono-latin.woff2',
    'manifest.webmanifest',
  ]) {
    assert.match(sw, new RegExp(recurso.replaceAll('.', '\\.')), recurso);
  }

  const bloqueRecursos = sw.match(/const RECURSOS = \[([\s\S]*?)\];/)?.[1];
  assert.ok(bloqueRecursos, 'RECURSOS');
  const precache = new Set(
    [...bloqueRecursos.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]),
  );
  const raiz = new URL('../', import.meta.url);
  const alcanzables = new Set();
  async function recorrer(url) {
    const recurso = decodeURIComponent(url.href.slice(raiz.href.length));
    if (alcanzables.has(recurso)) return;
    alcanzables.add(recurso);
    const source = await readFile(url, 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+\.js)['"]/g)]
      .map((match) => new URL(match[1], url));
    await Promise.all(imports.map(recorrer));
  }
  await recorrer(new URL('js/app.js', raiz));
  assert.deepEqual(
    [...alcanzables].filter((recurso) => !precache.has(recurso)),
    [],
    `faltan módulos en precache: ${[...alcanzables].filter((recurso) => !precache.has(recurso)).join(', ')}`,
  );
  for (const modulo of [
    'js/calculo-v2.js', 'js/ui-state-v2.js', 'js/balance-energetico.js',
    'js/economia.js', 'js/perfiles-consumo.js', 'js/producto.js', 'js/solar-data.js',
    'js/pasaporte.js', 'js/trazabilidad.js',
  ]) assert.ok(precache.has(modulo), modulo);

  assert.equal(manifest.name, 'CERA — Mesa territorial solar');
  assert.equal(manifest.background_color, '#F5F6F3');
  assert.equal(manifest.theme_color, '#102820');

  for (const fuente of ['geist-sans-latin.woff2', 'geist-mono-latin.woff2']) {
    const url = new URL(`../assets/fonts/${fuente}`, import.meta.url);
    assert.ok((await stat(url)).size > 10_000, fuente);
    const bytes = await readFile(url);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2', fuente);
  }
});

test('la superficie pública no contiene captación ni referencias corporativas', async () => {
  const paths = [
    'index.html',
    'README.md',
    'PRODUCT.md',
    'DESIGN.md',
    'css/styles.css',
  ];
  const forbidden = [
    /\benergy starter\b/i,
    /\bcera conecta\b/i,
    /\bavisar de mi interés\b/i,
    /\bfundación edp\b/i,
    /\bedp\b/i,
    /\bstart-?up(?:s)?\b/i,
    /\bcrm\b/i,
    /\blead(?:s)?\b/i,
    /\bfundación caja rural\b/i,
    /\bbecas? de excelencia\b/i,
    /\bpredevelopment\b/i,
  ];
  for (const relative of paths) {
    const content = await readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(content, pattern, `${relative} contiene ${pattern}`);
    }
  }
  await assert.rejects(
    stat(new URL('../assets/logo-fundacion-cra.svg', import.meta.url)),
    { code: 'ENOENT' },
  );
});
