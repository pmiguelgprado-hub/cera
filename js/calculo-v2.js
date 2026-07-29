import { ZONAS_SOLARES, serieSolar288, zonaSolar } from './solar-data.js';
import { PERFILES_CONSUMO, PERFILES_META, serieConsumo288 } from './perfiles-consumo.js';
import {
  DENSIDADES_SUPERFICIE,
  balanceTemporal,
  candidatosPotencia,
  factorOrientacionInclinacion,
  potenciaMaximaSuperficie,
} from './balance-energetico.js';
import {
  costeNiveladoEnergia,
  flujoEconomico,
  retornoDescontado,
  retornoSimple,
  valorActualNeto,
} from './economia.js';
import { fuente, supuesto } from './trazabilidad.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const fuentePvgis = fuente('jrc-pvgis-53');
const fuenteIdae = fuente('idae-pct-fv-2011');

export const CONFIG = Object.freeze({
  precioExcedentes: 0.06,
  perdidasPvgisPct: supuesto('perdidas-pvgis').valor,
  capexPorKwp: 1100,
  opexPctCapex: supuesto('opex-inicial').valor,
  degradacionPct: supuesto('degradacion-inicial').valor,
  tasaDescuentoPct: 3,
  vidaUtilAnios: 25,
  umbralAutoconsumoAjuste: 0.8,
  sources: Object.freeze({
    solarId: fuentePvgis.id,
    solar: `${fuentePvgis.titulo}, serie 2020–2023, pérdidas del 14 %`,
    economics: 'Hipótesis CERA editables; contrastar con presupuesto y tarifa vigentes',
    opexId: fuentePvgis.id,
    opexTitle: fuentePvgis.titulo,
    opex: `${fuentePvgis.titulo}, metodología LCOE: O&M del 2 % del coste original cada año`,
    opexUrl: fuentePvgis.url,
  }),
});

export const LIMITES = deepFreeze({
  consumoAnualKwh: [500, 5_000_000],
  potenciaContratadaKw: [1, 5000],
  superficieM2: [10, 100_000],
  participantes: [1, 1000],
  precioElectricidad: [0.01, 1],
  precioExcedentes: [0, 0.5],
  fraccionSuperficieUtil: [0.2, 1],
  inclinacionDeg: [0, 90],
  azimutDeg: [-180, 180],
  perdidasPct: [0, 40],
  capexPorKwp: [100, 5000],
  opexPctCapex: [0, 10],
  degradacionPct: [0, 3],
  tasaDescuentoPct: [0, 20],
  vidaUtilAnios: [10, 40],
});

const ENUMS = Object.freeze({
  tipoUsuario: ['ayuntamiento', 'cooperativa', 'particular', 'empresa'],
  objetivo: ['activar-activos', 'evaluar-grupo', 'entender-participacion', 'aprovechar-activo'],
  tipoSuperficie: ['cubierta', 'suelo', 'aparcamiento'],
  perfilConsumo: Object.keys(PERFILES_CONSUMO),
  estrategiaDimensionado: ['ajuste', 'equilibrio', 'maximo'],
});

const SENSITIVITY = deepFreeze([
  { id: 'conservador', capexFactor: 1.15, compraFactor: 0.90, excedenteFactor: 0.85 },
  { id: 'central', capexFactor: 1, compraFactor: 1, excedenteFactor: 1 },
  { id: 'favorable', capexFactor: 0.90, compraFactor: 1.10, excedenteFactor: 1.10 },
]);

export function validar(datos) {
  const errors = {};
  const input = datos && typeof datos === 'object' ? datos : {};

  for (const [field, [minimum, maximum]] of Object.entries(LIMITES)) {
    const value = input[field];
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      errors[field] = `Introduce un valor entre ${minimum.toLocaleString('es-ES')} y ${maximum.toLocaleString('es-ES')}.`;
    }
  }
  for (const field of ['participantes', 'vidaUtilAnios']) {
    if (Number.isFinite(input[field]) && !Number.isInteger(input[field])) {
      errors[field] = 'Introduce un número entero.';
    }
  }
  for (const [field, values] of Object.entries(ENUMS)) {
    if (!values.includes(input[field])) errors[field] = 'Selecciona una opción válida.';
  }
  if (!ZONAS_SOLARES.some(({ id }) => id === input.zonaId)) {
    errors.zonaId = 'Selecciona una zona solar disponible.';
  }
  if (input.perfilPersonalizado !== undefined) {
    const shapeIsValid = Array.isArray(input.perfilPersonalizado) && input.perfilPersonalizado.length === 288;
    const valuesAreValid = shapeIsValid && input.perfilPersonalizado.every(
      (value) => Number.isFinite(value) && value >= 0,
    );
    const total = valuesAreValid
      ? input.perfilPersonalizado.reduce((sum, value) => sum + value, 0)
      : Number.NaN;
    const reconcilesConsumption = Number.isFinite(total) &&
      Math.abs(total - input.consumoAnualKwh) <= 1e-6;
    if (!valuesAreValid || !reconcilesConsumption) {
      errors.perfilPersonalizado = 'El perfil personalizado debe contener 288 valores no negativos.';
    }
  }
  return errors;
}

