import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PVGIS_META,
  ZONAS_SOLARES,
  zonaSolar,
  serieSolar288,
} from '../js/solar-data.js';

test('el conjunto local identifica fuente, versión y periodo', () => {
  assert.equal(PVGIS_META.provider, 'JRC PVGIS');
  assert.equal(PVGIS_META.version, '5.3');
  assert.deepEqual(PVGIS_META.period, [2020, 2023]);
  assert.match(PVGIS_META.api, /^https:\/\/re\.jrc\.ec\.europa\.eu\/api\/v5_3\//);
});

test('las ocho zonas contienen 12 meses y 288 intervalos', () => {
  assert.equal(ZONAS_SOLARES.length, 8);
  for (const zona of ZONAS_SOLARES) {
    assert.equal(zona.mensual.length, 12, zona.id);
    assert.equal(zona.horariaMensual.length, 12, zona.id);
    assert.ok(zona.horariaMensual.every((fila) => fila.length === 24), zona.id);
    assert.equal(serieSolar288(zona.id).length, 288, zona.id);
  }
});

test('la energía mensual y anual se reconcilian', () => {
  for (const zona of ZONAS_SOLARES) {
    const mensual = zona.mensual.reduce((suma, valor) => suma + valor, 0);
    const horaria = serieSolar288(zona.id).reduce((suma, valor) => suma + valor, 0);
    assert.ok(Math.abs(mensual - zona.ey) < 0.2, zona.id);
    assert.ok(Math.abs(horaria - zona.ey) < 0.2, zona.id);
    assert.ok(zona.ey > 1000 && zona.ey < 1350, zona.id);
  }
});

test('la consulta territorial devuelve una copia inmutable', () => {
  const oviedo = zonaSolar('centro');
  assert.equal(oviedo.punto, 'Oviedo');
  assert.equal(Object.isFrozen(oviedo), true);
  assert.throws(() => zonaSolar('zona-inexistente'), /Zona solar desconocida/);
});
