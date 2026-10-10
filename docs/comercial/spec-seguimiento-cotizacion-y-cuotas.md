# Specs para armar en GHL: "Seguimiento de cotización" y "Recordatorio de cuotas"

*10-oct-2026 · Se arma a mano en la UI de GHL (Automation → Workflows). Nada de esto toca el código ni Supabase. Antes de publicar, el usuario da el OK y prueba con una oportunidad de prueba.*

## Reglas que aplican a los dos

1. **Las acciones "SMS" salen por el WhatsApp QR (no oficial)**, que es el proveedor predeterminado de la cuenta. Por eso los mensajes son sobrios: cortos, sin mayúsculas sostenidas, con un enlace como máximo, sin imágenes y siempre personales (con nombre y destino). El volumen es bajo (decenas por semana), así que el riesgo de bloqueo es bajo. Aun así, **no se reutiliza ninguno de estos workflows para envíos masivos**.
2. **Ley 2300 de 2023**: los mensajes comerciales y de cobranza solo salen en días y horas hábiles. En cada acción **Wait** activa la ventana avanzada ("Advanced window" / "Resume on") de **lunes a viernes de 9:00 a 17:00** y, si la versión lo permite, el **sábado de 9:00 a 13:00**. Si solo admite una franja, deja L-V 9–17 y el sábado fuera. Es el horario de la oficina (`HORARIO` en `lib/agente/config.ts`) y queda dentro de la ley (L-V 7–19, sáb 8–15). Zona horaria del workflow: America/Bogota.
   GHL no conoce los **festivos**. Los que quedan son 12-oct, 2-nov, 16-nov, 8-dic y 25-dic de 2026, y 1-ene y 11-ene de 2027. Hay dos opciones: el día anterior a cada festivo, pausar los dos workflows (Draft) y publicarlos de nuevo al día siguiente, o aceptar el riesgo bajo. Recomendado: pausar.
3. **Un solo responsable por cada movimiento de etapa.** Ninguno de los dos workflows mueve una etapa que ya mueva el código o la asesora:
   - El código (`lib/agente/etapas.ts`) solo mueve Lead Nuevo → Asignado → Contactado y nunca toca 📋 Cotización Enviada ni 🔄 En Seguimiento (son "etapas vedadas" para Sol).
   - En Reservaciones, el Generador lleva la tarjeta a 💳 En Pagos con el primer abono y a 📁 Pagada y Documentada cuando el saldo queda en 0. V-01..V-05 la llevan a 🧳 Por Viajar.
   - Por eso **"Recordatorio de cuotas" no mueve ninguna etapa** y **"Seguimiento de cotización" solo mueve Cotización Enviada → En Seguimiento** al día 14, un paso que hoy no hace nadie más.
   - **Requisito previo:** revisar que **L-01** tenga la condición "solo si la etapa es Lead Nuevo o Asignado" antes de mover a 🤖 Calificado por Bot. Ya devolvió tarjetas de Contactado a Calificado (ping-pong en `iziYqri3AazSnSKIzADi`) y podría sacar una tarjeta de Cotización Enviada.
4. **Sol no interfiere**: Sol no responde ni hace seguimiento a oportunidades en Cotización Enviada o En Seguimiento (`etapasVedadas`; `lib/agente/seguimiento.ts` las excluye). No hay doble seguimiento.
5. Si el cliente pide que no le escriban más: activar DND en el contacto. Los workflows lo respetan.

---

## (a) L-05 · Cotización enviada → seguimiento

**Objetivo:** que ninguna cotización se quede sin seguimiento. Hoy el 44 % se queda así. **Carpeta:** la de Leads (junto a L-01..L-04).

### Configuración (Settings del workflow)
- **Allow re-entry: ON.** Si la asesora recotiza y vuelve a mover la tarjeta a Cotización Enviada, el ciclo arranca de nuevo.
- **Stop on response: ON** (el contacto sale al responder). Hay que probar que funcione con el proveedor personalizado del WhatsApp QR. Por si no funciona, también va el paso **Goal** (abajo) y la verificación de etapa antes de cada mensaje.
- Zona horaria America/Bogota.

