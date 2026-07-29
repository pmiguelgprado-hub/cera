function exigirNumeroFinito(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} debe ser un número finito`);
  }
}

function exigirNoNegativo(value, name) {
  exigirNumeroFinito(value, name);
  if (value < 0) {
    throw new TypeError(`${name} no puede ser negativo`);
  }
}

function validarEntrada(input) {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('La entrada económica debe ser un objeto');
  }

  exigirNoNegativo(input.capexEur, 'capexEur');
  exigirNoNegativo(input.energiaAnio1Kwh, 'energiaAnio1Kwh');
  exigirNumeroFinito(input.valorEnergiaEurKwh, 'valorEnergiaEurKwh');
  exigirNoNegativo(input.opexVariableEurKwh, 'opexVariableEurKwh');
  exigirNoNegativo(input.opexFijoEurAnio, 'opexFijoEurAnio');
  exigirNumeroFinito(input.degradacion, 'degradacion');

  if (input.degradacion < 0 || input.degradacion >= 1) {
    throw new TypeError('degradacion debe estar entre 0 y menor que 1');
  }

  if (!Number.isInteger(input.vidaUtilAnios) || input.vidaUtilAnios <= 0) {
    throw new TypeError('vidaUtilAnios debe ser un entero positivo');
  }
}

function validarTasaDescuento(discountRate) {
  exigirNumeroFinito(discountRate, 'discountRate');
  if (discountRate < 0) {
    throw new TypeError('discountRate no puede ser negativo');
  }
}

function validarFilas(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('rows debe ser un array');
  }

  for (const row of rows) {
    if (row === null || typeof row !== 'object') {
      throw new TypeError('Cada fila debe ser un objeto');
    }
    exigirNumeroFinito(row.anio, 'row.anio');
    exigirNumeroFinito(row.energiaKwh, 'row.energiaKwh');
    exigirNumeroFinito(row.costesEur, 'row.costesEur');
    exigirNumeroFinito(row.netoEur, 'row.netoEur');
  }
}

export function flujoEconomico(input) {
  validarEntrada(input);

  const rows = [{
    anio: 0,
    energiaKwh: 0,
    ingresoEur: 0,
    opexEur: 0,
    costesEur: input.capexEur,
    netoEur: -input.capexEur,
  }];

  for (let year = 1; year <= input.vidaUtilAnios; year += 1) {
    const energy = input.energiaAnio1Kwh * (1 - input.degradacion) ** (year - 1);
    const revenue = energy * input.valorEnergiaEurKwh;
    const opex = input.opexFijoEurAnio + energy * input.opexVariableEurKwh;
    rows.push({
      anio: year,
      energiaKwh: energy,
      ingresoEur: revenue,
      opexEur: opex,
      costesEur: opex,
      netoEur: revenue - opex,
    });
  }

  return rows;
}

export function valorActualNeto(rows, discountRate) {
  validarFilas(rows);
  validarTasaDescuento(discountRate);
  return rows.reduce(
    (sum, row) => sum + row.netoEur / (1 + discountRate) ** row.anio,
    0,
  );
}

export function costeNiveladoEnergia(rows, discountRate) {
  validarFilas(rows);
  validarTasaDescuento(discountRate);
  const costs = rows.reduce(
    (sum, row) => sum + row.costesEur / (1 + discountRate) ** row.anio,
    0,
  );
  const energy = rows.reduce(
    (sum, row) => sum + row.energiaKwh / (1 + discountRate) ** row.anio,
    0,
  );
  return energy > 0 ? costs / energy : Infinity;
}

function payback(rows, discountRate) {
  validarFilas(rows);
  validarTasaDescuento(discountRate);

  let cumulative = rows[0]?.netoEur ?? 0;
  for (let index = 1; index < rows.length; index += 1) {
    const cash = rows[index].netoEur / (1 + discountRate) ** rows[index].anio;
    const previous = cumulative;
    cumulative += cash;
    if (cumulative >= 0 && cash > 0) {
      return rows[index].anio - 1 + (-previous / cash);
    }
  }
  return Infinity;
}

export const retornoSimple = (rows) => payback(rows, 0);
export const retornoDescontado = (rows, discountRate) => payback(rows, discountRate);
