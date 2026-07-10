# CERA — Calculadora de Energía Rural Agrivoltaica

Web-app estática de previabilidad energética para comunidades energéticas
rurales, cooperativas y pequeñas explotaciones agrarias de Asturias.

A partir de siete datos básicos (consumo anual, potencia contratada,
superficie, tipo de superficie, participantes, precio de la electricidad y
escenario) estima de forma orientativa: potencia fotovoltaica recomendada,
producción anual, autoconsumo, excedentes, ahorro económico, emisiones
evitadas y un semáforo de viabilidad con todas las hipótesis a la vista.

**No** es un proyecto constructivo, una certificación, un estudio de acceso y
conexión ni asesoramiento legal. Es el primer análisis, honesto y educativo,
que permite decidir si merece la pena encargar un estudio profesional.

## Demo

App pública: **<https://pmiguelgprado-hub.github.io/cera/>**

Caso de estudio con datos simulados: [`docs/caso-estudio.md`](docs/caso-estudio.md).

## Uso

Abrir `index.html` en un navegador, o servir el directorio con cualquier
servidor estático:

```bash
python3 -m http.server 8080
```

Sin dependencias, sin build, sin APIs externas, sin base de datos y sin datos
personales. Desplegable tal cual en GitHub Pages.

## Estructura

| Ruta | Qué contiene |
|---|---|
| `index.html` | Página única: formulario + resultados + informe imprimible |
| `css/styles.css` | Tokens de diseño y estilos (ver `DESIGN.md`) |
| `js/calculo.js` | Motor de cálculo puro + `CONFIG` con todas las hipótesis |
| `js/app.js` | Capa de UI: lee el formulario, pinta resultados |
| `tests/` | Tests del motor de cálculo (`node --test`) |

## Tests

```bash
node --test tests/calculo.test.mjs
```

## Hipótesis de cálculo

Valores editables y documentados en `CONFIG` (`js/calculo.js`) y visibles en
la propia app en «Hipótesis y límites». Reglas simplificadas de prototipo:
6,5 m²/kWp; rendimiento específico 1050/1250/1400 kWh/kWp según escenario;
65 % de autoconsumo simultáneo; excedentes a 0,06 EUR/kWh; 0,18 kg CO₂/kWh;
retorno simple con 1.100 EUR/kWp orientativos.