### Disparador
- **Pipeline Stage Changed** → Pipeline: 🎯 Leads (`MLoZOGIYvCBRUgQdYRA8`) → Stage: 📋 Cotización Enviada (`f34e7cd3-673f-4405-b608-4a031eac04e8`).
- Filtro adicional: Status = Open.

### Pasos

| # | Acción | Detalle |
|---|---|---|
| 0 | **Goal** (en cualquier punto: "Contact replied", cualquier canal) | Si el cliente responde, sale del flujo → **Internal notification** a la asesora asignada: "{{contact.first_name}} respondió a la cotización de {{opportunity.destino_de_inters}}". |
| 1 | **Wait 24 h** (ventana hábil) | |
| 2 | **If/Else**: etapa = 📋 Cotización Enviada y status = Open | No → End. |
| 3 | **SMS (WhatsApp)**, mensaje D1 | Texto abajo. |
| 4 | **Wait 48 h** (ventana hábil) | Total: unas 72 h desde la cotización. |
| 5 | **If/Else**: etapa sigue en Cotización Enviada | No → End. |
| 6 | **Add Task** a la asesora asignada | Título: "📞 Día 3: contactar a {{contact.first_name}} por la cotización de {{opportunity.destino_de_inters}}". Descripción: "Llama o escribe según lo que prefiera el cliente (si pidió chat, NO llames). Aporta algo nuevo: cupos, otra fecha u otra opción de hotel. Fragmento: seguimiento-3". Vence en 1 día. |
| 7 | **Wait 4 días** (ventana hábil) | Total: unos 7 días. |
| 8 | **If/Else**: etapa sigue en Cotización Enviada | No → End. |
| 9 | **SMS (WhatsApp)**, mensaje D7 | Texto abajo. |
| 10 | **Wait 7 días** (ventana hábil) | Total: unos 14 días. |
| 11 | **If/Else**: etapa sigue en Cotización Enviada | No → End. |
| 12 | **Update Opportunity** → etapa 🔄 En Seguimiento (`202714ba-4a61-457d-b648-f5f7c99dc0ae`) | Es el único movimiento de etapa del workflow. |
| 13 | **Add Tag** `cotizacion_fria` | Para filtrar y reactivar después. |
| 14 | **Add Task** a la asesora asignada | "Cotización fría: enviar el mensaje de cierre amable (fragmento cierre-amable) o marcar como perdida con motivo". Vence en 2 días. |

La asesora no envía a mano el mensaje del día 1 ni el del día 7 (los manda el workflow). Ella hace el contacto del día 3 y el mensaje de cierre. No se marca "Perdida" de forma automática: esa decisión y el motivo son de la asesora.

### Mensajes

**D1 (+24 h)**
```
Hola, {{contact.first_name}} 😊 ¿Pudiste revisar la cotización de {{opportunity.destino_de_inters}}? Si quieres te ajusto el hotel o la fecha. Quedo pendiente. {{user.first_name}}, Travel World Colombia.
```

**D7 (+7 días)**
```
Hola, {{contact.first_name}}, paso a saludarte. Si sigues pensando en tu viaje a {{opportunity.destino_de_inters}}, te lo podemos dejar separado con el 30 % y el resto en cuotas hasta un mes antes del viaje. ¿Lo revisamos? {{user.first_name}}, Travel World Colombia.
```

> Si `{{opportunity.destino_de_inters}}` llega vacío, el texto queda "de ." Por eso, en el paso 2, agrega una rama: si "Destino de interés" está vacío, se usa la versión sin destino ("¿Pudiste revisar la cotización que te envié?"). `{{user.first_name}}` corresponde a la asesora asignada. Si sale vacío, quítalo.

### Prueba antes de publicar
1. Crea una oportunidad de prueba en Leads con tu propio contacto y muévela a Cotización Enviada.
2. Para no esperar 24 h, prueba en una copia del workflow con los Wait en 2–5 minutos. Verifica que (a) llega el D1 al WhatsApp, (b) si respondes, sales del flujo y llega la notificación, (c) si la mueves a otra etapa, no llega nada más.
3. Publica la versión real y borra la copia y la oportunidad de prueba.

