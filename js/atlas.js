import { ZONAS_SOLARES, zonaSolar } from './solar-data.js';

const MESES = [
  ['E', 'Enero'], ['F', 'Febrero'], ['M', 'Marzo'], ['A', 'Abril'],
  ['M', 'Mayo'], ['J', 'Junio'], ['J', 'Julio'], ['A', 'Agosto'],
  ['S', 'Septiembre'], ['O', 'Octubre'], ['N', 'Noviembre'], ['D', 'Diciembre'],
];

export const ZONAS = ZONAS_SOLARES;
export const MEDIA_ASTURIAS = Math.round(
  ZONAS.reduce((sum, zone) => sum + zone.ey, 0) / ZONAS.length,
);

export function serieMensual(id) {
  const zone = zonaSolar(id);
  return zone.mensual.map((valor, index) => ({
    mes: MESES[index][0],
    nombre: MESES[index][1],
    valor,
  }));
}

export function comparacionRegional(ey) {
  const diferencia = Math.round(ey - MEDIA_ASTURIAS);
  const porcentaje = Math.round((diferencia / MEDIA_ASTURIAS) * 100);
  return {
    diferencia: Math.abs(diferencia),
    porcentaje: Math.abs(porcentaje),
    posicion: diferencia >= 0 ? 'por encima' : 'por debajo',
  };
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
}

export function buscarZonas(consulta) {
  const termino = normalizar(consulta.trim());
  if (!termino) return ZONAS;
  return ZONAS.filter((zona) =>
    normalizar([zona.nombre, zona.punto, zona.concejos].join(' ')).includes(termino),
  );
}

export function concejoCoincidente(zona, consulta) {
  if (!zona) return undefined;
  const termino = normalizar(consulta.trim());
  if (!termino) return zona.punto;
  const concejos = zona.concejos.split(',').map((concejo) => concejo.trim());
  return concejos.find((concejo) => normalizar(concejo).includes(termino)) ?? zona.punto;
}
