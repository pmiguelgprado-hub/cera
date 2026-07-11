# DESIGN.md — V3 corporativa

Tokens únicos en `css/styles.css` (`:root`). Este documento es la fuente de
criterio; el CSS es la fuente de valores.

## Tema

Claro. Escena: gestor de cooperativa, técnico municipal o consultora
rellenando el formulario en portátil de oficina o en móvil a pie de finca.
Tema oscuro no aplica. V3 busca madurez B2B: rigor de ingeniería,
transparencia del cálculo y conexión sutil con el territorio rural.

## Color (hex, color por función — no decoración)

| Token | Valor | Uso |
|---|---|---|
| `--verde-noche` | `#0B2A20` | Topbar, hero, pie |
| `--verde` | `#164C3A` | Botón primario, titulares, cifras |
| `--verde-exito` | `#1E7B45` | Semáforo verde, barra autoconsumo, hover primario |
| `--crema` | `#F7F4ED` | Fondo de página |
| `--blanco` | `#FFFFFF` | Tarjetas, formulario, KPI |
| `--solar` | `#F7C640` | Acento: foco, eyebrow, CTA topbar, sol del isotipo |
| `--azul-datos` | `#DCECF8` | Celdas del isotipo sobre fondo oscuro |
| `--azul` | `#1769AA` | Solo serie de datos (excedentes) y enlaces — nunca superficies |
| `--campo-borde` | `#B9C6B7` | Bordes de inputs, select, segmentado, botón secundario |
| `--ambar` | `#B87912` | Barra consumo no cubierto, borde punto ámbar |
| `--ambar-texto` | `#8A5A0D` | Ámbar sobre fondos claros (texto, AA) |
| `--tinta` | `#13231D` | Texto principal |
| `--alerta` | `#B64236` | Errores, semáforo rojo (AA sobre blanco) |

Derivados en CSS: `tinta-suave`, `verde-tinte`, `solar-tinte`,
`alerta-tinte`, `azul-borde`, `linea`. Prohibido `#000` puro.
Sin gradientes decorativos ni glass. Contrastes verificados AA: texto ámbar
usa `--ambar-texto`, no `--ambar`.

## Marca — "Parcela solar"

Isotipo SVG inline propio (48×48): retícula solar 2×2 (celdas redondeadas,
azul-datos sobre fondo oscuro / verde sobre claro), sol de cuarto de arco +
disco en amarillo solar, y dos líneas de terreno curvas cerrando la base.
Significado: parcela + generación + horizonte asturiano.

- **Logotipo horizontal** (topbar, pie): isotipo + wordmark «CERA»
  (Bricolage 700, tracking 0.24em). Área de seguridad: gap `0.55rem`.
- **Isotipo solo**: favicon e icono PWA (data-URI, versión 32×32
  simplificada sobre tesela verde-noche redondeada).
- **Monocromo**: `fill/stroke currentColor` (variante `.logo-mono` del pie);
  funciona sobre claro y oscuro.
- Tamaños: 34 px topbar, 26 px pie, 20 px chip del hero-panel. Mínimo 20 px;
  por debajo, usar solo la tesela del favicon.
- Prohibido: enchufes, rayos, hojas, paneles hiperdetallados.

## Layout

- Contenedor máximo `--ancho-max: 77rem` (~1232 px), márgenes 1.5rem.
- **Topbar** compacta verde-noche: logo izq., anclas (Calculadora / Cómo
  funciona / Caso demostrativo, ocultas <760 px), CTA solar «Iniciar
  diagnóstico» dcha. Sticky solo ≥960 px (no penaliza móvil).
- **Hero** 2 columnas ≥960 px: izq. eyebrow + H1 + entradilla 2 líneas +
  CTA doble + nota privacidad; dcha. **mini-dashboard** (tarjeta blanca con
  3 métricas del caso demostrativo + SVG territorial abstracto con pérgolas
  y sol pequeño integrado). Retícula técnica solo en la mitad derecha,
  opacidad 4 % máx. Altura contenida: el formulario asoma sin scroll largo.
- **Calculadora**: desktop 2 col (form 26rem + resultados sticky bajo la
  topbar); tablet campos a 2 col; móvil apilado con scroll al resultado.
