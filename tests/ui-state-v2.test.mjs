import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular, validar } from '../js/calculo-v2.js';
import {
  PASOS,
  erroresDelPaso,
  primerPasoConError,
  estadoDePasos,
  resumenEscenario,
  lecturaDecision,
} from '../js/ui-state-v2.js';

const base = {
  tipoUsuario: 'ayuntamiento', objetivo: 'activar-activos', zonaId: 'centro',
  consumoAnualKwh: 25000, potenciaContratadaKw: 15, superficieM2: 200,
  tipoSuperficie: 'cubierta', participantes: 12, perfilConsumo: 'mixto',
  precioElectricidad: 0.18, precioExcedentes: 0.06, fraccionSuperficieUtil: 0.75,
  inclinacionDeg: 38, azimutDeg: -3, perdidasPct: 14,
  estrategiaDimensionado: 'equilibrio', capexPorKwp: 1100, opexPctCapex: 2,
  degradacionPct: 0.5, tasaDescuentoPct: 3, vidaUtilAnios: 25,
};

test('el recorrido agrupa los campos del motor v2 en cuatro decisiones', () => {
  assert.deepEqual(PASOS.map(({ id }) => id), ['contexto', 'consumo', 'generacion', 'economia']);
  assert.deepEqual(PASOS.map(({ titulo }) => titulo), ['Contexto', 'Comunidad y consumo', 'Generación', 'Economía y revisión']);
  assert.deepEqual(PASOS.map(({ campos }) => campos), [
    ['tipoUsuario', 'objetivo', 'zonaId', 'tipoSuperficie', 'superficieM2'],
    ['consumoAnualKwh', 'potenciaContratadaKw', 'participantes', 'perfilConsumo', 'perfilPersonalizado', 'precioElectricidad', 'precioExcedentes'],
    ['fraccionSuperficieUtil', 'inclinacionDeg', 'azimutDeg', 'perdidasPct', 'estrategiaDimensionado'],
    ['capexPorKwp', 'opexPctCapex', 'degradacionPct', 'tasaDescuentoPct', 'vidaUtilAnios'],
  ]);
  const campos = PASOS.flatMap(({ campos: grupo }) => grupo);
  assert.equal(new Set(campos).size, campos.length);
  assert.equal(campos.filter((campo) => campo === 'perfilPersonalizado').length, 1);
  assert.ok(PASOS.find(({ id }) => id === 'consumo').campos.includes('perfilPersonalizado'));
});

test('el routing cubre todos los campos v2 sin desbloquear progresión', () => {
  const errores = Object.fromEntries(
    PASOS.flatMap(({ campos }) => campos).map((campo) => [campo, `Error ${campo}`]),
  );
  for (const paso of PASOS) {
    assert.deepEqual(Object.keys(erroresDelPaso(paso.id, errores)), paso.campos);
  }
  assert.equal(primerPasoConError(errores), 0);
  assert.deepEqual(estadoDePasos(0, primerPasoConError(errores)), ['actual', 'bloqueado', 'bloqueado', 'bloqueado']);
});

test('el routing rechaza un paso público desconocido de forma clara', () => {
  assert.throws(
    () => erroresDelPaso('paso-inexistente', validar(base)),
    /Paso desconocido: paso-inexistente/,
  );
});

test('el estado de pasos mantiene completado, actual, disponible y bloqueado', () => {
  assert.deepEqual(estadoDePasos(1, 2), ['completado', 'actual', 'disponible', 'bloqueado']);
});

test('el resumen usa etiquetas humanas para audiencia, territorio, consumo, participantes y estrategia', () => {
  assert.equal(resumenEscenario(base), 'Ayuntamiento · Centro · 25.000 kWh/año · 12 participantes · equilibrio recomendado');
});

test('la lectura principal traduce el semáforo sin prometer garantía', () => {
  const lectura = lecturaDecision(calcular(base));
  assert.equal(lectura.titulo, 'Previabilidad favorable con datos pendientes');
  assert.match(lectura.explicacion, /orientación preliminar/i);
  assert.equal(lectura.accion, 'Preparar una validación técnica');
});

test('los pasos públicos son inmutables', () => {
  assert.equal(Object.isFrozen(PASOS), true);
  assert.equal(Object.isFrozen(PASOS[0]), true);
  assert.equal(Object.isFrozen(PASOS[0].campos), true);
});

test('el resumen rechaza una estrategia desconocida de forma clara', () => {
  assert.throws(
    () => resumenEscenario({ ...base, estrategiaDimensionado: 'sin-estrategia' }),
    /Estrategia de dimensionado desconocida: sin-estrategia/,
  );
});
