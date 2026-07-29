import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flujoEconomico,
  valorActualNeto,
  costeNiveladoEnergia,
  retornoSimple,
  retornoDescontado,
} from '../js/economia.js';

const reference = {
  capexEur: 120000,
  energiaAnio1Kwh: 100000,
  valorEnergiaEurKwh: 0.10,
  opexVariableEurKwh: 0.015,
  opexFijoEurAnio: 0,
  degradacion: 0.0035,
  tasaDescuento: 0.03,
  vidaUtilAnios: 25,
};

test('el flujo aplica degradación sin degradar el primer año', () => {
  const flow = flujoEconomico(reference);
  assert.equal(flow.length, 26);
  assert.equal(flow[0].netoEur, -120000);
  assert.equal(flow[1].energiaKwh, 100000);
  assert.ok(Math.abs(flow[2].energiaKwh - 99650) < 1e-9);
});

test('el caso de referencia produce VAN y LCOE reconciliables', () => {
  const flow = flujoEconomico(reference);
  assert.ok(Math.abs(valorActualNeto(flow, 0.03) - 22717.771253788138) < 1e-6);
  assert.ok(Math.abs(costeNiveladoEnergia(flow, 0.03) - 0.08646972595208084) < 1e-9);
});

test('el payback simple interpola el año de recuperación', () => {
  const flow = flujoEconomico({ ...reference, capexEur: 20000 });
  assert.ok(retornoSimple(flow) > 2 && retornoSimple(flow) < 3);
});

test('el payback descontado nunca es menor que el simple', () => {
  const flow = flujoEconomico({ ...reference, capexEur: 60000 });
  assert.ok(retornoDescontado(flow, 0.03) >= retornoSimple(flow));
});

test('un proyecto que no recupera inversión devuelve Infinity', () => {
  const flow = flujoEconomico({ ...reference, capexEur: 900000 });
  assert.equal(retornoSimple(flow), Infinity);
  assert.equal(retornoDescontado(flow, 0.03), Infinity);
});

test('rechaza entradas no finitas o físicamente inválidas', () => {
  for (const invalidInput of [
    { ...reference, capexEur: Infinity },
    { ...reference, energiaAnio1Kwh: -1 },
    { ...reference, opexVariableEurKwh: -0.01 },
    { ...reference, opexFijoEurAnio: -1 },
    { ...reference, degradacion: 1.01 },
    { ...reference, vidaUtilAnios: 0 },
  ]) {
    assert.throws(() => flujoEconomico(invalidInput), TypeError);
  }
});

test('rechaza tasas de descuento no finitas o negativas', () => {
  const flow = flujoEconomico(reference);
  for (const invalidRate of [NaN, Infinity, -0.01, -1]) {
    assert.throws(() => valorActualNeto(flow, invalidRate), TypeError);
    assert.throws(() => costeNiveladoEnergia(flow, invalidRate), TypeError);
    assert.throws(() => retornoDescontado(flow, invalidRate), TypeError);
  }
});

test('conserva Infinity cuando no hay energía descontada', () => {
  const zeroEnergyFlow = flujoEconomico({ ...reference, energiaAnio1Kwh: 0 });
  assert.equal(costeNiveladoEnergia(zeroEnergyFlow, 0.03), Infinity);
});