function evaluateCandidate(power, data, solarSeries, loadSeries) {
  const balance = balanceTemporal({
    solarKwhKwp: solarSeries,
    consumoKwh: loadSeries,
    potenciaKwp: power,
  });
  const grossValue = balance.autoconsumoKwh * data.precioElectricidad +
    balance.excedentesKwh * data.precioExcedentes;
  const capex = power * data.capexPorKwp;
  const flow = flujoEconomico({
    capexEur: capex,
    energiaAnio1Kwh: balance.generacionKwh,
    valorEnergiaEurKwh: balance.generacionKwh > 0 ? grossValue / balance.generacionKwh : 0,
    opexVariableEurKwh: 0,
    opexFijoEurAnio: capex * data.opexPctCapex / 100,
    degradacion: data.degradacionPct / 100,
    tasaDescuento: data.tasaDescuentoPct / 100,
    vidaUtilAnios: data.vidaUtilAnios,
  });
  return {
    potenciaKwp: power,
    balance,
    capexEur: capex,
    ahorroBrutoAnio1Eur: grossValue,
    flujoCaja: flow,
    vanEur: valorActualNeto(flow, data.tasaDescuentoPct / 100),
    lcoeEurKwh: costeNiveladoEnergia(flow, data.tasaDescuentoPct / 100),
    paybackAnios: retornoSimple(flow),
    paybackDescontadoAnios: retornoDescontado(flow, data.tasaDescuentoPct / 100),
  };
}

function sizingScenarios(candidates) {
  const adjustmentPool = candidates.filter(
    ({ balance }) => balance.tasaAutoconsumo >= CONFIG.umbralAutoconsumoAjuste,
  );
  const adjustmentMeetsRule = adjustmentPool.length > 0;
  const adjustment = adjustmentMeetsRule ? adjustmentPool.at(-1) : candidates[0];
  const equilibrium = candidates.reduce(
    (best, item) => item.vanEur > best.vanEur ? item : best,
  );
  const maximum = candidates.at(-1);
  return [
    {
      id: 'ajuste',
      label: 'Ajuste a consumo',
      regla: adjustmentMeetsRule
        ? 'Mayor potencia con al menos 80 % de autoconsumo'
        : 'Ningún candidato alcanza el 80 %; se muestra la menor potencia evaluada',
      cumpleRegla: adjustmentMeetsRule,
      ...adjustment,
    },
    { id: 'equilibrio', label: 'Equilibrio recomendado', regla: 'Mayor VAN con las hipótesis centrales', ...equilibrium },
    { id: 'maximo', label: 'Máximo aprovechamiento', regla: 'Potencia máxima permitida por la superficie útil', ...maximum },
  ];
}

function buildHypotheses(data, zone, orientationFactor) {
  const profileOrigin = data.perfilPersonalizado ? 'CSV local' : 'Perfil sintético CERA';
  const density = DENSIDADES_SUPERFICIE[data.tipoSuperficie];
  const densityLabel = {
    cubierta: 'Cubierta',
    aparcamiento: 'Aparcamiento',
    suelo: 'Suelo',
  }[data.tipoSuperficie];
  return [
    `Recurso: PVGIS 5.3 en ${zone.punto}, ${zone.ey.toFixed(0)} kWh/kWp·año antes de ajustes del caso.`,
    `Corrección orientativa IDAE respecto de la latitud (${zone.lat.toFixed(3)}°): factor ${orientationFactor.toFixed(3)}; no incluye sombras próximas ni una nueva simulación PVGIS del plano exacto. Fuente: ${fuenteIdae.url}.`,
    `Pérdidas globales introducidas: ${data.perdidasPct.toFixed(1)} %.`,
    `Perfil de consumo: ${profileOrigin}; 288 intervalos en orden month-major (mes→hora), unidad kWh y periodo anual.`,
    `Densidad geométrica: ${densityLabel} · ${density.valor.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${density.unidad} · ${density.estado}.`,
    `Superficie utilizable: ${(data.fraccionSuperficieUtil * 100).toFixed(0)} %.`,
    `CAPEX: ${data.capexPorKwp.toFixed(0)} EUR/kWp.`,
    `O&M: ${data.opexPctCapex.toFixed(1)} % del CAPEX/año; hipótesis editable basada en JRC ${CONFIG.sources.opexTitle}: ${CONFIG.sources.opexUrl}.`,
    `Degradación: ${data.degradacionPct.toFixed(2)} %/año; descuento: ${data.tasaDescuentoPct.toFixed(2)} %; vida: ${data.vidaUtilAnios} años.`,
    'La preverificación no sustituye visita, estudio estructural, diseño eléctrico, tramitación ni certificación.',
  ];
}

