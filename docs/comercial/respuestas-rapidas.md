# Respuestas rápidas (Fragmentos de GHL) para asesoras

*10-oct-2026 · 15 plantillas para cargar en GHL → Conversations → Snippets (Fragmentos) → Add snippet, tipo texto. En el chat se insertan con el botón de fragmentos o escribiendo `/` + el nombre.*

**Cómo usarlas**
- `{{contact.first_name}}` y `{{user.first_name}}` (la asesora que envía) los llena GHL. Prueba cada fragmento contigo misma antes de usarlo con clientes: si sale la llave literal `{{…}}`, bórrala y escribe el dato a mano.
- Lo que va entre **[CORCHETES]** lo llenas tú siempre (destino, cifra, fecha). No envíes un mensaje con corchetes.
- Los precios salen de la ficha del paquete o de la cotización. Nunca de memoria.
- Los fragmentos son para escribir más rápido, no para no leer. Ajusta cada uno a lo que el cliente ya dijo.
- Envíos solo de lunes a viernes de 9 a. m. a 5 p. m. y el sábado de 9 a. m. a 1 p. m. (Ley 2300: nada de domingos ni festivos).

---

### 1. `bienvenida-sol`: primer mensaje después del traspaso de Sol
```
¡Hola, {{contact.first_name}}! 😊 Soy {{user.first_name}}, de Travel World Colombia. Ya tengo lo que le contaste a Sol: [DESTINO], [FECHAS], [N] personas saliendo de [CIUDAD].
Para esas fechas el plan está desde $[PRECIO] por persona ([QUÉ INCLUYE]). ¿Te armo la cotización con esa opción o prefieres ver dos para comparar?
```

### 2. `visa-antes`: pregunta antes de cotizar EE. UU., Disney, Hawái o cruceros por EE. UU.
```
{{contact.first_name}}, antes de armarte la cotización: ¿todos los viajeros tienen visa americana vigente (y les sigue vigente en la fecha del viaje)? Así te cotizo algo que de verdad puedan usar 🙌
```

### 3. `cotizacion`: envío de cotización (acompaña siempre el adjunto)
```
{{contact.first_name}}, aquí está tu cotización para [DESTINO] 📎
Resumen: [N] personas, [FECHAS], [HOTEL / CABINA]. Total: $[TOTAL] ($[POR PERSONA] por persona).
Incluye: [INCLUSIONES PRINCIPALES]. No incluye: [LO MÁS IMPORTANTE].
¿Qué te parece? Si quieres le cambio el hotel o la fecha.
```
*Después de enviarla, mueve la tarjeta a 📋 Cotización Enviada.*

### 4. `como-reservar`: cierre con abono
```
Para separar tu viaje, {{contact.first_name}}:
1️⃣ Abono de $[ABONO] ([30] % del total de $[TOTAL]). Con el abono confirmamos tus servicios y la tarifa queda asegurada.
2️⃣ El saldo lo pagas en cuotas; el pago total debe estar máximo un mes antes del viaje ([FECHA]).
3️⃣ Te envío el contrato por un enlace seguro (te llega un código a este WhatsApp para abrirlo), lo lees y lo firmas.
Solo necesito la foto de la cédula del titular. ¿Te lo separo hoy?
```

### 5. `medios-pago`: medios de pago (copiados de travelworldcolombia.com/pagos)
```
Estos son nuestros medios de pago, {{contact.first_name}} 👇
💻 PSE (sin costo) y 💳 tarjeta de crédito (+5 %): travelworldcolombia.com/pagos
⚡ Bre-B: Bancolombia 0090272526 · Davivienda @9005371997
🏦 Bancolombia ahorros 264-133178-51 · Davivienda corriente 406-169997292
🇺🇸 Desde EE. UU.: Zelle vamospormasusa@gmail.com · Chase corriente 53-18-59-687
⚠️ Verifica que el destinatario sea Vamos Por Más SAS o Travel World Colombia Agencia de Viajes. Al pagar, mándame el comprobante por aquí para confirmar tu reserva.
```

### 6. `documentos`: aviso del portal de documentos
```
{{contact.first_name}}, para dejar lista tu reserva necesitamos los documentos de los viajeros (cédula o pasaporte, y visa si el viaje la pide). En un momento te llega por aquí un enlace seguro 🔒 Al abrirlo te mandamos un código a este WhatsApp. Solo tu asesora ve las fotos y se borran al terminar el viaje.
```
*El enlace lo manda C-05 cuando pulsas "Enviar enlace" en la pestaña Documentos del Generador. Este fragmento solo avisa.*

