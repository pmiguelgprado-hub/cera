const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH = {
  residencial: [1.18, 1.12, 1.04, 0.96, 0.91, 0.86, 0.84, 0.86, 0.93, 1.01, 1.11, 1.18],
  municipal: [1.08, 1.05, 1.02, 1.00, 0.98, 0.92, 0.82, 0.80, 0.98, 1.04, 1.08, 1.12],
  comercial: [1.00, 0.98, 1.00, 1.00, 1.02, 1.04, 1.06, 1.03, 1.01, 1.00, 0.98, 0.98],
  productivo: [1.00, 1.00, 1.02, 1.04, 1.05, 1.06, 1.04, 0.92, 1.03, 1.04, 1.00, 0.98],
};

function hourWeight(profile, hour) {
  if (profile === 'residencial') {
    if (hour < 6) return 0.35;
    if (hour < 9) return 0.95;
    if (hour < 17) return 0.55;
    if (hour < 23) return 1.45;
    return 0.65;
  }
  if (profile === 'municipal') return hour >= 7 && hour < 18 ? 1.25 : 0.22;
  if (profile === 'comercial') return hour >= 8 && hour < 21 ? 1.18 : 0.12;
  return hour >= 6 && hour < 19 ? 1.12 : 0.32;
}

function reconcile(values, total) {
  const result = values.slice();
  const prefix = result.slice(0, -1).reduce((sum, value) => sum + value, 0);
  result[result.length - 1] = total - prefix;
  return result;
}

function normalized(profile) {
  const raw = MONTH[profile].flatMap((monthWeight, month) =>
    Array.from({ length: 24 }, (_, hour) => monthWeight * DAYS[month] * hourWeight(profile, hour)),
  );
  const sum = raw.reduce((acc, value) => acc + value, 0);
  return reconcile(raw.map((value) => value / sum), 1);
}

function validateAnnualConsumption(consumoAnualKwh) {
  if (!Number.isFinite(consumoAnualKwh) || consumoAnualKwh < 0) {
    throw new RangeError('El consumo anual debe ser un número finito no negativo.');
  }
}

function parseNumber(text, decimalComma) {
  if (text === '') return Number.NaN;
  return Number(decimalComma ? text.replace(',', '.') : text);
}

const base = Object.fromEntries(['residencial', 'municipal', 'comercial', 'productivo'].map((id) => [id, normalized(id)]));

export function mezclarPerfiles(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new TypeError('La mezcla debe ser un objeto de pesos por perfil.');
  }
  const entries = Object.entries(weights);
  if (entries.length === 0) throw new RangeError('La mezcla necesita al menos un peso positivo.');
  for (const [id, weight] of entries) {
    if (!Object.hasOwn(base, id)) throw new RangeError(`Perfil desconocido en la mezcla: ${id}`);
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError(`Peso inválido para ${id}.`);
  }
  const positiveEntries = entries.filter(([, weight]) => weight > 0);
  const sumWeights = positiveEntries.reduce((sum, [, weight]) => sum + weight, 0);
  if (sumWeights <= 0) throw new RangeError('La mezcla necesita al menos un peso positivo.');
  return reconcile(Array.from({ length: 288 }, (_, index) =>
    positiveEntries.reduce((sum, [id, weight]) => sum + base[id][index] * weight / sumWeights, 0),
  ), 1);
}

export const PERFILES_CONSUMO = Object.freeze({
  residencial: Object.freeze(base.residencial),
  municipal: Object.freeze(base.municipal),
  comercial: Object.freeze(base.comercial),
  productivo: Object.freeze(base.productivo),
  mixto: Object.freeze(mezclarPerfiles({ residencial: 0.4, municipal: 0.2, comercial: 0.2, productivo: 0.2 })),
});

export const PERFILES_META = Object.freeze(Object.fromEntries([
  ['residencial', 'Residencial'],
  ['municipal', 'Municipal y equipamientos'],
  ['comercial', 'Comercio y servicios'],
  ['productivo', 'Productivo o agrario'],
  ['mixto', 'Comunidad mixta'],
].map(([id, etiqueta]) => [id, Object.freeze({
  id,
  etiqueta,
  origen: 'Perfil sintético CERA',
  resolucion: '288 intervalos mes-hora',
  estado: 'Estimado',
})])));

export function serieConsumo288({ consumoAnualKwh, perfilId }) {
  validateAnnualConsumption(consumoAnualKwh);
  const profile = PERFILES_CONSUMO[perfilId];
  if (!profile) throw new RangeError(`Perfil desconocido: ${perfilId}`);
  return reconcile(profile.map((weight) => weight * consumoAnualKwh), consumoAnualKwh);
}

export function parsearPerfilCsv(text, consumoAnualKwh) {
  validateAnnualConsumption(consumoAnualKwh);
  if (typeof text !== 'string') throw new TypeError('El CSV debe ser texto.');
  const lines = text.trim().split(/\r?\n/);
  const delimiter = lines[0]?.includes(';') ? ';' : ',';
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  if (rows[0]?.map((cell) => cell.toLocaleLowerCase('es')).join(',') !== 'mes,hora,kwh') {
    throw new TypeError('Cabecera esperada: mes,hora,kwh.');
  }
  const raw = Array(288).fill(0);
  const intervalos = new Set();
  for (const row of rows.slice(1)) {
    if (row.length !== 3) throw new TypeError('Cada fila CSV debe tener tres columnas.');
    const [monthText, hourText, energyText] = row;
    const month = parseNumber(monthText, false);
    const hour = parseNumber(hourText, false);
    const energy = parseNumber(energyText, delimiter === ';');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('El mes debe estar entre 1 y 12.');
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('La hora debe estar entre 0 y 23.');
    if (!Number.isFinite(energy) || energy < 0) throw new RangeError('Los kWh deben ser no negativos.');
    const index = (month - 1) * 24 + hour;
    if (intervalos.has(index)) {
      throw new RangeError(`Intervalo mes-hora duplicado: ${month}-${hour}.`);
    }
    intervalos.add(index);
    raw[index] = energy;
  }
  if (intervalos.size !== 288) {
    throw new RangeError(`El CSV debe contener exactamente 288 intervalos mes-hora únicos; contiene ${intervalos.size}.`);
  }
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) throw new RangeError('El CSV no contiene consumo positivo.');
  return reconcile(raw.map((value) => value / sum * consumoAnualKwh), consumoAnualKwh);
}
