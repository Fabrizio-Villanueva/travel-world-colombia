# Línea base comercial antes de Sol v2 (medida el 05-oct-2026)

Foto del "antes" para comparar contra la prueba A/B de Sol v2. Solo lectura de
GHL (pipelines 🎯 Leads = 1.677 oportunidades y 🗂️ Reservaciones = 309, todas
leídas, sin tope) + `agente_mensajes_enviados` para distinguir a Sol.
Script: scratchpad de la sesión (`base.mjs`), reproducible.

## Conversión por cohorte (mes en que entró el lead)

| Mes | Leads creados | Ventas de esa cohorte | Conversión | Leads con brief de Sol | Perdidos/abandonados | Con motivo de pérdida |
|---|---|---|---|---|---|---|
| Julio 2026 | 257 | 42 | 16,3 % | 0 (Sol aún no dejaba brief) | 193 | 12 |
| Agosto 2026 | 181 | 41 | 22,7 % | 17 | 89 | 1 |
| Septiembre 2026 | 455 | 42 | 9,2 %* | 152 | 51 | 2 |

\* Septiembre todavía está madurando (la mediana entre primer mensaje y cierre
es ~9 días y hay ventas que tardan semanas): su conversión va a subir. Para
comparar con justicia, el A/B mide grupos del MISMO periodo, no contra julio.

"Ventas de esa cohorte" = tarjetas en Reservaciones creadas ese mes (la tarjeta
se muda de Leads a Reservaciones conservando su fecha de creación). Si alguna
reserva se creó directo en Reservaciones, cuenta igual.

## Velocidad de respuesta de la asesora después de Sol

Muestra: 183 oportunidades de Leads creadas desde septiembre en las que Sol
dejó el brief (181 con mensajes de Sol identificables).

- **Mediana: 18,3 horas** entre el último mensaje de Sol y el primer mensaje
  de una persona (25 %: 2,4 h · 75 %: 45,3 h).
- Respondidas en menos de 1 hora: **20**. En más de 24 horas: **51**.
- **Sin ningún mensaje humano en el chat todavía: 55 de 181 (30 %).** Puede
  incluir clientes atendidos por llamada, pero en el chat no hay rastro.
- Se cuentan como humanos los mensajes con usuario de GHL y los enviados desde
  el celular ("Sent from another device").

## Motivo de pérdida

De 333 oportunidades perdidas/abandonadas (jul-sep) solo **15** tienen motivo
de pérdida. Sin esto no se puede aprender de las ventas perdidas.

## Qué mirar en el A/B (mismo periodo, grupo v1 vs grupo v2)

1. % de leads que llegan a "listo para reservar" / brief.
2. % de leads que terminan en Reservaciones (a 30 días).
3. Horas entre el traspaso de Sol y la primera respuesta humana.
4. % de conversaciones con queja, repregunta o dato inventado (revisión manual).
