# CERA - Mesa territorial solar

Aplicación web estática para orientar el predesarrollo de comunidades
energéticas rurales en Asturias. CERA combina territorio, consumo, generación
y economía para ordenar una primera decisión antes de encargar proyecto,
presupuesto o tramitación.

El resultado es preliminar. No sustituye proyecto constructivo, certificación,
estudio de acceso y conexión, oferta de inversión ni asesoramiento jurídico o
fiscal.

## Qué entrega

El diagnóstico genera un pasaporte imprimible de seis secciones:

1. territorio e implantación;
2. comunidad y consumo;
3. balance energético;
4. lectura económica;
5. encaje regulatorio;
6. proyecto y puesta en servicio.

Cada sección separa evidencia, estado, incertidumbre, fuentes y siguiente
acción. El impacto climático permanece como dato pendiente hasta incorporar un
factor de emisiones fechado y un tratamiento trazable de excedentes.

## Método y supuestos

- Recurso solar territorial procedente de PVGIS 5.3, integrado como datos
  locales. No se consulta una API durante el uso.
- Intersección temporal de generación y demanda en 288 intervalos mes-hora.
- Cinco perfiles sintéticos CERA, normalizados al consumo anual declarado. Un
  CSV local puede sustituirlos; su contenido solo vive en memoria.
- Densidades geométricas editables: 5 m²/kWp en cubierta, 6,5 m²/kWp en
  aparcamiento y 8 m²/kWp en suelo. Son hipótesis CERA, no valores medidos.
- Corrección orientativa de orientación e inclinación según el pliego IDAE. No
  modela sombras próximas ni sustituye una simulación del plano real.
- Economía descontada con CAPEX, OPEX, degradación, tarifa, compensación, tasa
  de descuento y vida útil visibles y editables.

La regla general de proximidad del autoconsumo colectivo se presenta como
inferior a 500 m. La posible extensión inferior a 5.000 m solo se muestra para
los supuestos y condiciones recogidos en el Real Decreto-ley 7/2026. La
elegibilidad PAC de la agrivoltaica no se generaliza: se condiciona a tierra de
cultivo o cultivo permanente, actividad agraria principal y demás requisitos
del Real Decreto 916/2025.

## Privacidad, PWA e impresión

No hay login, base de datos ni analítica. CERA no solicita información
identificativa. Los datos y CSV se procesan localmente en el navegador y no se
suben ni se persisten.

La PWA precarga los recursos estáticos para funcionar sin cobertura después de
la primera visita. La vista de impresión produce el pasaporte completo con sus
seis secciones, hipótesis, fuentes y avisos.

## Uso local

`index.html` funciona directamente para revisión visual. Para probar la PWA y
el modo sin conexión debe servirse desde un origen local seguro:

```powershell
python -m http.server 8080
```

## Verificación

```powershell
node --test
node --check js/app.js
node --check js/calculo-v2.js
node --check tools/qa-edge.mjs
node tools/qa-edge.mjs
```

La auditoría PWA offline requiere autorización previa para abrir un puerto
local y se ejecuta con:

```powershell
node tools/qa-edge.mjs --http
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Producto, diagnóstico, Atlas, método y pasaporte |
| `js/calculo-v2.js` | Orquestación técnica, económica y de madurez |
| `js/trazabilidad.js` | Fuentes y supuestos versionados |
| `js/pasaporte.js` | Proyección pura del pasaporte |
| `js/perfiles-consumo.js` | Perfiles sintéticos y parser CSV local |
| `js/atlas.js`, `js/solar-data.js` | Consulta territorial y datos PVGIS locales |
| `tools/qa-edge.mjs` | QA reproducible de Edge, responsive, PWA e impresión |
| `tests/` | Contratos de dominio, interfaz, accesibilidad y PWA |
