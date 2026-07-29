import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  LIMITES,
  calcular,
  clasificarSemaforo,
  validar,
} from '../js/calculo.js';

export const base = {
  tipoUsuario: 'ayuntamiento',
  objetivo: 'activar-activos',
  zonaId: 'centro',
  consumoAnualKwh: 25000,
  potenciaContratadaKw: 15,
  superficieM2: 200,
  tipoSuperficie: 'cubierta',
  participantes: 12,
  perfilConsumo: 'mixto',
  precioElectricidad: 0.18,
  precioExcedentes: 0.06,
  fraccionSuperficieUtil: 0.75,
  inclinacionDeg: 38,
  azimutDeg: -3,
  perdidasPct: 14,
  estrategiaDimensionado: 'equilibrio',
  capexPorKwp: 1100,
  opexPctCapex: 2,
  degradacionPct: 0.5,
  tasaDescuentoPct: 3,
  vidaUtilAnios: 25,
};

test('calculo.js publica exactamente el contrato del motor v2', () => {
  assert.equal(CONFIG.opexPctCapex, 2);
  assert.deepEqual(LIMITES.participantes, [1, 1000]);
  assert.equal(typeof validar, 'function');
  assert.equal(typeof calcular, 'function');
  assert.equal(typeof clasificarSemaforo, 'function');
});

test('la fachada calcula balance de 288 intervalos y economía descontada', () => {
  const resultado = calcular(base);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.balance.horariaMedia.length, 24);
  assert.equal(resultado.balance.mensual.length, 12);
  assert.equal(resultado.trazabilidadPerfil.orden, 'month-major');
  assert.equal(resultado.trazabilidadPerfil.recorrido, 'mes→hora');
  assert.ok(Number.isFinite(resultado.vanEur));
  assert.ok(Number.isFinite(resultado.lcoeEurKwh));
  assert.ok(Number.isFinite(resultado.paybackAnios));
  assert.ok(Number.isFinite(resultado.paybackDescontadoAnios));
  assert.deepEqual(
    resultado.escenariosDimensionado.map(({ id }) => id),
    ['ajuste', 'equilibrio', 'maximo'],
  );
});

test('participantes=12 valida y el perfil personalizado conserva 288 valores', () => {
  assert.equal(validar(base).participantes, undefined);
  const perfilPersonalizado = Array(288).fill(0);
  perfilPersonalizado[12] = base.consumoAnualKwh;
  const resultado = calcular({ ...base, perfilPersonalizado });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.confianza.encajeEnergetico, 'Calculado');
  assert.ok(Math.abs(resultado.balance.consumoKwh - base.consumoAnualKwh) < 1e-6);
});

test('los tres escenarios y la sensibilidad publican supuestos reales', () => {
  const resultado = calcular(base);
  assert.equal(resultado.escenariosDimensionado.length, 3);
  assert.equal(resultado.sensibilidad.length, 3);
  assert.equal(resultado.sensibilidad[0].supuestos.capexFactor, 1.15);
  assert.equal(resultado.sensibilidad[1].supuestos.capexFactor, 1);
  assert.equal(resultado.sensibilidad[2].supuestos.capexFactor, 0.9);
  assert.equal(typeof resultado.escenariosDimensionado[0].cumpleRegla, 'boolean');
});
