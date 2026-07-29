import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar } from '../js/calculo-v2.js';
import { AUDIENCIAS, audiencia, proximoPaso, matrizMadurez } from '../js/producto.js';

test('CERA adapta la decisión a cuatro audiencias', () => {
  assert.deepEqual(Object.keys(AUDIENCIAS), ['ayuntamiento', 'cooperativa', 'particular', 'empresa']);
  for (const id of Object.keys(AUDIENCIAS)) {
    assert.ok(audiencia(id).promesa.length > 40);
    assert.ok(audiencia(id).lecturas.length >= 3);
    assert.ok(proximoPaso(id).accion.length > 10);
  }
});

test('las acciones del pasaporte son neutrales y concretas', () => {
  assert.deepEqual(
    Object.fromEntries(Object.keys(AUDIENCIAS).map((id) => [id, proximoPaso(id).accion])),
    {
      ayuntamiento: 'Preparar inventario de cubiertas, suministros y participantes.',
      cooperativa: 'Acordar datos de consumo y criterios iniciales de reparto.',
      particular: 'Contrastar el escenario con vecinos, ayuntamiento o cooperativa.',
      empresa: 'Validar perfil horario, superficie y condiciones de conexión.',
    },
  );
  assert.doesNotMatch(JSON.stringify(AUDIENCIAS), /programa|empresa colaboradora|start-?up/i);
});

test('cada audiencia recomienda un objetivo admitido por el motor v2', () => {
  const objetivosEsperados = {
    ayuntamiento: 'activar-activos',
    cooperativa: 'evaluar-grupo',
    particular: 'entender-participacion',
    empresa: 'aprovechar-activo',
  };
  for (const [id, objetivo] of Object.entries(objetivosEsperados)) {
    assert.equal(audiencia(id).objetivoRecomendado, objetivo);
    assert.equal(validar({ objetivo }).objetivo, undefined);
  }
});

test('el contenido no publica la atribución académica descartada', () => {
  const text = JSON.stringify(AUDIENCIAS);
  assert.doesNotMatch(text, /Universidad de Oviedo|Tecnología Energética|Diseño, Verificación/i);
});

test('la matriz conserva las cuatro fases y estados de confianza', () => {
  const rows = matrizMadurez({ confianza: {
    recurso: 'Calculado', encajeEnergetico: 'Estimado', implantacion: 'Estimado', diseñoElectrico: 'Validación técnica', certificacion: 'Validación técnica',
  } });
  assert.deepEqual(rows.map(({ id }) => id), ['recurso', 'encaje', 'implantacion', 'proyecto']);
  assert.equal(rows[0].estado, 'Calculado');
  assert.equal(rows[3].estado, 'Validación técnica');
});

test('las audiencias públicas son inmutables y los IDs desconocidos son claros', () => {
  assert.equal(Object.isFrozen(AUDIENCIAS), true);
  assert.equal(Object.isFrozen(AUDIENCIAS.ayuntamiento), true);
  assert.equal(Object.isFrozen(AUDIENCIAS.ayuntamiento.lecturas), true);
  assert.throws(() => audiencia('comunidad-inexistente'), /Audiencia desconocida: comunidad-inexistente/);
});
