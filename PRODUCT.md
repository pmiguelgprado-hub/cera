# CERA - Contrato de producto

register: product

## Propósito

CERA es una mesa territorial solar para orientar el predesarrollo de
comunidades energéticas rurales en Asturias. Convierte una oportunidad local
en una decisión inicial trazable y en un pasaporte transferible al siguiente
profesional.

No decide la inversión ni acredita cumplimiento. No sustituye proyecto,
presupuesto, estudio de acceso y conexión, tramitación, certificación ni
asesoramiento jurídico o fiscal.

## Usuarios

1. Ayuntamiento que explora activos municipales y participación local.
2. Cooperativa o grupo vecinal que contrasta perfiles y reparto.
3. Particular que necesita entender su posible participación.
4. Empresa rural que valora un activo tractor o consumo complementario.

## Entregable

El pasaporte contiene seis bloques: territorio e implantación, comunidad y
consumo, balance energético, lectura económica, encaje regulatorio, y proyecto
y puesta en servicio.

Cada bloque declara:

- estado: calculado, estimado o dato pendiente;
- evidencias y unidades;
- incertidumbre no resuelta;
- fuente cuando existe;
- siguiente acción profesional.

## Principios

- Identidad rural asturiana, profesional y sobria.
- Español claro, unidades visibles y coma decimal.
- Evidencia antes que afirmación. Ningún número sin regla o procedencia.
- Regulación condicionada al caso. La proximidad de 500 m y la posible
  extensión de 5.000 m no son promesas automáticas. La lectura PAC se limita a
  los supuestos aplicables del Real Decreto 916/2025.
- Privacidad local. Sin login, analítica, base de datos ni petición de datos
  identificativos. Los CSV solo se procesan en memoria.
- Perfiles sintéticos y densidades geométricas visibles como hipótesis CERA.
- PWA sin conexión tras la primera visita e impresión completa del pasaporte.

## Arquitectura

Aplicación estática, sin dependencias de ejecución ni llamadas externas durante
el uso. El motor de cálculo y el pasaporte son módulos puros; la interfaz
renderiza mediante DOM seguro. Fuentes y supuestos viven en un registro
versionado.

## Antirreferencias

- Calculadora comercial que oculta hipótesis o fuerza contacto.
- Dashboard genérico de tarjetas idénticas.
- Promesa de viabilidad, ahorro o cumplimiento sin datos suficientes.
- Uso del color como único indicador.
- Jerga promocional, anglicismos gratuitos o redacción de plantilla.

## Calidad

Objetivo WCAG 2.2 AA, reflow sin overflow global desde 320 px, objetivos táctiles
de al menos 44 x 44 px, navegación por teclado, impresión legible y QA real en
Microsoft Edge.
