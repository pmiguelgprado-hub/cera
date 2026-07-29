import { writeFile } from 'node:fs/promises';

const API = 'https://re.jrc.ec.europa.eu/api/v5_3/seriescalc';
const PERIOD = [2020, 2023];
const POINTS = [
  ['occidente', 'Occidente costero', 'Vegadeo', 43.468, -7.053, 37, 1, 'Castropol, Vegadeo, Tapia, Navia, Coaña, los Oscos y su entorno'],
  ['suroccidente', 'Suroccidente', 'Cangas del Narcea', 43.178, -6.550, 35, 0, 'Cangas del Narcea, Tineo, Allande, Ibias, Degaña, Somiedo y Valdés'],
  ['aviles', 'Avilés y bajo Nalón', 'Avilés', 43.556, -5.924, 38, 0, 'Avilés, Castrillón, Gozón, Corvera, Pravia, Cudillero y Salas'],
  ['centro', 'Centro', 'Oviedo', 43.361, -5.849, 38, -3, 'Oviedo, Llanera, Grado, Las Regueras, Proaza y valles centrales'],
  ['gijon', 'Gijón y Cabo Peñas', 'Gijón', 43.532, -5.661, 37, 0, 'Gijón, Carreño, Villaviciosa, Colunga y Cabranes'],
  ['caudal', 'Cuencas del Caudal', 'Mieres', 43.250, -5.776, 36, 11, 'Mieres, Lena, Aller, Morcín, Riosa, Quirós y Teverga'],
  ['nalon', 'Cuencas del Nalón', 'Langreo', 43.307, -5.693, 37, -2, 'Langreo, San Martín del Rey Aurelio, Laviana, Siero, Piloña y Nava'],
  ['oriente', 'Oriente', 'Llanes', 43.421, -4.755, 37, -7, 'Llanes, Ribadesella, Cangas de Onís, Cabrales, Parres y los Picos'],
];

function endpoint([, , , lat, lon, angle, aspect]) {
  const query = new URLSearchParams({
    lat, lon,
    startyear: PERIOD[0],
    endyear: PERIOD[1],
    pvcalculation: 1,
    peakpower: 1,
    loss: 14,
    angle,
    aspect,
    mountingplace: 'free',
    usehorizon: 1,
    outputformat: 'json',
  });
  return `${API}?${query}`;
}

function aggregate(hourly) {
  const bins = Array.from({ length: 12 }, () => Array(24).fill(0));
  const years = new Set();
  for (const row of hourly) {
    const month = Number(row.time.slice(4, 6)) - 1;
    const hour = Number(row.time.slice(9, 11));
    years.add(row.time.slice(0, 4));
    bins[month][hour] += Math.max(Number(row.P) || 0, 0) / 1000;
  }
  const divisor = years.size;
  const horariaMensual = bins.map((row) => row.map((value) => value / divisor));
  const mensual = horariaMensual.map((row) => row.reduce((sum, value) => sum + value, 0));
  return { horariaMensual, mensual, ey: mensual.reduce((sum, value) => sum + value, 0) };
}

const zones = [];
for (const point of POINTS) {
  const url = endpoint(point);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${point[0]}: PVGIS HTTP ${response.status}`);
  const payload = await response.json();
  const [id, nombre, punto, lat, lon, angulo, azimut, concejos] = point;
  zones.push({
    id, nombre, punto, lat, lon, angulo, azimut, concejos,
    ...aggregate(payload.outputs.hourly),
    sourceUrl: url,
  });
}

const meta = {
  provider: 'JRC PVGIS',
  version: '5.3',
  period: PERIOD,
  lossPercent: 14,
  extractedAt: new Date().toISOString().slice(0, 10),
  api: `${API}`,
};

const moduleText = `export const PVGIS_META = Object.freeze(${JSON.stringify(meta, null, 2)});\n` +
  `export const ZONAS_SOLARES = Object.freeze(${JSON.stringify(zones, null, 2)}.map((zone) => Object.freeze(zone)));\n` +
  `export function zonaSolar(id) { const zone = ZONAS_SOLARES.find((item) => item.id === id); if (!zone) throw new RangeError('Zona solar desconocida: ' + id); return zone; }\n` +
  `export function serieSolar288(id) { return zonaSolar(id).horariaMensual.flat(); }\n`;

await writeFile(new URL('../js/solar-data.js', import.meta.url), moduleText, 'utf8');
