function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const AUDIENCIAS = deepFreeze({
  ayuntamiento: {
    nombre: 'Ayuntamiento',
    objetivoRecomendado: 'activar-activos',
    promesa: 'Detecta si cubiertas, consumos y equipamientos municipales pueden activar una iniciativa energética local.',
    lecturas: ['Activos públicos disponibles', 'Cobertura energética conjunta', 'Ruta de promoción y validación'],
    accion: 'Preparar inventario de cubiertas, suministros y participantes.',
  },
  cooperativa: {
    nombre: 'Cooperativa',
    objetivoRecomendado: 'evaluar-grupo',
    promesa: 'Comprueba si la combinación de socios, consumos y superficies justifica organizar un estudio compartido.',
    lecturas: ['Complementariedad de perfiles', 'Autoconsumo y excedentes', 'Escenarios de dimensionamiento'],
    accion: 'Acordar datos de consumo y criterios iniciales de reparto.',
  },
  particular: {
    nombre: 'Particular',
    objetivoRecomendado: 'entender-participacion',
    promesa: 'Entiende cómo participar en generación compartida aunque tu vivienda no disponga de una cubierta adecuada.',
    lecturas: ['Papel dentro de la comunidad', 'Ahorro orientativo', 'Datos que deben reunirse'],
    accion: 'Contrastar el escenario con vecinos, ayuntamiento o cooperativa.',
  },
  empresa: {
    nombre: 'Empresa o explotación',
    objetivoRecomendado: 'aprovechar-activo',
    promesa: 'Valora si un consumo diurno, una cubierta o un terreno pueden actuar como activo tractor de la comunidad.',
    lecturas: ['Coincidencia horaria', 'Potencia instalable', 'Función como productor o consumidor'],
    accion: 'Validar perfil horario, superficie y condiciones de conexión.',
  },
});

export function audiencia(id) {
  const item = AUDIENCIAS[id];
  if (!item) throw new RangeError(`Audiencia desconocida: ${id}`);
  return item;
}

export function proximoPaso(id) {
  const item = audiencia(id);
  return Object.freeze({
    titulo: `Siguiente paso para ${item.nombre.toLocaleLowerCase('es')}`,
    accion: item.accion,
  });
}

export function matrizMadurez(resultado) {
  return deepFreeze([
    { id: 'recurso', titulo: 'Recurso y energía', estado: resultado.confianza.recurso },
    { id: 'encaje', titulo: 'Encaje consumo–generación', estado: resultado.confianza.encajeEnergetico },
    { id: 'implantacion', titulo: 'Implantación', estado: resultado.confianza.implantacion },
    { id: 'proyecto', titulo: 'Diseño eléctrico y certificación', estado: resultado.confianza.certificacion },
  ]);
}
