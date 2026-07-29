import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DENSIDADES_SUPERFICIE,
  potenciaMaximaSuperficie,
  balanceTemporal,
  candidatosPotencia,
  factorOrientacionInclinacion,
} from '../js/balance-energetico.js';

const EPSILON = 1e-9;
const suma = (items, campo) => items.reduce((total, item) => total + item[campo], 0);
const assertCasiIgual = (actual, esperado) => {
  assert.ok(Math.abs(actual - esperado) < EPSILON, `${actual} no coincide con ${esperado}`);
};

test('la superficie util limita potencia segun implantacion', () => {
  assert.equal(potenciaMaximaSuperficie({ superficieM2: 200, fraccionUtil: 0.75, tipoSuperficie: 'cubierta' }), 30);
  assert.equal(potenciaMaximaSuperficie({ superficieM2: 130, fraccionUtil: 0.5, tipoSuperficie: 'aparcamiento' }), 10);
  assert.ok(potenciaMaximaSuperficie({ superficieM2: 200, fraccionUtil: 0.75, tipoSuperficie: 'suelo' }) < 30);
});

test('cada intervalo y los agregados conservan energia', () => {
  const solar = Array.from({ length: 288 }, (_, indice) => 0.1 + (indice % 5) * 0.2);
  const load = Array.from({ length: 288 }, (_, indice) => 0.2 + (indice % 7) * 0.15);
  const result = balanceTemporal({ solarKwhKwp: solar, consumoKwh: load, potenciaKwp: 1.3 });

  assertCasiIgual(result.generacionKwh, result.autoconsumoKwh + result.excedentesKwh);
  assertCasiIgual(result.consumoKwh, result.autoconsumoKwh + result.compraRedKwh);
  for (const month of result.mensual) {
    assertCasiIgual(month.generacionKwh, month.autoconsumoKwh + month.excedentesKwh);
    assertCasiIgual(month.consumoKwh, month.autoconsumoKwh + month.compraRedKwh);
  }
  for (const hour of result.horariaMedia) {
    assertCasiIgual(hour.generacionKwh, hour.autoconsumoKwh + hour.excedentesKwh);
    assertCasiIgual(hour.consumoKwh, hour.autoconsumoKwh + hour.compraRedKwh);
  }
  for (const campo of ['generacionKwh', 'consumoKwh', 'autoconsumoKwh', 'excedentesKwh', 'compraRedKwh']) {
    assertCasiIgual(suma(result.mensual, campo), result[campo]);
    assertCasiIgual(suma(result.horariaMedia, campo), result[campo]);
  }
});

test('sin coincidencia horaria no se inventa autoconsumo', () => {
  const solar = Array(288).fill(0);
  const load = Array(288).fill(0);
  solar[12] = 100;
  load[20] = 100;
  const result = balanceTemporal({ solarKwhKwp: solar, consumoKwh: load, potenciaKwp: 1 });

  assert.equal(result.autoconsumoKwh, 0);
  assert.equal(result.excedentesKwh, 100);
  assert.equal(result.compraRedKwh, 100);
});

test('tasa de autoconsumo y cobertura son metricas diferentes', () => {
  const solar = Array(288).fill(1);
  const load = Array(288).fill(2);
  const result = balanceTemporal({ solarKwhKwp: solar, consumoKwh: load, potenciaKwp: 1 });

  assert.equal(result.tasaAutoconsumo, 1);
  assert.equal(result.coberturaSolar, 0.5);
});

test('los candidatos incluyen minimo y maximo sin duplicados', () => {
  assert.deepEqual(candidatosPotencia(0), [0]);
  assert.deepEqual(candidatosPotencia(0.25), [0.25]);
  assert.deepEqual(candidatosPotencia(2, { pasoKwp: 0.5 }), [0.5, 1, 1.5, 2]);
  assert.equal(candidatosPotencia(30).at(-1), 30);
});

test('el paso por defecto limita casos grandes y conserva máximo y orden', () => {
  const candidates = candidatosPotencia(20_000);
  assert.ok(candidates.length <= 1000);
  assert.equal(candidates.at(-1), 20_000);
  assert.ok(candidates.every((value, index) => index === 0 || value > candidates[index - 1]));
});

