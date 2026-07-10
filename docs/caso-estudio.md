# Caso de estudio — Ganadería El Cierru (datos simulados)

**Todos los datos de este caso son ficticios.** La explotación no existe; los
valores son plausibles para una ganadería de leche de tamaño medio en un
concejo del interior de Asturias y sirven solo para demostrar el uso de CERA.
Ningún dato procede de una factura, un CUPS ni una persona real.

## Situación de partida

Ganadería de vacuno de leche con sala de ordeño, tanque de frío y nave
principal. Junto con dos vecinos y una nave municipal de aperos, estudia un
autoconsumo colectivo de 4 participantes. Facturas orientativas en mano, el
gestor introduce en CERA:

| Dato | Valor |
|---|---|
| Consumo eléctrico anual | 30.000 kWh |
| Potencia contratada | 20 kW |
| Superficie disponible (faldón sur de la cubierta) | 120 m² |
| Tipo de superficie | Cubierta o tejado |
| Participantes | 4 |
| Precio medio de electricidad | 0,17 EUR/kWh |

## Resultados en los tres escenarios

Salida literal del motor de CERA (`js/calculo.js`), sin retoques:

| Magnitud | Conservador | Central | Favorable |
|---|---|---|---|
| Potencia recomendada (kWp) | 18,5 | 18,5 | 18,5 |
| Producción anual (kWh) | 19.385 | 23.077 | 25.846 |
| Energía autoconsumida (kWh) | 12.600 | 15.000 | 16.800 |
| Cobertura del consumo | 42 % | 50 % | 56 % |
| Excedentes (kWh) | 6.785 | 8.077 | 9.046 |
| Ahorro anual (EUR) | 2.549 | 3.035 | 3.399 |
| Ahorro por participante (EUR) | 637 | 759 | 850 |
| Emisiones evitadas (kg CO₂) | 3.489 | 4.154 | 4.652 |
| Retorno simple (años) | 8,0 | 6,7 | 6,0 |
| Semáforo | Verde | Verde | Verde |

## Lectura

- **La superficie manda.** Los 120 m² del faldón sur limitan la instalación a
  18,5 kWp en los tres escenarios; por eso la potencia no cambia y la
  producción sí. CERA lo avisa en pantalla: la producción no llegará a cubrir
  todo el consumo anual.
- **La horquilla honesta.** Entre el escenario conservador y el favorable hay
  850 EUR/año de diferencia. CERA no promete el favorable: muestra los tres y
  deja la decisión informada al usuario.
- **El caso límite del semáforo.** El escenario conservador cae justo en 8,0
  años de retorno, el umbral verde/ámbar. Un resultado tan al filo es
  exactamente el tipo de situación en la que el aviso de CERA («requiere
  validación profesional») deja de ser una fórmula y pasa a ser el consejo.
- **Sentido colectivo.** Repartido entre 4 participantes, el ahorro central
  (759 EUR/año por participante) convierte una inversión inasumible para un
  vecino solo en una cuota abordable para el grupo.

## Qué NO dice este caso

El resultado no incluye sombras del monte vecino, orientación e inclinación
reales del faldón, curva horaria del ordeño, coeficientes de reparto del
autoconsumo colectivo, tramitación de acceso y conexión ni fiscalidad. Todo
eso pertenece al estudio profesional que CERA recomienda como siguiente paso.

## Reproducir

1. Abrir la app (URL en el README).
2. Introducir los seis valores de la tabla de partida.
3. Cambiar el escenario y pulsar «Calcular previabilidad» cada vez.
4. «Imprimir informe» genera el documento con datos, resultados e hipótesis.