### Medición
En 30 días, compara la conversión de las tarjetas que pasaron por Cotización Enviada con la línea base (cohorte de septiembre: 9,7 %). Para que el número valga, las asesoras tienen que mover la tarjeta al cotizar (regla 3 de la guía a7).

---

## (b) C-07..C-12 · Cuota N → recordatorio de pago

**Objetivo:** que nadie tenga que acordarse de cobrar cada cuota. **Carpeta:** 04 Contratos (o una nueva "05 Pagos").

### Campos que usa (oportunidad, carpeta "Plan de Pagos", creados el 08-oct)

| Cuota | Importe (NUMERICAL) | Fecha de vencimiento (DATE) |
|---|---|---|
| 1 | `Cuota 1 - Importe` · `{{opportunity.cuota_1__importe}}` | `Cuota 1 - Fecha de vencimiento` · `{{opportunity.cuota_1__fecha_de_vencimiento}}` |
| 2 | `Cuota 2 - Importe` · `cuota_2__importe` | `Cuota 2 - Fecha de vencimiento` · `cuota_2__fecha_de_vencimiento` |
| 3–6 | igual: `cuota_N__importe` | `cuota_N__fecha_de_vencimiento` |

Otros campos: `{{opportunity.destino_de_inters}}` (Destino de interés) y `{{opportunity.fecha_confirmada_de_salida}}`.
Los llena la asesora en el Generador de Contratos (Cuota 1–6). El contrato propio ya los imprime.

### Por qué un workflow por cuota
Los mensajes dicen el importe de **esa** cuota. GHL no deja saber cuál de varios disparadores se activó, así que lo más simple y seguro es **armar la cuota 1 completa, probarla y duplicarla 5 veces**. En cada copia se cambian solo el campo del disparador y las variables `cuota_1__…` por `cuota_N__…`. Nombres: `C-07 · Cuota 1 → recordatorio de pago` … `C-12 · Cuota 6 → recordatorio de pago`.

### Disparador (mismo patrón probado de V-01)
- **Recordatorio de fecha** → campo de fecha de **oportunidad** `Cuota 1 - Fecha de vencimiento` → **Antes de · exactamente 3 días** → hora 9:00.
  Usa "exactamente" y no "at most": con cuotas cargadas tarde se dispararían varios recordatorios juntos.

### Pasos

| # | Acción | Detalle |
|---|---|---|
| 1 | **Find Opportunity** | Pipeline 🗂️ Reservaciones · más reciente (igual que V-01; sin esto no hay condiciones de etapa). |
| 2 | **If/Else** | **Sí:** etapa = ✍️ Contrato Firmado **o** 💳 En Pagos, **y** `Cuota 1 - Importe` > 0. **No encontrada / otra etapa:** End. Si está en Pagada y Documentada, Por Viajar o Cancelada, no se cobra. Si está en Reserva Creada o Contrato Enviado, solo **Internal notification** a la asesora: "Cuota 1 de {{contact.name}} vence en 3 días, pero el contrato no está firmado". |
| 3 | **SMS (WhatsApp)**, mensaje −3 días | Texto abajo. |
| 4 | **Wait 3 días** (ventana hábil) | Cae el día del vencimiento. Si ese día no es hábil, sale el siguiente día hábil. |
| 5 | **If/Else**: misma condición que el paso 2 | No → End. Si la última cuota deja el saldo en 0, el Generador ya la pasó a Pagada y Documentada y aquí se detiene. |
| 6 | **SMS (WhatsApp)**, mensaje día 0 | Texto abajo. |
| 7 | **Wait 2 días** (ventana hábil) | |
| 8 | **If/Else**: etapa sigue en Contrato Firmado o En Pagos | No → End. |
| 9 | **Add Task** → asignada a **Luisa Aguirre** | Título: "💳 Verificar pago de la cuota 1 de {{contact.name}}: ${{opportunity.cuota_1__importe}}, vencía {{opportunity.cuota_1__fecha_de_vencimiento}}". Descripción: "Revisa los Pagos en el Generador. Si llegó, ciérrala. Si no, llama o escribe al cliente y avisa a la asesora". Vence en 1 día. |
| 10 | **Internal notification** a la asesora asignada | Mismo texto, para que esté al tanto. |