### 7. `abono-recibido`: confirmación de abono
```
¡Recibido, {{contact.first_name}}! ✅ Confirmamos tu abono de $[VALOR] del [FECHA] para [DESTINO].
Saldo pendiente: $[SALDO]. Próxima cuota: $[VALOR CUOTA] hasta el [FECHA CUOTA].
Te aviso apenas tengamos los servicios confirmados con el operador. ¡Gracias por confiar en nosotros!
```

### 8. `recordatorio-saldo`: recordatorio de saldo o cuota (manual)
```
Hola, {{contact.first_name}} 😊 Te recuerdo que el [FECHA] vence tu cuota de $[VALOR] del viaje a [DESTINO] (saldo total pendiente: $[SALDO]). Puedes pagar por PSE, Bre-B o transferencia: travelworldcolombia.com/pagos
Si ya la pagaste, mándame el comprobante y lo registro. ¡Gracias!
```
*Antes de enviarlo, verifica la fecha. Ya salió uno con un plazo vencido.*

### 9. `sin-visa`: alternativa sin visa (genérica)
```
Entiendo, {{contact.first_name}}. Tenemos dos caminos: 1) hacer primero el trámite de la visa y planear el viaje con tiempo, o 2) buscar un plan que no la pida para colombianos. Si te interesa la segunda, te reviso los requisitos de cada opción y te mando las que apliquen para ti. ¿Cuál ves más viable?
```
*No nombres un destino "sin visa" si la ficha no dice "No requiere visa". Revisa el dato "Visa colombianos" de la ficha antes de ofrecerlo.*

### 10. `seguimiento-1`: día 1 después de cotizar
```
Hola, {{contact.first_name}} 😊 ¿Pudiste revisar la cotización de [DESTINO]? Si quieres le ajusto el hotel, la fecha o el número de noches. Quedo pendiente.
```

### 11. `seguimiento-3`: día 3 (con algo nuevo)
```
{{contact.first_name}}, te cuento una novedad de tu viaje a [DESTINO]: [QUEDAN N CUPOS EN ESA SALIDA / ENCONTRÉ UNA OPCIÓN EN $X / HAY OTRA FECHA MÁS ECONÓMICA]. ¿Te la mando para que compares?
```

### 12. `seguimiento-7`: día 7
```
Hola, {{contact.first_name}}, paso a saludarte. Si sigues pensando en [DESTINO] para [MES], te lo puedo dejar separado con el 30 % y el resto en cuotas hasta un mes antes del viaje. ¿Lo revisamos?
```

### 13. `cierre-amable`: cierre sin respuesta (día 10–14)
```
{{contact.first_name}}, no quiero llenarte de mensajes, así que este es el último por ahora. Si más adelante quieres retomar tu viaje a [DESTINO] o planear otro, escríbeme y lo armamos con gusto. ¡Gracias por pensar en Travel World Colombia! ✈️
```
*Después: tarjeta a ❌ Perdida / Abandonado con motivo "No responde".*

### 14. `lo-pienso`: "lo pienso / lo consulto"
```
¡Claro, {{contact.first_name}}! Es una decisión para compartir. Te mando un resumen corto para que lo revisen juntos. ¿Hay algo puntual que te frene (el valor, la fecha o el destino)? Si te parece, te escribo [MAÑANA / EL DÍA] a las [HORA].
```

### 15. `reactivacion`: cliente que cotizó hace semanas o meses
```
Hola, {{contact.first_name}} 😊 Soy {{user.first_name}}, de Travel World Colombia. Hace un tiempo hablamos de tu viaje a [DESTINO]. ¿Sigue en tus planes? Tenemos [SALIDA / OFERTA VIGENTE CON FECHA] desde $[PRECIO] por persona. Si ya no te interesa, me dices y no te escribo más.
```
*Solo uno a uno, en horario hábil. Las campañas masivas van por el flujo de reactivación de Sol, no por aquí (el WhatsApp QR se puede bloquear con envíos en lote).*

---

**Para revisar antes de cargarlos**
- El contrato dice "PSE: zonapagos.com/basica", pero /pagos usa el portal de pagos de Davivienda. Confirmen cuál es el vigente y unifiquen. Los fragmentos usan /pagos.
- Los números de cuenta y las llaves son los publicados en /pagos el 10-oct-2026. Si cambian allá, hay que cambiarlos aquí.
- Los únicos números autorizados para ventas son el 320 489 1930 y el 300 569 3381. Ningún fragmento debe dar otro número.
