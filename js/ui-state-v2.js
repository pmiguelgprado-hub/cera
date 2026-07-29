import { audiencia } from './producto.js';
import { zonaSolar } from './solar-data.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const PASOS = deepFreeze([
  { id: 'contexto', titulo: 'Contexto', campos: ['tipoUsuario', 'objetivo', 'zonaId', 'tipoSuperficie', 'superficieM2'] },
  { id: 'consumo', titulo: 'Comunidad y consumo', campos: ['consumoAnualKwh', 'potenciaContratadaKw', 'participantes', 'perfilConsumo', 'perfilPersonalizado', 'precioElectricidad', 'precioExcedentes'] },
  { id: 'generacion', titulo: 'Generación', campos: ['fraccionSuperficieUtil', 'inclinacionDeg', 'azimutDeg', 'perdidasPct', 'estrategiaDimensionado'] },
  { id: 'economia', titulo: 'Economía y revisión', campos: ['capexPorKwp', 'opexPctCapex', 'degradacionPct', 'tasaDescuentoPct', 'vidaUtilAnios'] },
]);

const ESTRATEGIAS = Object.freeze({
  ajuste: 'ajuste a consumo',
  equilibrio: 'equilibrio recomendado',
  maximo: 'máximo aprovechamiento',
});

const formatoEntero = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  useGrouping: 'always',
});

export function erroresDelPaso(pasoId, errores) {
  const paso = PASOS.find(({ id }) => id === pasoId);
  if (!paso) throw new RangeError(`Paso desconocido: ${pasoId}`);
  return Object.fromEntries(
    paso.campos
      .filter((campo) => errores[campo])
      .map((campo) => [campo, errores[campo]]),
  );
}

export function primerPasoConError(errores) {
  const indice = PASOS.findIndex(({ campos }) => campos.some((campo) => Boolean(errores[campo])));
  return indice === -1 ? PASOS.length - 1 : indice;
}

export function estadoDePasos(actual, maximoDisponible) {
  return PASOS.map((_, indice) => {
    if (indice < actual) return 'completado';
    if (indice === actual) return 'actual';
    if (indice <= maximoDisponible) return 'disponible';
    return 'bloqueado';
  });
}

export function resumenEscenario(datos) {
  const estrategia = ESTRATEGIAS[datos.estrategiaDimensionado];
  if (!estrategia) {
    throw new RangeError(`Estrategia de dimensionado desconocida: ${datos.estrategiaDimensionado}`);
  }
  return [
    audiencia(datos.tipoUsuario).nombre,
    zonaSolar(datos.zonaId).nombre,
    `${formatoEntero.format(datos.consumoAnualKwh)} kWh/año`,
    `${formatoEntero.format(datos.participantes)} ${datos.participantes === 1 ? 'participante' : 'participantes'}`,
    estrategia,
  ].join(' · ');
}

export function lecturaDecision(resultado) {
  const lecturas = {
    verde: {
      titulo: 'Previabilidad favorable con datos pendientes',
      accion: 'Preparar una validación técnica',
    },
    ambar: {
      titulo: 'El escenario necesita contraste',
      accion: 'Revisar hipótesis con un profesional',
    },
    rojo: {
      titulo: 'Conviene replantear el escenario',
      accion: 'Ajustar superficie, consumo o precio',
    },
  };
  const base = lecturas[resultado.semaforo.nivel];
  return Object.freeze({
    ...base,
    explicacion: `Orientación preliminar: ${resultado.semaforo.veredicto}`,
  });
}