export function calcular(datos) {
  const errores = validar(datos);
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const zone = zonaSolar(datos.zonaId);
  const factorOrientacion = factorOrientacionInclinacion({
    inclinacion: datos.inclinacionDeg,
    azimut: datos.azimutDeg,
    latitud: zone.lat,
  });
  const factorPerdidas = (1 - datos.perdidasPct / 100) /
    (1 - CONFIG.perdidasPvgisPct / 100);
  const solarSeries = serieSolar288(datos.zonaId).map(
    (value) => value * factorOrientacion * factorPerdidas,
  );
  const loadSeries = datos.perfilPersonalizado ?? serieConsumo288({
    consumoAnualKwh: datos.consumoAnualKwh,
    perfilId: datos.perfilConsumo,
  });
  const maximumPower = potenciaMaximaSuperficie({
    superficieM2: datos.superficieM2,
    fraccionUtil: datos.fraccionSuperficieUtil,
    tipoSuperficie: datos.tipoSuperficie,
  });
  const candidates = candidatosPotencia(maximumPower).map(
    (power) => evaluateCandidate(power, datos, solarSeries, loadSeries),
  );
  const escenariosDimensionado = sizingScenarios(candidates);
  const selected = escenariosDimensionado.find(
    ({ id }) => id === datos.estrategiaDimensionado,
  );
  const sensibilidad = SENSITIVITY.map((assumption) => {
    const variant = evaluateCandidate(selected.potenciaKwp, {
      ...datos,
      capexPorKwp: datos.capexPorKwp * assumption.capexFactor,
      precioElectricidad: datos.precioElectricidad * assumption.compraFactor,
      precioExcedentes: datos.precioExcedentes * assumption.excedenteFactor,
    }, solarSeries, loadSeries);
    return {
      id: assumption.id,
      supuestos: assumption,
      vanEur: variant.vanEur,
      paybackDescontadoAnios: variant.paybackDescontadoAnios,
    };
  });
  const trazabilidadPerfil = {
    orden: 'month-major',
    recorrido: 'mes→hora',
    unidad: 'kWh',
    periodo: 'anual',
    origen: datos.perfilPersonalizado ? 'CSV local' : 'Perfil sintético CERA',
  };
  const fuentePerfil = datos.perfilPersonalizado
    ? 'CSV local aportado por el usuario'
    : `${PERFILES_META[datos.perfilConsumo].origen}: ${PERFILES_META[datos.perfilConsumo].etiqueta}`;

  return {
    ok: true,
    ...selected,
    produccionAnualKwh: selected.balance.generacionKwh,
    autoconsumoKwh: selected.balance.autoconsumoKwh,
    excedentesKwh: selected.balance.excedentesKwh,
    coberturaConsumo: selected.balance.coberturaSolar,
    tasaAutoconsumo: selected.balance.tasaAutoconsumo,
    ahorroAnualEur: selected.ahorroBrutoAnio1Eur,
    ahorroPorParticipanteEur: selected.ahorroBrutoAnio1Eur / datos.participantes,
    factorOrientacion,
    zona: zone,
    escenariosDimensionado,
    sensibilidad,
    trazabilidadPerfil,
    semaforo: clasificarSemaforo(
      selected.vanEur,
      selected.paybackDescontadoAnios,
      datos.vidaUtilAnios,
    ),
    confianza: {
      recurso: 'Calculado',
      encajeEnergetico: datos.perfilPersonalizado ? 'Calculado' : 'Estimado',
      implantacion: 'Estimado',
      disenoElectrico: 'Validación técnica',
      certificacion: 'Validación técnica',
    },
    hipotesis: buildHypotheses(datos, zone, factorOrientacion),
    fuentes: [
      zone.sourceUrl,
      CONFIG.sources.economics,
      CONFIG.sources.opex,
      CONFIG.sources.opexUrl,
      fuentePerfil,
    ],
  };
}

export function clasificarSemaforo(vanEur, paybackDescontadoAnios, vidaUtilAnios) {
  if (vanEur > 0 && paybackDescontadoAnios <= vidaUtilAnios * 0.65) {
    return {
      nivel: 'verde',
      veredicto: 'Previabilidad favorable con datos pendientes de validación.',
    };
  }
  if (vanEur > 0 || paybackDescontadoAnios <= vidaUtilAnios) {
    return {
      nivel: 'ambar',
      veredicto: 'El escenario merece contraste antes de decidir.',
    };
  }
  return {
    nivel: 'rojo',
    veredicto: 'Conviene revisar dimensionamiento, inversión o perfil de consumo.',
  };
}
