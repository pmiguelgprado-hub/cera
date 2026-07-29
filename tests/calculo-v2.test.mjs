import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  LIMITES,
  calcular,
  clasificarSemaforo,
  validar,
} from '../js/calculo-v2.js';
import { fuente, supuesto } from '../js/trazabilidad.js';

const base = {
  tipoUsuario: 'ayuntamiento',
  objetivo: 'activar-activos',
  zonaId: 'centro',
  consumoAnualKwh: 25000,
  potenciaContratadaKw: 15,
  superficieM2: 200,
  tipoSuperficie: 'cubierta',
  participantes: 12,
  perfilConsumo: 'mixto',
  precioElectricidad: 0.18,
  precioExcedentes: 0.06,
  fraccionSuperficieUtil: 0.75,
  inclinacionDeg: 38,
  azimutDeg: -3,
  perdidasPct: 14,
  estrategiaDimensionado: 'equilibrio',
  capexPorKwp: 1100,
  opexPctCapex: 2,
  degradacionPct: 0.5,
  tasaDescuentoPct: 3,
  vidaUtilAnios: 25,
};

function assertNoNaN(value, path = 'result') {
  if (typeof value === 'number') {
    assert.equal(Number.isNaN(value), false, `${path} no puede ser NaN`);
    if (!Number.isFinite(value)) {
      assert.match(path, /(?:payback|lcoe)/i, `${path} no admite Infinity`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNaN(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertNoNaN(item, `${path}.${key}`));
  }
}

test('el caso central devuelve balance horario y economía descontada', () => {
  const result = calcular(base);
  assert.equal(result.ok, true);
  assert.equal(result.balance.horariaMedia.length, 24);
  assert.equal(result.balance.mensual.length, 12);
  assert.ok(result.potenciaKwp > 0);
  assert.ok(result.produccionAnualKwh > 0);
  assert.ok(result.autoconsumoKwh <= result.produccionAnualKwh);
  assert.ok(result.autoconsumoKwh <= base.consumoAnualKwh);
  assert.ok(Number.isFinite(result.vanEur));
  assert.ok(Number.isFinite(result.lcoeEurKwh));
  assert.equal(result.flujoCaja.length, 26);
});

test('el motor no calcula emisiones evitadas sin un factor incorporado y trazable', () => {
  const result = calcular(base);
  assert.equal(Object.hasOwn(CONFIG, 'factorCo2KgKwh'), false);
  assert.equal(Object.hasOwn(result, 'co2EvitadoKg'), false);
  assert.doesNotMatch(JSON.stringify(result), /co2|emisiones?\s+evitadas?/i);
});

test('el autoconsumo se deriva del cruce y no de una fracción fija', () => {
  const residential = calcular({ ...base, perfilConsumo: 'residencial' });
  const commercial = calcular({ ...base, perfilConsumo: 'comercial' });
  assert.notEqual(residential.tasaAutoconsumo, commercial.tasaAutoconsumo);
  assert.notEqual(residential.autoconsumoKwh, residential.produccionAnualKwh * 0.65);
});

test('los tres dimensionamientos tienen regla y potencia explícitas', () => {
  const result = calcular(base);
  assert.deepEqual(result.escenariosDimensionado.map(({ id }) => ({ id })), [
    { id: 'ajuste' }, { id: 'equilibrio' }, { id: 'maximo' },
  ]);
  const byId = Object.fromEntries(result.escenariosDimensionado.map((item) => [item.id, item]));
  assert.ok(byId.ajuste.potenciaKwp <= byId.maximo.potenciaKwp);
  assert.ok(byId.equilibrio.potenciaKwp <= byId.maximo.potenciaKwp);
  assert.equal(byId.ajuste.cumpleRegla, true);
  assert.match(byId.equilibrio.regla, /VAN/i);
});

test('ajuste declara fallback cuando ningún candidato alcanza 80 % de autoconsumo', () => {
  const nocturno = Array(288).fill(0);
  nocturno[0] = base.consumoAnualKwh;
  const result = calcular({
    ...base,
    estrategiaDimensionado: 'ajuste',
    perfilPersonalizado: nocturno,
  });
  const ajuste = result.escenariosDimensionado.find(({ id }) => id === 'ajuste');

  assert.equal(ajuste.cumpleRegla, false);
  assert.equal(ajuste.potenciaKwp, 1);
  assert.equal(
    ajuste.regla,
    'Ningún candidato alcanza el 80 %; se muestra la menor potencia evaluada',
  );
  assert.equal(result.cumpleRegla, false);
});

test('la corrección orientativa IDAE usa la latitud de la zona y explica su límite', () => {
  const optimal = calcular({ ...base, inclinacionDeg: 33.361, azimutDeg: 0 });
  const deviated = calcular({ ...base, inclinacionDeg: 10, azimutDeg: 80 });
  assert.equal(optimal.factorOrientacion, 1);
  assert.ok(deviated.factorOrientacion < optimal.factorOrientacion);
  assert.ok(deviated.produccionAnualKwh < optimal.produccionAnualKwh);
  assert.equal(deviated.confianza.implantacion, 'Estimado');
  assert.match(
    deviated.hipotesis.find((item) => item.startsWith('Corrección orientativa IDAE')),
    /latitud.*sombras próximas.*simulación PVGIS/i,
  );
});

test('la sensibilidad enumera qué cambia', () => {
  const result = calcular(base);
  assert.deepEqual(result.sensibilidad.map(({ id }) => id), ['conservador', 'central', 'favorable']);
  assert.ok(result.sensibilidad[0].supuestos.capexFactor > 1);
  assert.equal(result.sensibilidad[1].supuestos.capexFactor, 1);
  assert.ok(result.sensibilidad[2].supuestos.capexFactor < 1);
});

test('un perfil personalizado cambia confianza y conserva consumo', () => {
  const custom = Array(288).fill(0);
  custom[12] = base.consumoAnualKwh;
  const result = calcular({ ...base, perfilPersonalizado: custom });
  assert.equal(result.confianza.encajeEnergetico, 'Calculado');
  assert.ok(Math.abs(result.balance.consumoKwh - base.consumoAnualKwh) < 1e-6);
});

test('expone el contrato month-major y el origen del perfil sin inferir otro orden', () => {
  const reference = calcular(base);
  assert.deepEqual(reference.trazabilidadPerfil, {
    orden: 'month-major',
    recorrido: 'mes→hora',
    unidad: 'kWh',
    periodo: 'anual',
    origen: 'Perfil sintético CERA',
  });
  assert.match(reference.hipotesis.find((item) => item.startsWith('Perfil de consumo:')), /month-major.*mes→hora.*kWh.*anual/);
  assert.ok(reference.fuentes.includes('Perfil sintético CERA: Comunidad mixta'));
  assert.ok(reference.hipotesis.includes('Densidad geométrica: Cubierta · 5,0 m²/kWp · Hipótesis CERA.'));

  const custom = Array(288).fill(0);
  custom[12] = base.consumoAnualKwh;
  const local = calcular({ ...base, perfilPersonalizado: custom });
  assert.equal(local.trazabilidadPerfil.origen, 'CSV local');
  assert.ok(local.fuentes.includes('CSV local aportado por el usuario'));
});

test('la validación cubre nuevos campos y no acepta series opacas', () => {
  const errors = validar({
    ...base,
    zonaId: 'desconocida',
    perfilConsumo: 'industrial-generico',
    fraccionSuperficieUtil: 1.5,
    tasaDescuentoPct: -1,
    perfilPersonalizado: [1, 2],
  });
  assert.ok(errors.zonaId);
  assert.ok(errors.perfilConsumo);
  assert.ok(errors.fraccionSuperficieUtil);
  assert.ok(errors.tasaDescuentoPct);
  assert.ok(errors.perfilPersonalizado);
});

test('participantes y vida útil deben ser enteros antes de calcular', () => {
  assert.ok(validar({ ...base, participantes: 1.5 }).participantes);
  assert.ok(validar({ ...base, vidaUtilAnios: 25.5 }).vidaUtilAnios);

  for (const variant of [
    { participantes: 1, vidaUtilAnios: 10 },
    { participantes: 1000, vidaUtilAnios: 40 },
  ]) {
    const input = { ...base, ...variant };
    assert.deepEqual(validar(input), {});
    assert.doesNotThrow(() => calcular(input));
    assert.equal(calcular(input).ok, true);
  }
});

test('la superficie máxima aceptada calcula con candidatos finitos y razonables', () => {
  const input = {
    ...base,
    superficieM2: 100_000,
    fraccionSuperficieUtil: 1,
    tipoSuperficie: 'cubierta',
  };
  assert.deepEqual(validar(input), {});
  let result;
  assert.doesNotThrow(() => {
    result = calcular(input);
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.escenariosDimensionado.find(({ id }) => id === 'maximo').potenciaKwp,
    20_000,
  );
});

test('un perfil personalizado debe reconciliar el consumo anual sin normalización silenciosa', () => {
  const mismatch = Array(288).fill(base.consumoAnualKwh / 288);
  mismatch[0] += 0.01;
  const nonFinite = [...mismatch];
  nonFinite[0] = Number.NaN;
  const negative = [...mismatch];
  negative[0] = -1;

  for (const perfilPersonalizado of [mismatch, nonFinite, negative]) {
    assert.equal(
      validar({ ...base, perfilPersonalizado }).perfilPersonalizado,
      'El perfil personalizado debe contener 288 valores no negativos.',
    );
    assert.equal(calcular({ ...base, perfilPersonalizado }).ok, false);
  }
});

test('la sensibilidad usa la potencia seleccionada y expone multiplicadores exactos', () => {
  const result = calcular({ ...base, estrategiaDimensionado: 'maximo' });
  assert.deepEqual(result.sensibilidad.map(({ supuestos }) => supuestos), [
    { id: 'conservador', capexFactor: 1.15, compraFactor: 0.90, excedenteFactor: 0.85 },
    { id: 'central', capexFactor: 1, compraFactor: 1, excedenteFactor: 1 },
    { id: 'favorable', capexFactor: 0.90, compraFactor: 1.10, excedenteFactor: 1.10 },
  ]);
  assert.equal(result.sensibilidad[1].vanEur, result.vanEur);
  assert.equal(result.sensibilidad[1].paybackDescontadoAnios, result.paybackDescontadoAnios);
});

test('los límites exportados están congelados profundamente', () => {
  assert.equal(Object.isFrozen(LIMITES), true);
  for (const range of Object.values(LIMITES)) {
    assert.equal(Object.isFrozen(range), true);
  }
});

test('los supuestos devueltos no pueden alterar cálculos posteriores', () => {
  const first = calcular(base);
  const assumptions = first.sensibilidad[0].supuestos;
  assert.equal(Object.isFrozen(assumptions), true);
  assert.throws(() => {
    assumptions.capexFactor = 99;
  }, TypeError);

  const second = calcular(base);
  assert.deepEqual(second.sensibilidad[0].supuestos, {
    id: 'conservador',
    capexFactor: 1.15,
    compraFactor: 0.90,
    excedenteFactor: 0.85,
  });
  assert.equal(second.sensibilidad[0].vanEur, first.sensibilidad[0].vanEur);
});

test('ningún resultado calculado contiene NaN ni Infinity fuera de payback o LCOE', () => {
  for (const estrategiaDimensionado of ['ajuste', 'equilibrio', 'maximo']) {
    assertNoNaN(calcular({ ...base, estrategiaDimensionado }));
  }
});

test('publica defaults, límites, hipótesis, fuentes y confianza trazables', () => {
  const opexSourceUrl = 'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/general-information/data-sources-calculation-methods_en';
  assert.equal(CONFIG.perdidasPvgisPct, supuesto('perdidas-pvgis').valor);
  assert.equal(CONFIG.opexPctCapex, supuesto('opex-inicial').valor);
  assert.equal(CONFIG.degradacionPct, supuesto('degradacion-inicial').valor);
  assert.equal(CONFIG.sources.opexId, 'jrc-pvgis-53');
  assert.equal(CONFIG.sources.opexTitle, fuente('jrc-pvgis-53').titulo);
  assert.equal(CONFIG.sources.opexUrl, opexSourceUrl);
  assert.deepEqual(LIMITES.vidaUtilAnios, [10, 40]);
  const result = calcular(base);
  assert.ok(result.factorOrientacion > 0.99 && result.factorOrientacion < 1);
  assert.equal(result.hipotesis.length, 10);
  assert.match(result.hipotesis[0], /PVGIS 5\.3.*kWh\/kWp·año/);
  assert.match(result.hipotesis.find((item) => item.includes('O&M')), /2\.0 %.*JRC PVGIS.*https:\/\//);
  assert.match(result.hipotesis.at(-1), /no sustituye visita/i);
  assert.match(result.fuentes[0], /^https:\/\/re\.jrc\.ec\.europa\.eu/);
  assert.ok(result.fuentes.includes(opexSourceUrl));
  assert.deepEqual(result.confianza, {
    recurso: 'Calculado',
    encajeEnergetico: 'Estimado',
    implantacion: 'Estimado',
    disenoElectrico: 'Validación técnica',
    certificacion: 'Validación técnica',
  });
});

test('el O&M del 2 % se aplica en puntos porcentuales y afecta VAN y LCOE', () => {
  const central = calcular(base);
  const sinOpex = calcular({ ...base, opexPctCapex: 0 });

  assert.equal(central.flujoCaja[1].opexEur, central.capexEur * 0.02);
  assert.ok(central.vanEur < sinOpex.vanEur);
  assert.ok(central.lcoeEurKwh > sinOpex.lcoeEurKwh);
});

test('clasifica los tres semáforos con los textos contractuales', () => {
  assert.deepEqual(clasificarSemaforo(1, 5, 10), {
    nivel: 'verde',
    veredicto: 'Previabilidad favorable con datos pendientes de validación.',
  });
  assert.deepEqual(clasificarSemaforo(1, 8, 10), {
    nivel: 'ambar',
    veredicto: 'El escenario merece contraste antes de decidir.',
  });
  assert.deepEqual(clasificarSemaforo(-1, Infinity, 10), {
    nivel: 'rojo',
    veredicto: 'Conviene revisar dimensionamiento, inversión o perfil de consumo.',
  });
});
