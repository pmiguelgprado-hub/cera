import { proximoPaso } from './producto.js';
import { fuente } from './trazabilidad.js';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const numero = (value, digits = 0) => new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: digits,
  minimumFractionDigits: digits,
}).format(value);

const porcentaje = (value) => `${numero(value * 100, 1)} %`;

function validarEntrada({ datos, resultado, audienciaId, fechaIso }) {
  if (!datos || typeof datos !== 'object') throw new TypeError('datos es obligatorio.');
  if (!resultado || resultado.ok === false || !Number.isFinite(resultado.potenciaKwp)) {
    throw new TypeError('resultado calculado es obligatorio.');
  }
  proximoPaso(audienciaId);
  if (Number.isNaN(Date.parse(fechaIso))) {
    throw new TypeError('fechaIso debe ser ISO válida.');
  }
}

export function crearPasaporte({ datos, resultado, audienciaId, fechaIso }) {
  validarEntrada({ datos, resultado, audienciaId, fechaIso });
  const sourceIds = ['boe-rdl-7-2026', 'boe-rd-916-2025'];
  sourceIds.forEach(fuente);
  const perfilOrigen = datos.perfilPersonalizado ? 'CSV local' : 'Perfil sintético CERA';
  const pacCaveat = datos.tipoSuperficie === 'suelo'
    ? 'La elegibilidad PAC completa se limita a agrivoltaica en tierra de cultivo o cultivo permanente, manteniendo la actividad agraria como principal.'
    : 'La condición PAC debe revisarse solo si el proyecto ocupa superficie agraria.';

  return deepFreeze({
    version: 'cera-pasaporte-1',
    generadoEn: fechaIso,
    secciones: [
      {
        id: 'territorio',
        titulo: 'Territorio e implantación',
        estado: resultado.confianza.recurso,
        evidencias: [
          `${resultado.zona.nombre} · referencia ${resultado.zona.punto}`,
          `${numero(datos.superficieM2)} m² de superficie geométrica declarada`,
          `Implantación: ${datos.tipoSuperficie}`,
        ],
        incertidumbre: 'Superficie útil, obstáculos, sombras, estructura y accesos requieren contraste.',
        siguienteAccion: 'Validar superficie utilizable y condicionantes mediante visita técnica.',
        fuenteIds: ['jrc-pvgis-53', 'idae-pct-fv-2011'],
      },
      {
        id: 'comunidad',
        titulo: 'Comunidad y consumo',
        estado: resultado.confianza.encajeEnergetico,
        evidencias: [
          `${numero(datos.participantes)} participantes o suministros`,
          `${perfilOrigen}: ${datos.perfilConsumo}`,
        ],
        incertidumbre: datos.perfilPersonalizado
          ? 'Revisar representatividad y periodo del CSV aportado.'
          : 'El reparto mes-hora es una hipótesis sintética, no una curva medida.',
        siguienteAccion: proximoPaso(audienciaId).accion,
        fuenteIds: [],
      },
      {
        id: 'energia',
        titulo: 'Balance energético',
        estado: resultado.confianza.encajeEnergetico,
        evidencias: [
          `${numero(resultado.potenciaKwp, 1)} kWp`,
          `${numero(resultado.produccionAnualKwh)} kWh/año de producción`,
          `${porcentaje(resultado.tasaAutoconsumo)} de autoconsumo`,
          `${porcentaje(resultado.coberturaConsumo)} de cobertura`,
          `${numero(resultado.excedentesKwh)} kWh/año de excedentes`,
        ],
        incertidumbre: 'Sombras próximas, disponibilidad, reparto y medida no están resueltos.',
        siguienteAccion: 'Contrastar el balance con consumos horarios reales y diseño de reparto.',
        fuenteIds: ['jrc-pvgis-53'],
      },
      {
        id: 'economia',
        titulo: 'Lectura económica',
        estado: 'Estimado',
        evidencias: [
          `${numero(resultado.capexEur)} EUR de CAPEX`,
          `${numero(resultado.vanEur)} EUR de VAN`,
          `${numero(resultado.lcoeEurKwh, 3)} EUR/kWh de LCOE`,
          `${numero(resultado.paybackAnios, 1)} años de retorno simple`,
          `${numero(resultado.paybackDescontadoAnios, 1)} años de retorno descontado`,
        ],
        incertidumbre: 'Coste, tarifa, compensación y financiación son hipótesis editables.',
        siguienteAccion: 'Solicitar presupuesto comparable y revisar tarifas vigentes.',
        fuenteIds: ['jrc-pvgis-53'],
      },
      {
        id: 'regulacion',
        titulo: 'Encaje regulatorio',
        estado: 'Dato pendiente',
        evidencias: [
          'Regla general de proximidad inferior a 500 m.',
          'Posible extensión inferior a 5.000 m para fotovoltaica o eólica de hasta 5 MW conectada a través de red, sujeta a las condiciones aplicables.',
          pacCaveat,
        ],
        incertidumbre: 'Faltan distancia, modalidad, conexión, puntos de medida, consumidores asociados y coeficientes de reparto.',
        siguienteAccion: 'Comprobar modalidad y designar, cuando proceda, gestor de autoconsumo.',
        fuenteIds: sourceIds,
      },
      {
        id: 'proyecto',
        titulo: 'Proyecto y puesta en servicio',
        estado: 'Validación técnica',
        evidencias: [
          'Recurso, balance y economía preliminar disponibles.',
          'Diseño eléctrico, estructura, medida y tramitación no calculados.',
        ],
        incertidumbre: 'No existe todavía proyecto, estudio estructural, acceso, legalización ni certificación.',
        siguienteAccion: 'Entregar este pasaporte a un técnico competente para definir el siguiente estudio.',
        fuenteIds: [],
      },
    ],
  });
}
