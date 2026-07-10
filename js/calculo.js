// CERA — motor de cálculo de previabilidad. Módulo puro, sin DOM.
// Todos los valores de hipótesis viven en CONFIG y se muestran en pantalla
// en el bloque «Hipótesis y límites». Resultados siempre orientativos.

export const CONFIG = {
  // Superficie necesaria por kWp instalado (m²/kWp), fuente: regla de prototipo.
  m2PorKwp: 6.5,
  // Rendimiento específico anual (kWh/kWp) según escenario.
  rendimiento: {
    conservador: 1050,
    central: 1250,
    favorable: 1400,
  },
  // Fracción de la producción que se autoconsume de forma simultánea.
  fraccionAutoconsumo: 0.65,
  // Compensación simplificada de excedentes (EUR/kWh).
  precioExcedentes: 0.06,
  // Factor de emisiones evitadas (kgCO2/kWh).
  factorCo2: 0.18,
  // CAPEX orientativo llave en mano (EUR/kWp), solo para el semáforo.
  capexPorKwp: 1100,
  // Umbrales del semáforo (años de retorno simple).
  paybackVerde: 8,
  paybackAmbar: 12,
  // Potencia mínima para que un proyecto tenga sentido (kWp).
  potenciaMinima: 1,
};

export const LIMITES = {
  consumoAnualKwh: { min: 500, max: 1_000_000 },
  potenciaContratadaKw: { min: 1, max: 1000 },
  superficieM2: { min: 10, max: 100_000 },
  participantes: { min: 1, max: 10 },
  precioElectricidad: { min: 0.05, max: 0.6 },
};

const TIPOS_SUPERFICIE = ['cubierta', 'suelo', 'aparcamiento'];
const ESCENARIOS = Object.keys(CONFIG.rendimiento);

export function validar(datos) {
  const errores = {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

  for (const [campo, { min, max }] of Object.entries(LIMITES)) {
    const v = num(datos[campo]);
    if (Number.isNaN(v) || v < min || v > max) {
      errores[campo] =
        `Introduce un valor entre ${min.toLocaleString('es-ES')} ` +
        `y ${max.toLocaleString('es-ES')}.`;
    }
  }
  if (!TIPOS_SUPERFICIE.includes(datos.tipoSuperficie)) {
    errores.tipoSuperficie = 'Elige un tipo de superficie.';
  }
  if (!ESCENARIOS.includes(datos.escenario)) {
    errores.escenario = 'Elige un escenario.';
  }
  return errores;
}

export function calcular(datos) {
  const errores = validar(datos);
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const rendimiento = CONFIG.rendimiento[datos.escenario];

  // Potencia recomendada: la menor entre lo que cabe en la superficie y lo
  // que dimensiona el consumo anual (producción ≈ consumo).
  const potenciaMaxSuperficie = datos.superficieM2 / CONFIG.m2PorKwp;
  const potenciaPorConsumo = datos.consumoAnualKwh / rendimiento;
  const potenciaKwp = Math.min(potenciaMaxSuperficie, potenciaPorConsumo);

  const produccionAnualKwh = potenciaKwp * rendimiento;
  const autoconsumoKwh = Math.min(
    produccionAnualKwh * CONFIG.fraccionAutoconsumo,
    datos.consumoAnualKwh
  );
  const excedentesKwh = Math.max(produccionAnualKwh - autoconsumoKwh, 0);
  const coberturaConsumo = autoconsumoKwh / datos.consumoAnualKwh;

  const ahorroAnualEur =
    autoconsumoKwh * datos.precioElectricidad +
    excedentesKwh * CONFIG.precioExcedentes;
  const co2EvitadoKg = produccionAnualKwh * CONFIG.factorCo2;

  const capexEur = potenciaKwp * CONFIG.capexPorKwp;
  const paybackAnios = ahorroAnualEur > 0 ? capexEur / ahorroAnualEur : Infinity;

  const semaforo = clasificarSemaforo(potenciaKwp, paybackAnios);

  const avisos = [];
  if (potenciaKwp > datos.potenciaContratadaKw * 2) {
    avisos.push(
      'La potencia recomendada supera con holgura tu potencia contratada: ' +
        'la tramitación y la conexión pueden ser más complejas.'
    );
  }
  if (potenciaMaxSuperficie < potenciaPorConsumo) {
    avisos.push(
      'La superficie disponible limita la instalación: la producción no ' +
        'llegará a cubrir todo tu consumo anual.'
    );
  }
  if (datos.tipoSuperficie === 'suelo') {
    avisos.push(
      'En suelo agrario, una instalación agrivoltaica elevada permite ' +
        'mantener el uso ganadero o agrícola bajo los paneles; requiere ' +
        'estructura específica no incluida en esta estimación.'
    );
  }

  return {
    ok: true,
    potenciaKwp,
    potenciaMaxSuperficie,
    produccionAnualKwh,
    autoconsumoKwh,
    coberturaConsumo,
    excedentesKwh,
    ahorroAnualEur,
    ahorroPorParticipanteEur: ahorroAnualEur / datos.participantes,
    co2EvitadoKg,
    capexEur,
    paybackAnios,
    semaforo,
    avisos,
  };
}

export function clasificarSemaforo(potenciaKwp, paybackAnios) {
  if (potenciaKwp < CONFIG.potenciaMinima || paybackAnios > CONFIG.paybackAmbar) {
    return {
      nivel: 'rojo',
      veredicto:
        'Con estos datos, el proyecto no parece viable: revisa superficie, consumo o precio.',
    };
  }
  if (paybackAnios > CONFIG.paybackVerde) {
    return {
      nivel: 'ambar',
      veredicto:
        'Viabilidad ajustada: el retorno estimado es largo. Merece un estudio profesional antes de decidir.',
    };
  }
  return {
    nivel: 'verde',
    veredicto:
      'Viabilidad preliminar favorable. Con estas hipótesis, el caso merece avanzar a una revisión técnica y económica detallada.',
  };
}
