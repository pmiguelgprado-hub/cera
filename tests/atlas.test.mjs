import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZONAS,
  MEDIA_ASTURIAS,
  serieMensual,
  comparacionRegional,
  buscarZonas,
  concejoCoincidente,
} from '../js/atlas.js';
import { PVGIS_META, zonaSolar } from '../js/solar-data.js';

test('el atlas usa las ocho zonas PVGIS con IDs y procedencia generados', () => {
  assert.equal(ZONAS.length, 8);
  assert.deepEqual(ZONAS.map(({ id }) => id), [
    'occidente', 'suroccidente', 'aviles', 'centro',
    'gijon', 'caudal', 'nalon', 'oriente',
  ]);
  assert.equal(PVGIS_META.provider, 'JRC PVGIS');
  assert.equal(PVGIS_META.version, '5.3');
  assert.equal(MEDIA_ASTURIAS, Math.round(ZONAS.reduce((sum, zone) => sum + zone.ey, 0) / 8));
});

test('la serie mensual se consulta por ID y reconcilia el total generado', () => {
  const zona = zonaSolar('centro');
  const serie = serieMensual('centro');
  assert.equal(serie.length, 12);
  assert.ok(Math.abs(serie.reduce((suma, mes) => suma + mes.valor, 0) - zona.ey) < 1e-9);
});

test('la zona conserva fuente, coordenadas, inclinación y azimut', () => {
  const zona = zonaSolar('centro');
  assert.match(zona.sourceUrl, /^https:\/\/re\.jrc\.ec\.europa\.eu\/api\/v5_3\/seriescalc\?/);
  assert.equal(zona.lat, 43.361);
  assert.equal(zona.lon, -5.849);
  assert.equal(zona.angulo, 38);
  assert.equal(zona.azimut, -3);
});

test('la comparación regional expresa diferencia absoluta y porcentual', () => {
  const zona = zonaSolar('centro');
  const esperado = Math.round(zona.ey - MEDIA_ASTURIAS);
  assert.deepEqual(comparacionRegional(zona.ey), {
    diferencia: Math.abs(esperado),
    porcentaje: Math.abs(Math.round((esperado / MEDIA_ASTURIAS) * 100)),
    posicion: esperado >= 0 ? 'por encima' : 'por debajo',
  });
});

test('la búsqueda normalizada encuentra zonas por nombre, punto o concejo', () => {
  assert.equal(buscarZonas('llanes')[0].id, 'oriente');
  assert.equal(buscarZonas('narcea')[0].id, 'suroccidente');
  assert.equal(buscarZonas('OVÍEDO')[0].id, 'centro');
  assert.equal(concejoCoincidente(buscarZonas('tineo')[0], 'Tineo'), 'Tineo');
});
