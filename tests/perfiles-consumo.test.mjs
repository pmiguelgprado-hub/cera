import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERFILES_CONSUMO,
  PERFILES_META,
  serieConsumo288,
  mezclarPerfiles,
  parsearPerfilCsv,
} from '../js/perfiles-consumo.js';

const total = (values) => values.reduce((sum, value) => sum + value, 0);
const assertSerieNormalizada = (values, expectedTotal) => {
  assert.equal(values.length, 288);
  assert.ok(values.every((value) => Number.isFinite(value) && value >= 0));
  assert.ok(Math.abs(total(values) - expectedTotal) < 1e-6);
};

function csvDenso({ delimiter = ',', energia = () => '1' } = {}) {
  const cabecera = ['mes', 'hora', 'kwh'].join(delimiter);
  const filas = [];
  for (let mes = 1; mes <= 12; mes += 1) {
    for (let hora = 0; hora < 24; hora += 1) {
      filas.push([mes, hora, energia(mes, hora)].join(delimiter));
    }
  }
  return [cabecera, ...filas].join('\n');
}

test('los cinco perfiles se normalizan al consumo anual', () => {
  assert.deepEqual(Object.keys(PERFILES_CONSUMO), ['residencial', 'municipal', 'comercial', 'productivo', 'mixto']);
  for (const perfilId of Object.keys(PERFILES_CONSUMO)) {
    assertSerieNormalizada(serieConsumo288({ consumoAnualKwh: 25000, perfilId }), 25000);
  }
});

test('los perfiles de referencia declaran origen sintético y resolución', () => {
  assert.deepEqual(Object.keys(PERFILES_META), [
    'residencial',
    'municipal',
    'comercial',
    'productivo',
    'mixto',
  ]);
  for (const item of Object.values(PERFILES_META)) {
    assert.equal(item.origen, 'Perfil sintético CERA');
    assert.equal(item.resolucion, '288 intervalos mes-hora');
    assert.equal(item.estado, 'Estimado');
    assert.ok(Object.isFrozen(item));
  }
});

test('residencial concentra más consumo nocturno que comercial', () => {
  const residential = serieConsumo288({ consumoAnualKwh: 12000, perfilId: 'residencial' });
  const commercial = serieConsumo288({ consumoAnualKwh: 12000, perfilId: 'comercial' });
  const hours = (series, selected) => series.reduce((sum, value, index) => selected.includes(index % 24) ? sum + value : sum, 0);
  assert.ok(hours(residential, [20, 21, 22]) > hours(commercial, [20, 21, 22]));
  assert.ok(hours(commercial, [10, 11, 12, 13]) > hours(residential, [10, 11, 12, 13]));
});

test('el perfil mixto conserva pesos explícitos', () => {
  const mixed = mezclarPerfiles({ residencial: 0.5, municipal: 0.3, productivo: 0.2 });
  assertSerieNormalizada(mixed, 1);
});

test('el CSV mes-hora-kWh exige y normaliza los 288 intervalos únicos', () => {
  const csv = csvDenso({ energia: (mes, hora) => String(mes * 100 + hora + 1) });
  const values = parsearPerfilCsv(csv, 6500);
  assertSerieNormalizada(values, 6500);
  assert.ok(values[8] > 0);
  assert.ok(values[6 * 24 + 12] > 0);
});

test('el CSV acepta punto y coma con decimales de coma', () => {
  const values = parsearPerfilCsv(csvDenso({ delimiter: ';', energia: () => '1,5' }), 4000);
  assertSerieNormalizada(values, 4000);
  assert.ok(values[8] > 0);
  assert.ok(values[11 * 24 + 23] > 0);
});

test('el CSV rechaza un intervalo ausente o repetido aunque tenga 288 filas', () => {
  const completo = csvDenso();
  const lineas = completo.split('\n');
  assert.throws(
    () => parsearPerfilCsv(lineas.slice(0, -1).join('\n'), 4000),
    /288|faltan|intervalos/i,
  );
  assert.throws(
    () => parsearPerfilCsv([...lineas, lineas[1]].join('\n'), 4000),
    /duplicado|repetido/i,
  );
  assert.throws(
    () => parsearPerfilCsv([...lineas.slice(0, -1), lineas[1]].join('\n'), 4000),
    /duplicado|repetido/i,
  );
});

test('rechaza consumo anual no finito o negativo', () => {
  for (const consumoAnualKwh of [Number.NaN, Infinity, -1]) {
    assert.throws(() => serieConsumo288({ consumoAnualKwh, perfilId: 'residencial' }), /consumo anual/i);
    assert.throws(() => parsearPerfilCsv('mes,hora,kwh\n1,8,2', consumoAnualKwh), /consumo anual/i);
  }
});

test('rechaza perfiles y mezclas inválidas', () => {
  assert.throws(() => serieConsumo288({ consumoAnualKwh: 1000, perfilId: 'desconocido' }), /Perfil desconocido/);
  for (const weights of [null, {}, { desconocido: 1 }, { residencial: -1 }, { residencial: Number.NaN }, { residencial: Infinity }]) {
    assert.throws(() => mezclarPerfiles(weights), /peso|mezcla|perfil/i);
  }
});

test('el CSV rechaza cabeceras, forma, horas o energía inválidas', () => {
  assert.throws(() => parsearPerfilCsv('mes,hora,valor\n1,8,2', 1000), /Cabecera/);
  assert.throws(() => parsearPerfilCsv('mes,hora,kwh\n1,8', 1000), /tres columnas/i);
  assert.throws(() => parsearPerfilCsv('mes,hora,kwh\n1,25,2', 1000), /hora/);
  assert.throws(() => parsearPerfilCsv('mes,hora,kwh\n1,8,-2', 1000), /kWh/);
  assert.throws(() => parsearPerfilCsv('mes,hora,kwh\n1,8,Infinity', 1000), /kWh/);
});
