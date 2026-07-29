const INTERVALOS = 288;
const HORAS_POR_MES = 24;
const MESES = 12;
const MAX_CANDIDATOS = 10_000;
const MAX_CANDIDATOS_POR_DEFECTO = 1000;
export const DENSIDADES_SUPERFICIE = Object.freeze({
  cubierta: Object.freeze({ valor: 5, unidad: 'm²/kWp', estado: 'Hipótesis CERA' }),
  aparcamiento: Object.freeze({ valor: 6.5, unidad: 'm²/kWp', estado: 'Hipótesis CERA' }),
  suelo: Object.freeze({ valor: 8, unidad: 'm²/kWp', estado: 'Hipótesis CERA' }),
});

function validarNoNegativo(valor, nombre) {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nombre} debe ser un numero finito no negativo.`);
  }
}

function validarSerie(serie, nombre) {
  if (!Array.isArray(serie) || serie.length !== INTERVALOS) {
    throw new RangeError(`Las series deben contener ${INTERVALOS} intervalos.`);
  }
  serie.forEach((valor, indice) => validarNoNegativo(valor, `${nombre}[${indice}]`));
}

function crearAcumulado() {
  return {
    generacionKwh: 0,
    consumoKwh: 0,
    autoconsumoKwh: 0,
    excedentesKwh: 0,
    compraRedKwh: 0,
  };
}

function sumarIntervalo(acumulado, intervalo) {
  acumulado.generacionKwh += intervalo.generacionKwh;
  acumulado.consumoKwh += intervalo.consumoKwh;
  acumulado.autoconsumoKwh += intervalo.autoconsumoKwh;
  acumulado.excedentesKwh += intervalo.excedentesKwh;
  acumulado.compraRedKwh += intervalo.compraRedKwh;
}

export function potenciaMaximaSuperficie({ superficieM2, fraccionUtil, tipoSuperficie }) {
  validarNoNegativo(superficieM2, 'La superficie');
  if (!Number.isFinite(fraccionUtil) || fraccionUtil < 0 || fraccionUtil > 1) {
    throw new RangeError('La fraccion util debe ser un numero finito entre 0 y 1.');
  }

  const density = DENSIDADES_SUPERFICIE[tipoSuperficie]?.valor;
  if (!density) throw new RangeError(`Superficie desconocida: ${tipoSuperficie}`);

  return Math.floor((superficieM2 * fraccionUtil / density) * 10) / 10;
}

export function balanceTemporal({ solarKwhKwp, consumoKwh, potenciaKwp }) {
  validarSerie(solarKwhKwp, 'solarKwhKwp');
  validarSerie(consumoKwh, 'consumoKwh');
  validarNoNegativo(potenciaKwp, 'La potencia');

  const mensual = Array.from({ length: MESES }, crearAcumulado);
  const horariaMedia = Array.from({ length: HORAS_POR_MES }, crearAcumulado);
  const total = crearAcumulado();

  solarKwhKwp.forEach((specific, indice) => {
    const generacionKwh = specific * potenciaKwp;
    if (!Number.isFinite(generacionKwh)) {
      throw new RangeError(`La generacion en el intervalo ${indice} no es finita.`);
    }

    const consumoIntervaloKwh = consumoKwh[indice];
    const autoconsumoKwh = Math.min(generacionKwh, consumoIntervaloKwh);
    const intervalo = {
      generacionKwh,
      consumoKwh: consumoIntervaloKwh,
      autoconsumoKwh,
      excedentesKwh: generacionKwh - autoconsumoKwh,
      compraRedKwh: consumoIntervaloKwh - autoconsumoKwh,
    };

    sumarIntervalo(total, intervalo);
    sumarIntervalo(mensual[Math.floor(indice / HORAS_POR_MES)], intervalo);
    sumarIntervalo(horariaMedia[indice % HORAS_POR_MES], intervalo);
  });

  return {
    ...total,
    tasaAutoconsumo: total.generacionKwh > 0 ? total.autoconsumoKwh / total.generacionKwh : 0,
    coberturaSolar: total.consumoKwh > 0 ? total.autoconsumoKwh / total.consumoKwh : 0,
    mensual,
    horariaMedia,
  };
}

export function candidatosPotencia(maximum, { pasoKwp } = {}) {
  validarNoNegativo(maximum, 'La potencia maxima');
  const defaultStep = Math.max(
    maximum <= 10 ? 0.5 : 1,
    maximum / MAX_CANDIDATOS_POR_DEFECTO,
  );
  const step = pasoKwp === undefined ? defaultStep : pasoKwp;
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError('El paso debe ser un numero finito mayor que cero.');
  }
  if (maximum < step) return [maximum];

  const cantidadCandidatos = Math.ceil(maximum / step);
  if (!Number.isFinite(cantidadCandidatos) || cantidadCandidatos > MAX_CANDIDATOS) {
    throw new RangeError(`El paso produciria demasiados candidatos (maximo ${MAX_CANDIDATOS}).`);
  }

  const values = [];
  const pasosCompletos = Math.floor(maximum / step);
  for (let paso = 1; paso <= pasosCompletos; paso += 1) {
    const value = Number((paso * step).toFixed(3));
    if (value < maximum) values.push(value);
  }
  values.push(maximum);
  return [...new Set(values)];
}

export function factorOrientacionInclinacion({ inclinacion, azimut, latitud }) {
  for (const [nombre, valor] of Object.entries({ inclinacion, azimut, latitud })) {
    if (!Number.isFinite(valor)) throw new TypeError(`${nombre} debe ser un numero finito.`);
  }
  if (inclinacion < 0 || inclinacion > 90) {
    throw new RangeError('inclinacion debe estar entre 0 y 90.');
  }
  if (azimut < -180 || azimut > 180) {
    throw new RangeError('azimut debe estar entre -180 y 180.');
  }
  if (latitud < -90 || latitud > 90) {
    throw new RangeError('latitud debe estar entre -90 y 90.');
  }
  const perdidaInclinacion = 1.2e-4 * (inclinacion - latitud + 10) ** 2;
  const perdidaOrientacion = inclinacion <= 15 ? 0 : 3.5e-5 * azimut ** 2;
  return Math.max(0, 1 - perdidaInclinacion - perdidaOrientacion);
}
