# Caso de estudio — Ganadería El Cierru (fixture simulado)

**Todos los datos son ficticios.** La explotación no existe y ningún dato
procede de una factura, un CUPS ni una persona real. Este fixture documenta un
recorrido reproducible con el motor público v2; no presenta cifras de salida
congeladas que puedan quedar desalineadas del código.

## Situación de partida

Ganadería de vacuno de leche con sala de ordeño, tanque de frío y nave
principal. Junto con dos vecinos y una nave municipal de aperos, estudia una
comunidad de cuatro participantes. Para reproducir el ejemplo se introducen
estos supuestos, que son entradas y no resultados observados:

| Dato | Valor |
|---|---|
| Consumo eléctrico anual | 30.000 kWh |
| Potencia contratada | 20 kW |
| Superficie disponible (faldón sur de la cubierta) | 120 m² |
| Tipo de superficie | Cubierta o tejado |
| Participantes | 4 |
| Perfil de consumo | Perfil normalizado seleccionado en la aplicación |
| Estrategia | Equilibrio |
| O&M | 2 % del CAPEX al año, editable |

## Qué calcula el motor actual

El perfil seleccionado se normaliza al consumo anual y se cruza con la
generación en 288 intervalos mes-hora. En cada intervalo, la intersección
temporal entre ambas series determina la energía autoconsumida. Por eso CERA
separa dos indicadores que no son intercambiables:

- autoconsumo: energía autoconsumida dividida por la generación;
- cobertura: energía autoconsumida dividida por el consumo.

El diagnóstico compara tres escenarios de dimensionado e identifica la regla
aplicada o su fallback. Para cada cálculo muestra CAPEX, VAN, LCOE, retorno
simple y retorno descontado; además presenta tres sensibilidades con supuestos
modificados. O&M parte del 2 % anual indicado en el fixture, pero el usuario
puede editarlo junto con degradación, descuento y horizonte.

No se publican aquí magnitudes de salida. Para obtener un ejemplo reproducible,
se ejecuta la versión actual de la aplicación con las entradas anteriores y se
conservan visibles sus hipótesis, fórmulas, fuentes, avisos y nivel de confianza.
Así el caso no atribuye al motor actual resultados calculados por una versión
anterior.

El impacto climático se muestra como **Dato pendiente**. No se incorpora un
factor de emisiones con fuente y fecha ni un tratamiento de excedentes, por lo
que el fixture no produce una magnitud climática calculada.

## Qué NO dice este caso

El alcance de CERA es preliminar. No valida sombras, estructura de la cubierta,
orientación e inclinación medidas, curva horaria real, coeficientes de reparto,
acceso y conexión, fiscalidad, ofertas de equipos ni condiciones de financiación.
Todo eso pertenece al estudio profesional recomendado como siguiente paso.

## Reproducir

1. Abrir la app (URL en el README).
2. Seleccionar una audiencia e introducir los supuestos de la tabla.
3. Elegir un perfil normalizado o cargar un CSV local con los 288 pares mes-hora
   únicos; opcionalmente transferir zona, inclinación y azimut desde el Atlas.
4. Mantener O&M en el 2 % del fixture o documentar cualquier cambio.
5. Pulsar «Calcular previabilidad» y revisar los tres escenarios, las dos tasas
   energéticas, la economía descontada, la sensibilidad y la madurez.
6. «Imprimir informe» conserva entradas, resultados e hipótesis de esa ejecución.