- **Bandas ancla**: `#como-funciona` (mapa interactivo: la ilustración del
  pueblo con 3 puntos numerados; cada punto activa su explicación en el
  panel lateral — la ilustración ES la explicación) y `#caso`
  (datos + lectura + botón que precarga el caso; también `?caso=ganaderia`).
- Máx. 72ch prosa. Semáforo = banda tintada + punto + veredicto; nunca
  "big number hero".

## Tipografía

Bricolage Grotesque variable self-hosted (subset latin, 200–800), única
familia. Base 18 px. Peso 400 texto, 600 etiquetas, 700 cifras, 800 H1.
Números siempre `tabular-nums` + `Intl.NumberFormat('es-ES')`.

## Dashboard reactivo

- **Vivo desde la carga**: la página calcula con los datos precargados y
  muestra el resultado sin pedir nada (reciprocidad — dar antes de pedir).
  El usuario ajusta y ve su caso; `?caso=ganaderia` precarga el caso demo.
- Cualquier entrada válida recalcula al instante (debounce 150 ms) **sin
  animación** de cuenta; la cuenta ascendente (550 ms) queda para el submit
  explícito y la primera carga.
- KPI primarios: potencia, producción, ahorro, CO₂. Secundarios: cobertura,
  retorno simple, reparto (si ≥2 participantes), inversión orientativa y
  ahorro acumulado a 25 años (efecto contraste: la inversión se lee junto
  al ahorro de la vida útil, nunca aislada).
- **Resumen del caso** bajo el H2 de resultados, construido con los datos
  del usuario («Cubierta o tejado de 200 m² · 25.000 kWh/año · escenario
  central») — el resultado se siente propio (efecto dotación).
- **Nota de pérdida** tras las cifras: «Cada año sin instalación deja sin
  aprovechar unos X EUR de ahorro» (aversión a la pérdida). Solo en
  semáforo verde/ámbar; en rojo sería deshonesta y se oculta.
- Gráfico de destino: ancho = `valor / consumo_anual × 100`, acotado 0–100 %.
  Cada fila muestra valor absoluto + porcentaje. Marcas de leyenda con forma
  distinta por serie (cuadrado/círculo/triángulo) — no depende solo del
  color. Nota explícita cuando producción > consumo.

## Componentes

- Inputs 48 px mín., borde 1.5 px `--campo-borde` (hover verde), foco
  anillo `--solar` 3 px.
- Botones rectos (`--radio-s: 7px`) — la píldora queda retirada en V3
  (más sobrio); el segmentado de escenarios también es recto.
- Formulario en tarjeta blanca con sombra suave (`--sombra`).
- **Ruta del proyecto** en cabecera del formulario: grid de 3 columnas
  (número arriba, etiqueta debajo — nunca envuelve), conector horizontal
  con el tramo recorrido en verde, paso 1 («Datos precargados») ✓ con
  animación de brote, paso actual con anillo solar. Gradiente de meta —
  nunca se empieza en cero. Paso 3 «Estudio profesional» enlaza con el
  descargo: CERA es el paso intermedio, no el final.
- **Panel de resultados** blanco (como el formulario) — el azul de
  superficie se retiró en favor de sobriedad B2B. KPI en teselas crema
  con borde izquierdo verde de 3 px.
- Hipótesis: `<details>`, abierto al imprimir.

## Motion

150–200 ms ease-out en foco/hover y aparición del panel. Cuenta ascendente
en submit y primera carga (incluye métricas del hero). Micro-interacciones
(regla pico-final — feedback, no decoración): pulso único del punto del
semáforo al cambiar de nivel, destello verde 700 ms al salir de un campo
válido, revelado al scroll de las bandas informativas (una vez, lo activa
JS). Todo respeta `prefers-reduced-motion` (incluye `scroll-behavior`);
sin JS o con movimiento reducido, nada queda oculto.

## PWA / offline

`manifest.webmanifest` + `sw.js` (network-first con caché de respaldo,
rutas relativas — compatible GitHub Pages). La app funciona sin cobertura
una vez visitada: caso de uso real a pie de finca. Sin push, sin sync, sin
datos: solo caché de estáticos.

## Impresión

`@media print`: se ocultan topbar, hero-panel, bandas y formulario; se
imprimen datos de entrada, resultados, semáforo, hipótesis completas y
aviso legal con fecha.
