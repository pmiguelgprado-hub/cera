import test from 'node:test';
import assert from 'node:assert/strict';
import { crearPasaporte } from '../js/pasaporte.js';

const datos = {
  zonaId: 'centro',
  tipoSuperficie: 'cubierta',
  superficieM2: 250,
  participantes: 12,
  perfilConsumo: 'municipal',
};

const resultado = {
  zona: { nombre: 'Centro urbano', punto: 'Oviedo' },
  potenciaKwp: 25,
  produccionAnualKwh: 28_000,
  autoconsumoKwh: 19_000,
  excedentesKwh: 9_000,
  coberturaConsumo: 0.38,
  tasaAutoconsumo: 19_000 / 28_000,
  capexEur: 27_500,
  vanEur: 8_200,
  lcoeEurKwh: 0.073,
  paybackAnios: 9.2,
  paybackDescontadoAnios: 11.1,
  confianza: {
    recurso: 'Calculado',
    encajeEnergetico: 'Estimado',
    implantacion: 'Estimado',
    disenoElectrico: 'Validación técnica',
    certificacion: 'Validación técnica',
  },
};

const crearCaso = (overrides = {}) => crearPasaporte({
  audienciaId: 'ayuntamiento',
  fechaIso: '2026-07-28T12:00:00.000Z',
  datos,
  resultado,
  ...overrides,
});

test('el pasaporte conserva seis bloques ordenados y transferibles', () => {
  const passport = crearCaso();
  assert.deepEqual(passport.secciones.map(({ id }) => id), [
    'territorio',
    'comunidad',
    'energia',
    'economia',
    'regulacion',
    'proyecto',
  ]);
  assert.equal(passport.secciones[0].estado, 'Calculado');
  assert.equal(passport.secciones[4].estado, 'Dato pendiente');
  assert.equal(passport.secciones[5].estado, 'Validación técnica');
  assert.equal(passport.generadoEn, '2026-07-28T12:00:00.000Z');
  for (const section of passport.secciones) {
    assert.ok(section.evidencias.length >= 2, section.id);
    assert.ok(section.incertidumbre.length > 20, section.id);
    assert.ok(section.siguienteAccion.length > 20, section.id);
    assert.ok(Array.isArray(section.fuenteIds), section.id);
  }
  assert.ok(Object.isFrozen(passport));
  assert.ok(Object.isFrozen(passport.secciones[0].evidencias));
});

test('la regulación expresa condiciones, pendientes y fuentes sin dictamen automático', () => {
  const section = crearCaso().secciones.find(({ id }) => id === 'regulacion');
  const copy = JSON.stringify(section);
  assert.match(copy, /inferior a 500 m/);
  assert.match(copy, /inferior a 5\.000 m/);
  assert.match(copy, /hasta 5 MW/);
  assert.match(copy, /fotovoltaica o eólica/);
  assert.match(copy, /conectada a través de red/);
  assert.match(section.siguienteAccion, /gestor de autoconsumo/);
  assert.deepEqual(section.fuenteIds, ['boe-rdl-7-2026', 'boe-rd-916-2025']);
  assert.doesNotMatch(copy, /\bcumple\b|\bno cumple\b/i);
});

test('el caso de suelo condiciona PAC a usos y actividad agraria concretos', () => {
  const passport = crearCaso({ datos: { ...datos, tipoSuperficie: 'suelo' } });
  const copy = JSON.stringify(passport.secciones.find(({ id }) => id === 'regulacion'));
  assert.match(copy, /tierra de cultivo o cultivo permanente/);
  assert.match(copy, /actividad agraria como principal/);
  assert.doesNotMatch(copy, /pastos permanentes.*elegible/i);
});

test('el perfil local sustituye la hipótesis sintética y valida la fecha', () => {
  const local = crearCaso({ datos: { ...datos, perfilPersonalizado: Array(288).fill(1) } });
  const community = local.secciones.find(({ id }) => id === 'comunidad');
  assert.match(JSON.stringify(community), /CSV local/);
  assert.doesNotMatch(JSON.stringify(community), /curva medida/i);
  assert.throws(
    () => crearCaso({ fechaIso: 'fecha inválida' }),
    /fechaIso debe ser ISO válida/,
  );
});
