# Investigación UI — 2026-07-12 (sesión rediseño V6)

Fuentes: Playwright (Otovo, Octopus Energy ES, Holaluz, Wise ES) + vídeo
"I Studied 1000 Landing Pages, Here's What Works in 2026" (PcwuZJNJny4, 16:45,
transcript completo analizado).

## 7 lecciones del vídeo (CRO, con datos de agencia)

1. **Regla de los 5 segundos.** 60 % no pasa del above-the-fold; 100 % lo ve.
   Fórmula: headline de beneficio (dream outcome, nunca "quiénes somos"),
   subheadline = qué es + USP, ≥2 pruebas de confianza arriba, CTA accionable
   de beneficio, reductores de FUD (miedo/incertidumbre/duda) bajo el CTA,
   imagen/vídeo que complemente. Testar solo el headline dio +80 % conversión.
2. **Emoción primero, lógica después.** Fotos reales de personas/territorio
   que resuenen con la audiencia. Copy problema→agitación→solución.
3. **Página larga no mata conversión; mala estructura sí.** No esconder
   contenido en carruseles/desplegables (engagement bajísimo), sobre todo en
   móvil: exponer las pruebas, no plegarlas.
4. **La gente no lee, escanea (80/20).** Los headlines deben comunicar el
   beneficio por sí solos — prohibidos títulos genéricos tipo "Cómo funciona",
   "Nuestros servicios". Pensar como lector: ¿qué debe saberse de un vistazo?
5. **Prueba social verificable.** Logos sin contexto ya no funcionan; citas con
   fuente, nombre, foto. Para CERA (sin clientes): sustituto honesto =
   trazabilidad metodológica (PVGIS, IDAE, hipótesis visibles) y marco
   académico (MUII EPI Gijón).
6. **Jerarquía visual = mejor amiga.** Un solo flujo headline→sub→CTA con
   tamaño/peso/color. Demasiadas opciones = parálisis = abandono. Caso real:
   +64 % solo arreglando jerarquía.
7. **Simplicidad gana a creatividad (ley de Jakob).** Patrones convencionales:
   un headline, body cerca, prueba social arriba, CTA debajo, FUD-reducers,
   imagen. Nada de layouts raros por minimalismo.

## Patrones de los referentes (Playwright)

- **Otovo**: fila de badges de confianza SOBRE el H1 ("Mejor precio · 0 € inicial
  · 20 años garantía"); una sola acción de entrada; promesa temporal
  ("presupuesto en menos de un minuto").
- **Octopus**: CTA con promesa temporal ("Cámbiate en 3 minutos"); Trustpilot +
  sellos justo bajo los CTAs; identidad de color valiente y consistente.
- **Holaluz**: segmentación por necesidad en tarjetas de entrada.
- **Wise**: tipografía display gigante como statement; nav mínima; la
  calculadora ES el hero (patrón CERA).

## Diagnóstico CERA V5 (baseline capturada)

- **H1 descriptivo, no de beneficio**: "Calculadora de Energía Rural
  Agrivoltaica" dice qué es, no qué gano. (Lección 1+4.)
- **Bug móvil**: `.formulario`, `.tablero-cab` y ruta a 422 px dentro de
  viewport 390 px → segmentado "Favorable", títulos y valores del gráfico
  cortados. Overflow clipped, no scrolleable.
- **Reveal por IntersectionObserver** deja bandas invisibles si no se hace
  scroll (fullPage screenshot en blanco) — frágil.
- Headings genéricos: "Cómo funciona", "Caso demostrativo".
- Sin fila de confianza/credibilidad metodológica visible above-the-fold.
- Hipótesis en `<details>` plegado — contradice lección 3 (lo oculto no se ve),
  aunque aceptable como capa 2; valorar resumen visible + detalle plegado.

## Aplicación V6 (respetando PRODUCT.md: honesto, sobrio, sin datos falsos)

1. H1 → beneficio: saber en un minuto si la finca/cooperativa puede ahorrar.
   Nombre CERA queda en eyebrow/marca.
2. Fila de credibilidad above-the-fold: metodología PVGIS/IDAE · cálculo
   transparente · sin datos personales · marco MUII EPI.
3. CTA con promesa temporal + FUD-reducers agrupados bajo CTA.
4. Headings de beneficio en bandas.
5. Fix overflow móvil (crítico) + reveal robusto (visible por defecto,
   animación solo mejora).
6. Jerarquía resultados: un dato dominante (ahorro/año) + secundarios.