El workflow **no mueve ninguna etapa**: eso lo hace el Generador al registrar el pago.

### Mensajes

**−3 días**
```
Hola, {{contact.first_name}} 😊 Te recordamos que el {{opportunity.cuota_1__fecha_de_vencimiento}} vence tu cuota de ${{opportunity.cuota_1__importe}} del viaje a {{opportunity.destino_de_inters}}. Puedes pagar por PSE, Bre-B o transferencia aquí: travelworldcolombia.com/pagos. Al pagar, envíanos el comprobante por este chat. Si ya pagaste, ¡gracias! Ignora este mensaje.
```

**Día 0**
```
Hola, {{contact.first_name}}. Hoy vence tu cuota de ${{opportunity.cuota_1__importe}} del viaje a {{opportunity.destino_de_inters}}. Si ya la pagaste, envíanos el comprobante por aquí para registrarla. Medios de pago: travelworldcolombia.com/pagos. ¡Gracias!
```

### Puntos a verificar al armarlo
- **Formato de fecha e importe:** las fechas de oportunidad ya salieron en inglés en los contratos de GHL. Prueba `{{opportunity.cuota_1__fecha_de_vencimiento | date: "%d/%m/%Y"}}`. El importe puede salir sin separador de miles (1500000). Si se ve mal, deja solo la fecha y la frase "tu próxima cuota" o escribe el importe con separadores en otro campo de texto. Prueba siempre contigo antes de publicar.
- **Cuota pagada antes de tiempo:** hoy no hay un dato que diga "la cuota N está pagada". Los Pagos 1–4 registran abonos, pero no hay una correspondencia fija entre cuota y pago, y además hay 4 casillas de pago para 6 cuotas. Por eso los mensajes dicen "si ya pagaste, ignora este mensaje" y la tarea del paso 9 dice "verificar", no "cobrar". **Mejora recomendada (decisión del usuario):** agregar una casilla "Cuota N - Pagada" (o que el Generador la marque al registrar el pago) y usarla en los If/Else. Así no le llega el recordatorio a quien ya pagó.
- **Clientes con dos reservas:** "Find Opportunity · más reciente" podría tomar la otra tarjeta. Antes de publicar, resuelvan los 12 clientes con reservas duplicadas (auditoría B §8.4). En la condición del paso 2 se exige que `Cuota 1 - Importe` > 0 para reducir el riesgo.
- **Cuota con menos de 3 días:** si la asesora carga una cuota que vence en menos de 3 días, el disparador "exactamente 3 días" no la ve. En ese caso, la asesora avisa a mano (fragmento `recordatorio-saldo`).
- **Relación con V-01..V-05:** esos workflows ya avisan del saldo antes del viaje (−45/−30/−15/−7/−2) y V-04 y V-05 crean tareas de cobro. Este workflow cubre las cuotas intermedias. El contrato pide el pago total **máximo un mes antes del viaje**, así que la última cuota debería vencer antes de V-02 (−30 días).
- **Si el cliente responde "ya pagué":** le contesta la asesora. Revisen si Sol de respaldo también puede contestar en Reservaciones cuando la asesora tarda más de 2 h. Si es así, que diga solo "tu asesora lo confirma" y no prometa nada sobre pagos.

### Prueba antes de publicar
Oportunidad de prueba en Reservaciones (etapa En Pagos, tu contacto), con `Cuota 1 - Fecha de vencimiento` = hoy + 3 días e importe 1000. Comprueba el mensaje de −3 días y, en una copia con los Wait cortos, el de día 0 y la tarea a Luisa. Luego borra la tarjeta de prueba. No le pongas fecha de salida, para que no dispare V-01..V-07.
