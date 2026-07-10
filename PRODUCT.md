# PRODUCT.md

register: product

## Product purpose

**CERA — Calculadora de Energía Rural Agrivoltaica.** Web-app estática de
previabilidad energética para comunidades energéticas rurales, cooperativas y
pequeñas explotaciones agrarias de Asturias. Ofrece una estimación inicial y
educativa de autoconsumo fotovoltaico o agrivoltaico a partir de siete datos
básicos. No es un proyecto constructivo, una certificación, un estudio de
acceso y conexión ni asesoramiento legal: hace accesible el primer análisis,
que suele ser la barrera para que una idea energética rural pase de
conversación a proyecto.

## Users

1. **Cooperativa agraria / ganadería / explotación** con interés inicial por
   autoconsumo colectivo. Poca soltura digital: español llano, texto grande,
   resultado en una pantalla.
2. **Ayuntamiento rural** que explora una comunidad energética con vecinos e
   instalaciones municipales.
3. **Evaluador de la convocatoria**: espera honestidad metodológica — cada
   número con su hipótesis visible y aviso de que el resultado es orientativo.

## Brand / tone

- Rural asturiano digno, profesional, sobrio. Nunca infantil ni corporativo.
- Español de España, tuteo. Coma decimal, punto de miles.
- Cada resultado con su regla de cálculo visible. Nada "de memoria".
- Sin emojis en la UI, sin imágenes de stock, sin anglicismos gratuitos.

## Anti-references

- Dashboard SaaS genérico: rejilla de KPI-cards idénticas, gradientes, hero-metric.
- Calculadoras comerciales de placas que ocultan hipótesis para vender.
- Redacción-plantilla IA: em dashes, regla de tres, promesas vacías.

## Strategic principles

- Una sola página: formulario → resultados. Sin login, pagos, mapas, APIs ni BD.
- No se pide ningún dato personal: ni direcciones, ni CUPS, ni facturas, ni
  coordenadas, ni DNI. Demo siempre con datos ficticios.
- El cálculo vive en `js/calculo.js` (puro, testeado con `node --test`); la UI
  solo renderiza.
- Valores de hipótesis centralizados y editables en `CONFIG` dentro de
  `js/calculo.js`, documentados en pantalla en el bloque «Hipótesis y límites».
- El informe imprimible sale con `window.print()` y CSS de impresión.
