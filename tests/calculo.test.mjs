import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  calcular,
  clasificarSemaforo,
  validar,
} from '../js/calculo.js';

const base = {
  consumoAnualKwh: 25000,
  potenciaContratadaKw: 15,
  superficieM2: 200,
  tipoSuperficie: 'cubierta',
  participantes: 4,
  precioElectricidad: 0.18,
  escenario: 'central',
};

test('caso central: fórmulas del spec', () => {
  const r = calcular(base);
  assert.equal(r.ok, true);

  // Potencia: min(200/6.5 = 30,77; 25000/1050 = 23,81) = 23,81 kWp
  assert.ok(Math.abs(r.potenciaKwp - 25000 / 1050) < 1e-9);
  // Producción: (25000/1050) * 1050 = 25 000 kWh (dimensionada por consumo)
  assert.ok(Math.abs(r.produccionAnualKwh - 25000) < 1e-9);
  // Autoconsumo: min(25000 * 0.65, 25000) = 16 250 kWh
  assert.equal(r.autoconsumoKwh, 16250);
  // Excedentes: 25 000 − 16 250 = 8 750 kWh
  assert.equal(r.excedentesKwh, 8750);
  // Ahorro: 16 250 · 0,18 + 8 750 · 0,06 = 2925 + 525 = 3450 EUR
  assert.ok(Math.abs(r.ahorroAnualEur - 3450) < 1e-9);
  // CO2: 25 000 · 0,18 = 4 500 kg
  assert.equal(r.co2EvitadoKg, 4500);
  // Reparto entre 4 participantes
  assert.ok(Math.abs(r.ahorroPorParticipanteEur - 862.5) < 1e-9);
});

test('superficie limita la potencia y genera aviso', () => {
  const r = calcular({ ...base, superficieM2: 65 });
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.potenciaKwp - 10) < 1e-9); // 65/6.5
  assert.ok(r.avisos.some((a) => a.includes('superficie disponible limita')));
});

test('autoconsumo nunca supera el consumo anual', () => {
  const r = calcular({ ...base, consumoAnualKwh: 5000, superficieM2: 10000 });
  assert.equal(r.ok, true);
  assert.ok(r.autoconsumoKwh <= 5000);
  assert.ok(r.excedentesKwh >= 0);
});

test('escenarios cambian el rendimiento específico', () => {
  for (const [escenario, rend] of Object.entries(CONFIG.rendimiento)) {
    const r = calcular({ ...base, escenario });
    assert.equal(r.produccionAnualKwh, r.potenciaKwp * rend);
  }
});

test('semáforo: verde, ámbar y rojo según payback y potencia mínima', () => {
  assert.equal(clasificarSemaforo(20, 5).nivel, 'verde');
  assert.equal(clasificarSemaforo(20, 10).nivel, 'ambar');
  assert.equal(clasificarSemaforo(20, 15).nivel, 'rojo');
  assert.equal(clasificarSemaforo(0.5, 5).nivel, 'rojo');
});

test('caso rojo integrado: precio muy bajo alarga el retorno', () => {
  const r = calcular({ ...base, precioElectricidad: 0.05 });
  assert.equal(r.ok, true);
  assert.ok(r.paybackAnios > CONFIG.paybackAmbar);
  assert.equal(r.semaforo.nivel, 'rojo');
});

test('aviso de potencia contratada superada', () => {
  const r = calcular({ ...base, potenciaContratadaKw: 5 });
  assert.ok(r.avisos.some((a) => a.includes('potencia contratada')));
});

test('aviso agrivoltaico solo en suelo agrario', () => {
  const suelo = calcular({ ...base, tipoSuperficie: 'suelo' });
  assert.ok(suelo.avisos.some((a) => a.includes('agrivoltaica')));
  const cubierta = calcular(base);
  assert.ok(!cubierta.avisos.some((a) => a.includes('agrivoltaica')));
});

test('validación: fuera de rango y campos inválidos', () => {
  const errores = validar({
    ...base,
    consumoAnualKwh: 100, // < 500
    precioElectricidad: 1.2, // > 0.6
    participantes: 11,
    tipoSuperficie: 'tejado', // inválido
    escenario: 'optimista', // inválido
  });
  assert.ok(errores.consumoAnualKwh);
  assert.ok(errores.precioElectricidad);
  assert.ok(errores.participantes);
  assert.ok(errores.tipoSuperficie);
  assert.ok(errores.escenario);

  const r = calcular({ ...base, superficieM2: NaN });
  assert.equal(r.ok, false);
  assert.ok(r.errores.superficieM2);
});
