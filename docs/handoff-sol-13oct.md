# Traspaso · Sol y Generador (sesión del 13-oct-2026)

Resumen de lo que se hizo, dónde quedó y qué falta. Todo está publicado en
`main` (Vercel desplegó cada commit sin errores).

## 1. Auditoría de Sol del puente festivo (10–12 oct)

- 104 conversaciones leídas completas: 341 mensajes de Sol, 23 coberturas de
  respaldo correctas, 3 intromisiones indebidas y 4 dudosas, 135 errores (10
  graves). Informe: https://claude.ai/artifact/V8Y29ECVh4sfao2w5QyexT
- Las intromisiones venían de dos fallas de regla, ya resueltas:
  - Proveedores sin etiqueta de mayorista (el dueño los etiquetó).
  - El respaldo medía la espera por la hora de LLEGADA del mensaje: un mensaje
    de las 8:53 contaba como "fuera de horario" y Sol entraba a los 15 min
    aunque la asesora estuviera escribiendo. Corregido en `5938a8f`
    (`lib/agente/vigilante.ts`, `esperaRespaldoMin` + `asesoraActiva`).

## 2. Prueba A/B Sol 1 vs Sol 2 (6–13 oct, 102 leads)

- Evaluación a ciegas: ninguna de las dos pasa leads "basura" (0 de 24).
- El cuello de botella es la respuesta humana: 12 de 19 leads buenos que pasó
  Sol 1 no recibieron ningún mensaje de una asesora.
- Sol 2 (solo traspasa en `listo_para_reservar`) se quedó 2 leads nuevos con
  todo listo. Recomendado, sin aplicar: regla "destino + fecha + personas +
  pide cotización = pasa" y seguir la prueba 2 semanas midiendo ventas.
- Informe: https://claude.ai/artifact/FdNuVDTnhXoCZ7WS2fcLRH

## 3. Guardas de Sol (`4d0ee5d`)

- **Causa raíz de los errores de fechas:** a Sol no le llegaban las fechas de
  salida (el itinerario iba sin fechas) y los cruceros no se reconocían si el
  cliente no escribía el nombre exacto de la ficha. Ahora `conocimiento.ts`
  manda una línea `salidas` (textos de la ficha con "salida" + día 1 del
  itinerario con su año) y reconoce cruceros por puerto o barco.
- `lib/agente/guardas.ts` (v1, v2, respaldo, seguimientos y laboratorio):
  - Antes del modelo: lo que el cliente ya dijo (de `sol_ab_turnos`), si ya
    tiene una reserva en Reservaciones y si se le responde con demora.
  - Después: `revisarMensaje` detecta repreguntas, salidas vencidas, promesas
    de tiempo, nombres de quien ya no está y frases de intermediaria; si
    encuentra algo, pide UNA corrección (`conRevision`).
- `lib/agente/errores-reales.ts`: reglas de errores reales en el prompt de
  ambas versiones.
- `salidas-vencidas.ts`: reconoce "marzo de 2.026", "marzo 2026" y listas de días.
- Respaldo sin duplicados: re-chequeo antes de enviar.
- Reactivación: no dice "va con lo que nos preguntaste" por solo "crucero".
- Laboratorio (`/admin/sol/laboratorio`): corre Sol v1 o v2, muestra lo que
  corrigió la revisión y trae 12 escenarios "Caso real ·".

## 4. Traspaso silencioso (`5b3acb1`, decisión del dueño)

- Sol (v1 y v2; ventas, escalada y respaldo) habla en primera persona como la
  agencia: "lo reviso y te confirmo por aquí". No se presenta ni nombra a la
  asesora; el aviso al equipo sigue por dentro (nota, tag, alerta de SLA).
- Se presenta como Sol / asistente virtual SOLO si el cliente pregunta.
- Si el cliente pide o nombra a alguien del equipo: "ya le aviso a X".

## 5. Fecha de nacimiento unificada (`e8a2e39`, `d0a4fe2`)

- El cumpleaños del cliente es el campo nativo `dateOfBirth` del contacto
  (lo usa R-01, que ya solo dispara con "Cumpleaños del contacto").
- El campo viejo `contact.p1__fecha_de_nacimiento` se BORRÓ de GHL (copia de
  sus 126 valores en `.respaldos-ghl/`, fuera del repo).
- 81 contactos migrados al nativo; 27 quedaron para revisión manual (el P1 del
  contrato viejo era otra persona o la fecha era imposible).
- Generador, portal de documentos y contrato sincronizan la fecha del pasajero
  que ES el contacto (por nombre, `lib/contratos/nacimiento.ts`). Probado en
  producción con la oportunidad de prueba (restaurada).

## Pendientes

1. **Datos del catálogo** (los revisa una asesora): La Romana "USD 647 doble"
   (el hospedaje dice 843 doble); Cartagena con "Propinas" incluidas y a la vez
   USD 360 obligatorias; el rango de Sol para Cartagena (USD 1.000–1.900, "no
   incluye propinas") contradice la ficha; Miami "desde $5.890.000" no dice que
   es cuádruple.
2. Revisar a mano los 27 contactos sin fecha de nacimiento migrada (lista en
   el informe del punto 1, sección "Fecha de nacimiento").
3. Respuesta del equipo: la meta propuesta es 1 hora hábil para el primer
   mensaje humano; el aviso de SLA podría decir qué está pendiente (propuesto,
   sin construir).
4. Regla nueva de traspaso para Sol 2: PUBLICADA (13-oct, noche). Re-evaluar el 20-oct en /admin/sol/resultados (filtro Sol 2):
   Sol 2 pasa también con destino + fechas + viajeros + **pide que le coticen
   su viaje** (campo `venta.pide_cotizacion`; `decidirV2` sube el estado a
   `listo_para_reservar` y `crm.ts` lo usa de red). Preguntar precios en
   general sigue sin pasar. Probado con 4 conversaciones. **Seguir el A/B
   (50 %, activo) hasta ~27-oct** midiendo ventas y primera respuesta humana;
   comparar leads de Sol 2 antes y después de esta regla.
5. Vigilar en `agente_eventos` las notas "revisión: corrigió…" para ver qué
   errores sigue atrapando la guarda.

## 6. Panel, evaluador y pruebas automáticas (13-oct, noche)

- `/admin/sol/resultados` (solo superadmin) + evaluador IA de cada lead
  (migración 042, cron `/api/agente/evaluador`). 6–13 oct: de 29 leads
  pasados, 27 valían y 0 eran malos; mediana de respuesta humana 18 h.
- Pruebas de Sol con promptfoo: `npm run eval:sol` (20 casos, v1 y v2,
  ~1 min, centavos de dólar). Correrlo ANTES de publicar cualquier cambio del
  prompt o las reglas. Primera corrida: 19/20; falla Sol 1 al no dar rango de
  precio ante "¿cuánto vale San Andrés?" (Sol 2 sí lo da).
- Langfuse: sin decidir (requiere cuenta o servidor propio y enviar
  conversaciones de clientes a un tercero).
- Re-evaluación de la regla `pide_cotizacion` programada el 20-oct 9:00.
