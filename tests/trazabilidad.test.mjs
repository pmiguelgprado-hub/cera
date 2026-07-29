import test from 'node:test';
import assert from 'node:assert/strict';
import { FUENTES, SUPUESTOS, fuente, supuesto } from '../js/trazabilidad.js';

const SOURCE_IDS = [
  'jrc-pvgis-53',
  'idae-pct-fv-2011',
  'boe-rdl-7-2026',
  'boe-rd-916-2025',
  'ue-rec-2026-1007',
  'wcag-22',
];

test('el registro publica las seis fuentes primarias fechadas', () => {
  assert.deepEqual(Object.keys(FUENTES), SOURCE_IDS);
  for (const id of SOURCE_IDS) {
    const item = fuente(id);
    assert.equal(item.id, id);
    assert.equal(item.consultada, '2026-07-28');
    assert.match(item.url, /^https:\/\//);
    assert.ok(item.titulo.length > 12);
    assert.ok(item.organismo.length > 2);
    assert.ok(item.alcance.length > 12);
    assert.ok(item.limite.length > 12);
  }
});

test('fuentes y supuestos no son mutables desde consumidores', () => {
  assert.ok(Object.isFrozen(FUENTES));
  assert.ok(Object.isFrozen(FUENTES['jrc-pvgis-53']));
  assert.ok(Object.isFrozen(SUPUESTOS));
  assert.ok(Object.isFrozen(SUPUESTOS['opex-inicial']));
});

test('los supuestos técnicos declaran unidad estado y fuente', () => {
  assert.deepEqual(Object.keys(SUPUESTOS), [
    'perdidas-pvgis',
    'degradacion-inicial',
    'opex-inicial',
    'densidad-cubierta',
    'densidad-aparcamiento',
    'densidad-suelo',
    'perfil-sintetico',
  ]);
  for (const item of Object.values(SUPUESTOS)) {
    assert.ok(Object.hasOwn(item, 'valor'));
    assert.ok(item.unidad.length > 0);
    assert.match(item.estado, /^(documentado|hipotesis-cera)$/);
    if (item.estado === 'documentado') {
      assert.equal(fuente(item.fuenteId).id, item.fuenteId);
    } else {
      assert.equal(item.fuenteId, null);
    }
  }
  assert.equal(supuesto('opex-inicial').valor, 2);
  assert.equal(supuesto('perfil-sintetico').estado, 'hipotesis-cera');
});

test('los IDs desconocidos fallan de forma explícita', () => {
  assert.throws(() => fuente('desconocida'), /Fuente desconocida/);
  assert.throws(() => supuesto('desconocido'), /Supuesto desconocido/);
});
