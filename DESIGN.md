# DESIGN.md

Tokens únicos en `css/styles.css` (`:root`). Este documento es la fuente de
criterio; el CSS es la fuente de valores.

## Tema

Claro. Escena: gestor de cooperativa o técnico municipal rellenando el
formulario en un portátil de oficina o en el móvil a pie de finca, a plena luz
de día. Tema oscuro no aplica.

## Color (OKLCH, estrategia Committed → esencia "Bold & Poppy")

Esencia adaptada de la plantilla Canva "Painting Website — Dark Green Pink
White, Bold & Poppy" (adaptación propia, no copia literal): verde oscuro
dominante y rotundo, un acento claro suave que respira, blanco roto, botones
píldora y formas orgánicas. El rosa de la plantilla se sustituye por **azul
muy claro asturiano** (derivado del azul de la bandera de Asturias, hue ~245).
Amarillo solar queda como acento funcional: foco, semáforo ámbar, avisos.

| Token | Valor | Uso |
|---|---|---|
| `--verde-900` | `oklch(0.32 0.06 155)` | Cabecera, botón primario, titulares |
| `--verde-700` | `oklch(0.42 0.07 155)` | Hover del primario |
| `--verde-tinte` | `oklch(0.93 0.035 150)` | Banda veredicto verde |
| `--crudo` | `oklch(0.975 0.008 90)` | Fondo de página (blanco roto) |
| `--azul-100` | `oklch(0.93 0.03 245)` | Panel de resultados, superficies suaves |
| `--azul-300` | `oklch(0.84 0.05 245)` | Bordes, separadores del panel |
| `--azul-700` | `oklch(0.45 0.09 248)` | Detalles fríos: summary hover, chips |
| `--tinta` | `oklch(0.25 0.02 155)` | Texto principal |
| `--tinta-suave` | `oklch(0.44 0.02 155)` | Texto secundario, unidades |
| `--solar` | `oklch(0.85 0.16 90)` | Foco, semáforo ámbar, barra de cabecera |
| `--solar-tinte` | `oklch(0.96 0.05 92)` | Avisos, banda veredicto ámbar |
| `--ok` | `oklch(0.55 0.12 150)` | Semáforo verde |
| `--alerta` | `oklch(0.5 0.15 30)` | Semáforo rojo, errores |
| `--alerta-tinte` | `oklch(0.95 0.025 30)` | Banda veredicto rojo |

Los arena-* quedan retirados; el azul claro asume su papel de superficie.
Prohibido `#000`/`#fff` puros. Sin gradientes, sin glass, sin side-stripes.

## Personalidad "Bold & Poppy" (formas)

- **Botones y control segmentado en píldora** (`border-radius: 999px`) — firma
  de la plantilla.
- **Onda orgánica** entre cabecera y contenido: SVG inline (curva suave, fill
  crudo sobre verde-900). Es la traducción sobria del brochazo de la
  plantilla; nada de PNG ni brochazos literales.
- Titulares grandes y rotundos (Bricolage 800), más grandes que en la v1.
- El punto del semáforo crece y la banda del veredicto gana radio.
- **Sol dibujado** (SVG línea, amarillo solar translúcido) en la esquina de la
  cabecera, rotación de 90 s. **Dos blobs orgánicos** (solar-tinte y azul-100)
  asoman tras el contenido con `z-index: -1`. **Pie en banda verde oscura**
  con onda invertida, cerrando la página como la abre la cabecera.
- **Cifras con cuenta ascendente** (550 ms, ease-out cúbico) al calcular —
  revelado de estado, no decoración. Todo lo animado respeta
  `prefers-reduced-motion` y desaparece en impresión.
- **Demo móvil**: `movil.html` — la app embebida en un marco de teléfono CSS
  (iframe, viewport ~390 px) para enseñarla en pantalla grande.

## Tipografía

Una sola familia en toda la app: **Bricolage Grotesque variable** (self-hosted,
`assets/fonts/bricolage-grotesque-latin.woff2`, subset latin, eje 200-800) —
carácter humanista, elegida explícitamente contra el look plantilla-IA (nada
de Inter/Manrope). Pila de sistema solo como fallback. Base 18 px
(accesibilidad rural). Escala 1.2 en rem fijos. Peso 400 texto, 600 etiquetas,
700 cifras de resultado, 800 el h1.

## Layout

- Una página, personalidad en los tres cortes:
  - **Móvil (<600 px)**: apilado, resultados tras el botón Calcular, targets
    ≥48 px, onda de cabecera baja.
  - **Tablet (600–959 px)**: formulario a dos columnas de campos (grid); el
    escenario y las acciones ocupan el ancho completo; resultados debajo.
  - **Desktop (≥960 px)**: dos columnas — formulario (izda.) y resultados
    pegajosos (dcha.).
- Máx. 72ch para prosa. Sin cards anidadas; los resultados son una lista de
  definición con filas separadas por borde de 1 px, no una rejilla de tarjetas.
- Veredicto del semáforo: banda superior del panel de resultados con fondo
  tintado según nivel (`--verde-tinte` / `--solar-tinte` / `--alerta-tinte`),
  punto de color + frase-veredicto. Nunca un "big number hero".
- Cabecera con borde superior de 5 px `--solar` y marca en amarillo solar
  (contraste 7,76:1 sobre verde-900, medido).
- Filas de resultado con aparición escalonada (40 ms por fila, `backwards`);
  desactivado bajo `prefers-reduced-motion`.

## Componentes

- Inputs: 48 px de alto mínimo (táctil), borde 1.5 px `--arena-300`, foco con
  anillo `--solar` de 3 px. Error: borde `--alerta` + mensaje bajo el campo.
- Escenario: control segmentado de 3 radios estilizados.
- Hipótesis y límites: `<details>` abierto por defecto en impresión.
- Botón primario único («Calcular previabilidad»); secundario fantasma
  («Imprimir informe»), deshabilitado hasta que hay resultado.

## Motion

150–200 ms ease-out solo en foco/hover y aparición del panel de resultados.
Nada de coreografías de carga.

## Impresión

`@media print`: se ocultan formulario y botones; se imprimen datos de entrada,
resultados, semáforo, hipótesis completas y aviso legal con fecha.
