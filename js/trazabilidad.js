const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

export const FUENTES = deepFreeze({
  'jrc-pvgis-53': {
    id: 'jrc-pvgis-53',
    titulo: 'PVGIS 5.3: fuentes de datos y métodos de cálculo',
    organismo: 'Joint Research Centre, Comisión Europea',
    url: 'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/general-information/data-sources-calculation-methods_en',
    consultada: '2026-07-28',
    alcance: 'Recurso solar, pérdidas globales, degradación y referencia LCOE.',
    limite: 'No modela sombras próximas, obstáculos locales ni el diseño definitivo.',
  },
  'idae-pct-fv-2011': {
    id: 'idae-pct-fv-2011',
    titulo: 'Pliego de condiciones técnicas de instalaciones FV conectadas a red',
    organismo: 'Instituto para la Diversificación y Ahorro de la Energía',
    url: 'https://www.idae.es/publicaciones/instalaciones-de-energia-solar-fotovoltaica-pliego-de-condiciones-tecnicas-de',
    consultada: '2026-07-28',
    alcance: 'Comprobación orientativa de pérdidas por orientación e inclinación.',
    limite: 'No sustituye una simulación del plano exacto ni un estudio de sombras.',
  },
  'boe-rdl-7-2026': {
    id: 'boe-rdl-7-2026',
    titulo: 'Real Decreto-ley 7/2026',
    organismo: 'Boletín Oficial del Estado',
    url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-6544',
    consultada: '2026-07-28',
    alcance: 'Proximidad del autoconsumo colectivo y gestor de autoconsumo.',
    limite: 'El encaje exige revisar modalidad, conexión, medida y condiciones del caso.',
  },
  'boe-rd-916-2025': {
    id: 'boe-rd-916-2025',
    titulo: 'Real Decreto 916/2025',
    organismo: 'Boletín Oficial del Estado',
    url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-20583',
    consultada: '2026-07-28',
    alcance: 'Elegibilidad PAC de agrivoltaica en tierra de cultivo o cultivo permanente.',
    limite: 'No permite generalizar automáticamente a pastos ni a cualquier suelo agrario.',
  },
  'ue-rec-2026-1007': {
    id: 'ue-rec-2026-1007',
    titulo: 'Recomendación (UE) 2026/1007',
    organismo: 'Comisión Europea',
    url: 'https://www.boe.es/buscar/doc.php?id=DOUE-L-2026-80665',
    consultada: '2026-07-28',
    alcance: 'Ventanilla única, herramientas abiertas, accesibilidad y predesarrollo.',
    limite: 'Orienta políticas y apoyo; no decide el cumplimiento de un proyecto concreto.',
  },
  'wcag-22': {
    id: 'wcag-22',
    titulo: 'Web Content Accessibility Guidelines 2.2',
    organismo: 'World Wide Web Consortium',
    url: 'https://www.w3.org/TR/WCAG22/',
    consultada: '2026-07-28',
    alcance: 'Objetivo de accesibilidad WCAG 2.2 nivel AA.',
    limite: 'La conformidad formal requiere una evaluación completa del contenido publicado.',
  },
});

export const SUPUESTOS = deepFreeze({
  'perdidas-pvgis': {
    id: 'perdidas-pvgis',
    valor: 14,
    unidad: '%',
    estado: 'documentado',
    fuenteId: 'jrc-pvgis-53',
  },
  'degradacion-inicial': {
    id: 'degradacion-inicial',
    valor: 0.5,
    unidad: '%/año',
    estado: 'documentado',
    fuenteId: 'jrc-pvgis-53',
  },
  'opex-inicial': {
    id: 'opex-inicial',
    valor: 2,
    unidad: '% CAPEX/año',
    estado: 'documentado',
    fuenteId: 'jrc-pvgis-53',
  },
  'densidad-cubierta': {
    id: 'densidad-cubierta',
    valor: 5,
    unidad: 'm²/kWp',
    estado: 'hipotesis-cera',
    fuenteId: null,
  },
  'densidad-aparcamiento': {
    id: 'densidad-aparcamiento',
    valor: 6.5,
    unidad: 'm²/kWp',
    estado: 'hipotesis-cera',
    fuenteId: null,
  },
  'densidad-suelo': {
    id: 'densidad-suelo',
    valor: 8,
    unidad: 'm²/kWp',
    estado: 'hipotesis-cera',
    fuenteId: null,
  },
  'perfil-sintetico': {
    id: 'perfil-sintetico',
    valor: 'CERA-288',
    unidad: 'mes-hora normalizado',
    estado: 'hipotesis-cera',
    fuenteId: null,
  },
});

export function fuente(id) {
  const item = FUENTES[id];
  if (!item) throw new RangeError(`Fuente desconocida: ${id}`);
  return item;
}

export function supuesto(id) {
  const item = SUPUESTOS[id];
  if (!item) throw new RangeError(`Supuesto desconocido: ${id}`);
  return item;
}
