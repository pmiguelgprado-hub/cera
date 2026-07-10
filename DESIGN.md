# DESIGN.md

Tokens únicos en `css/styles.css` (`:root`). Este documento es la fuente de
criterio; el CSS es la fuente de valores.

## Tema

Claro. Escena: gestor de cooperativa o técnico municipal rellenando el
formulario en un portátil de oficina o en el móvil a pie de finca, a plena luz
de día. Tema oscuro no aplica.

## Color (OKLCH, estrategia Committed)

El verde oscuro carrega cabecera, veredicto y acción primaria (~30 % de la
superficie). El resto, neutros cálidos tintados hacia arena. Amarillo solar
solo como acento funcional: anillo de foco, estado ámbar del semáforo.

| Token | Valor | Uso |
|---|---|---|
| `--verde-900` | `oklch(0.32 0.06 155)` | Cabecera, botón primario, titulares |
| `--verde-700` | `oklch(0.42 0.07 155)` | Hover del primario, enlaces |
| `--crudo` | `oklch(0.975 0.008 90)` | Fondo de página (blanco roto) |
| `--arena-100` | `oklch(0.93 0.02 85)` | Panel de resultados, filas alternas |
| `--arena-300` | `oklch(0.85 0.03 85)` | Bordes, separadores |
| `--tinta` | `oklch(0.25 0.02 155)` | Texto principal |
| `--tinta-suave` | `oklch(0.45 0.02 155)` | Texto secundario, unidades |
| `--solar` | `oklch(0.85 0.16 90)` | Foco, semáforo ámbar |
| `--ok` | `oklch(0.55 0.12 150)` | Semáforo verde |
| `--alerta` | `oklch(0.52 0.15 30)` | Semáforo rojo, errores de validación |

Prohibido `#000`/`#fff` puros. Sin gradientes, sin glass, sin side-stripes.

## Tipografía

Una sola familia: pila de sistema (`system-ui, -apple-system, "Segoe UI",
sans-serif`). Base 18 px (accesibilidad rural). Escala 1.2 en rem fijos:
`1rem / 1.2rem / 1.44rem / 1.75rem / 2.1rem`. Peso 400 texto, 600 etiquetas y
cifras, 700 titulares. Cifras de resultado con `font-variant-numeric:
tabular-nums`.

## Layout

- Una página. Desktop ≥960 px: dos columnas — formulario (izda.) y resultados
  pegajosos (dcha.). Móvil: apilado, resultados tras el botón Calcular.
- Máx. 72ch para prosa. Sin cards anidadas; los resultados son una lista de
  definición con filas separadas por borde de 1 px, no una rejilla de tarjetas.
- Veredicto del semáforo: banda superior del panel de resultados, con punto de
  color + frase-veredicto. Nunca un "big number hero".

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