test('rechaza un paso subnormal que produciria demasiados candidatos', () => {
  assert.throws(
    () => candidatosPotencia(1, { pasoKwp: Number.MIN_VALUE }),
    /demasiados candidatos/i,
  );
});

test('valida superficie, fraccion y tipo de implantacion', () => {
  for (const superficieM2 of [Number.NaN, Infinity, -1]) {
    assert.throws(() => potenciaMaximaSuperficie({ superficieM2, fraccionUtil: 0.5, tipoSuperficie: 'cubierta' }), /superficie/i);
  }
  for (const fraccionUtil of [Number.NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => potenciaMaximaSuperficie({ superficieM2: 100, fraccionUtil, tipoSuperficie: 'cubierta' }), /fraccion/i);
  }
  assert.throws(() => potenciaMaximaSuperficie({ superficieM2: 100, fraccionUtil: 0.5, tipoSuperficie: 'tejado' }), /desconocida/i);
});

test('rechaza series, potencia y paso invalidos antes de calcular', () => {
  const series = Array(288).fill(1);
  assert.throws(() => balanceTemporal({ solarKwhKwp: series.slice(1), consumoKwh: series, potenciaKwp: 1 }), /288/);
  assert.throws(() => balanceTemporal({ solarKwhKwp: [...series.slice(0, 1), Number.NaN, ...series.slice(2)], consumoKwh: series, potenciaKwp: 1 }), /solar/i);
  assert.throws(() => balanceTemporal({ solarKwhKwp: series, consumoKwh: [...series.slice(0, 1), -1, ...series.slice(2)], potenciaKwp: 1 }), /consumo/i);
  for (const potenciaKwp of [Number.NaN, Infinity, -1]) {
    assert.throws(() => balanceTemporal({ solarKwhKwp: series, consumoKwh: series, potenciaKwp }), /potencia/i);
  }
  for (const pasoKwp of [Number.NaN, Infinity, 0, -1]) {
    assert.throws(() => candidatosPotencia(2, { pasoKwp }), /paso/i);
  }
});

test('la corrección IDAE vale uno en beta igual a latitud menos diez y sur', () => {
  assert.equal(factorOrientacionInclinacion({
    inclinacion: 33.36,
    azimut: 0,
    latitud: 43.36,
  }), 1);
});

test('beta hasta quince grados omite el término de azimut', () => {
  const south = factorOrientacionInclinacion({ inclinacion: 10, azimut: 0, latitud: 43.36 });
  const east = factorOrientacionInclinacion({ inclinacion: 10, azimut: 90, latitud: 43.36 });
  assert.equal(east, south);
  assert.ok(Math.abs(south - 0.934517248) < 0.000000001);
});

test('beta mayor de quince grados incluye el término de azimut', () => {
  const factor = factorOrientacionInclinacion({ inclinacion: 30, azimut: 90, latitud: 43.36 });
  assert.ok(Math.abs(factor - 0.715145) < 0.00001);
});

test('la corrección IDAE valida rangos físicos', () => {
  assert.throws(
    () => factorOrientacionInclinacion({ inclinacion: -1, azimut: 0, latitud: 43 }),
    /inclinacion debe estar entre 0 y 90/,
  );
  assert.throws(
    () => factorOrientacionInclinacion({ inclinacion: 30, azimut: 181, latitud: 43 }),
    /azimut debe estar entre -180 y 180/,
  );
});

test('las densidades públicas conservan valor unidad y carácter estimado', () => {
  assert.deepEqual(DENSIDADES_SUPERFICIE, {
    cubierta: { valor: 5, unidad: 'm²/kWp', estado: 'Hipótesis CERA' },
    aparcamiento: { valor: 6.5, unidad: 'm²/kWp', estado: 'Hipótesis CERA' },
    suelo: { valor: 8, unidad: 'm²/kWp', estado: 'Hipótesis CERA' },
  });
  assert.ok(Object.isFrozen(DENSIDADES_SUPERFICIE.cubierta));
});
