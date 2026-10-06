# Cómo se venden los viajes en TWC — análisis de 302 ventas (05-oct-2026)

Fuente: las 304 oportunidades del pipeline 🗂️ Reservaciones (marzo → octubre 2026)
con sus conversaciones completas de GHL, recortadas a la preventa (antes de
contrato/pago) y sin teléfonos ni correos. Las leyeron 7 análisis en paralelo
(6 lotes de ventas de asesoras + 1 de ventas donde participó Sol). Solo lectura:
nada se modificó en GHL. Los `Vn` son ids internos del análisis, no de GHL.

## Advertencias sobre los datos

- **Solo ~45 % de las conversaciones muestran la preventa.** El resto arranca en
  contrato/pago/vouchers: la venta se cerró **en la oficina de Fusagasugá o por
  llamada** (pesa mucho: ~1 de cada 4 cierres visibles pasa por la oficina).
  Lo que se dijo por teléfono no está en los datos.
- **"Bot" ≠ "Sol actual".** Hay mensajes de bot ("¡Hola! Soy Sol…", pedir correo,
  presupuesto repetido) desde **febrero 2026**: era la Conversation AI nativa de
  GHL. La Sol actual (Claude) entra en agosto. Los peores vicios del "bot"
  (pedir el presupuesto 3-8 veces, insistir en el correo, "no tengo acceso al
  NIT", "hay sede en Bogotá") son mayormente del bot viejo. Aun así hay ~114
  mensajes de bot en sep-oct sin registrar en `agente_mensajes_enviados` —
  **pendiente verificar** si son de Sol (huecos de registro) o del bot viejo aún
  activo en algún canal.
- Varias personas escriben desde la misma cuenta de GHL ("te habla Johana" desde
  la cuenta de Pilar), así que la atribución por asesora es aproximada.
- Solo hay ventas GANADAS: no se puede contrastar contra las perdidas.
- ⚠️ Una conversación interna dentro del pipeline tiene **contraseñas a la vista**
  (GHL y portales de proveedores). Cambiarlas y borrar esos mensajes.

## 1. Cómo venden las asesoras (el patrón ganador)

1. **Descubrimiento mínimo:** fecha → cuántas personas (edades) → ciudad de
   salida → acomodación. **Casi nunca preguntan presupuesto antes de cotizar**;
   aparece solo cuando hay objeción de precio.
2. **Cotizan rápido** (mismo día o siguiente en las ventas ágiles) con la
   plantilla "✈️ TU VIAJE SOÑADO A …": fechas, vuelo, ✅ incluye / ❌ no incluye,
   **precio por persona**, **2 a 4 opciones en escalera** (hoteles, fechas,
   aerolínea, plan de comidas) + **nota de voz** que explica las diferencias.
   A menudo **recomiendan una** ("mi recomendación es…", "el súper recomendado").
   Internacional: dólares convertidos a pesos con la TRM del día.
3. **Micro-compromiso = "bloqueo":** apenas el cliente elige, piden los
   documentos "para bloquear la tarifa y que no nos cambie" (a veces "sin ningún
   compromiso"). Es su versión del "¿reservarías?" de la dueña, más suave.
4. **Cierre directo o de alternativa:** "¿reservamos esta opción?", "¿vienes
   ahorita o me realizas transferencia?", "¿el pago lo harías hoy? ¿por qué
   medio?", "Listo, ya quedó todo tomado, solo confirma cuando hagas el abono".
5. **Urgencia — real:** tarifa del día, la naviera tiene la cabina bloqueada,
   "últimas sillas", corte de contabilidad antes de las 4 p. m., la TRM.

## 2. Política de anticipo que se ve en la práctica (no está escrita)

- Separación típica **40-50 %** (rango observado 20-57 %), a veces un monto por
  persona ($300.000 … $1.900.000) o "vuelos + asistencia".
- **Saldo completo 1 mes antes del viaje** (regla muy consistente).
- **Viaje a menos de un mes / tarifa no reembolsable / tiquetes sueltos: pago total.**
- Medios: transferencia/llave Bancolombia o Davivienda, efectivo en la oficina,
  link Prix; tarjeta con recargo ~5-6 %. "Ahorro programado" para viajes lejanos.
- ➜ Hace falta que la dueña la **fije por escrito** antes de enseñársela a Sol.

## 3. Objeciones → lo que funcionó

| Objeción | Respuesta que cerró |
|---|---|
| "Está caro" | Ajustar UNA variable por iniciativa propia: quitar un día, hotel de menor categoría, otra fecha, otro plan de comidas ("¿le restamos un día? nos baja un poquito"). |
| Mejora más cara | "Sube solo $100.000 por pasajero, pero pierden menos tiempo en traslados y no se pierden el desayuno." |
| Cotizó en otra agencia | "Compárteme esa cotización y te valido si te la puedo mejorar" → revisar inclusiones + valor del acompañamiento. |
| "Lo hablo con mi esposo/familia" | Dar espacio con un paso: "revísala esta noche con tu esposo y me cuentas para congelar los cupos"; al día siguiente **nombrar al tercero**: "¿qué te dijo tu esposo?". A veces videollamada con quien decide. |
| "Subió el precio" | Aclarar la cifra exacta (p. ej. eran $180.000, no un millón) y separar abono de total. |
| Sin cupo en la fecha | Proponer de inmediato fechas/destinos alternos (a veces más baratos). |
| No tengo el dinero completo | Bloqueo parcial, plan separe, abonos mensuales. |

## 4. Señales de compra (lo que dice el cliente justo antes de comprar)

"¿Con cuánto se aparta?" · "¿Cuánto tendríamos que abonar?" · "¿A dónde
consigno? / ¿tienes llave?" · "¿Reciben tarjeta?" · "¿Hasta qué hora están en
la oficina?" · elige una opción con su precio ("vamos con ese") · recapitula
el plan · **manda cédulas/pasaportes sin que se los pidan** · "quiero asegurar
el viaje pronto".

➜ Cuando aparece una de estas, el lead está **listo**: no hace falta la
pregunta de compromiso; hay que pasarlo YA con prioridad.

## 5. Seguimiento

- Lo más común y efectivo: **a la mañana siguiente**, con una pregunta concreta
  ("¿qué opción te gustó más?", "¿qué te dijo tu esposo?").
- Reactivar con **una novedad** (promo, baja de tarifa, "logré bajártela").
- Plantilla de ~10 días que funcionó (el cliente volvió a reservar 19 días
  después): "¿pudiste revisar la cotización? … si prefieres dejarlo para más
  adelante también está perfecto".
- **No funciona:** "Hola, ¿cómo estás?" vacío semanal; la secuencia automática
  del bot viejo (2 h / día siguiente / "último mensaje").

## 6. Dónde se pierden (o casi) las ventas

1. **Lentitud — el problema #1.** Tras el traspaso de Sol, la asesora tarda una
   **mediana de ~13 h** en escribir; en ~6 de 13 ventas el cliente tuvo que
   reclamar su cotización. Cotizaciones a 4-8 días, chats olvidados semanas;
   dos ventas casi perdidas ("ya lo adquirimos por otro lado"). Las ventas con
   cotización en < 3 h cerraron el mismo día o al siguiente.
2. **Precio confuso:** por persona vs por pareja, USD vs COP, cifras que cambian
   entre mensajes, "desde" de temporada baja que choca con la tarifa real.
3. **Bot metiéndose donde no va:** pedir nombre/presupuesto a quien ya está
   pagando o mandando documentos; datos falsos de la empresa.
4. Repreguntar datos ya dados (bot y asesoras tras el traspaso).
5. Errores operativos: contrato con errores, PDF equivocado, enlaces que no abren.

## 7. Qué aportó la Sol actual (17 ventas reales en las que participó)

- ✅ Atiende de noche/fin de semana y deja el lead calificado antes de abrir
  (5 de 13); su seguimiento revivió una venta tras 9 días de silencio; el
  presupuesto que capturó ayudó a acertar la oferta; da confianza (RNT, años).
- ❌ Repregunta a veces; mensajes dobles; aviso legal como burbuja aparte;
  promete "un momentito" cuando la espera real son horas o días; precios
  "desde" que crean falsas expectativas; acepta fechas sin salida confirmada;
  ruido con clientes que ya compraron; **nunca habla de cómo se aparta** (abono,
  medios de pago), aunque el cliente dé señales de compra.

## 8. Implicaciones para el rediseño de Sol

1. **No exigir presupuesto**: anclar con un rango ("de lo más económico a lo
   premium") y preguntarlo solo ante objeción (así venden las asesoras).
2. **Detectar las señales de compra (§4)** → traspaso inmediato con prioridad
   "listo para reservar". La pregunta de compromiso queda para los tibios, con
   el lenguaje de la casa ("¿te la dejamos bloqueada para que no se suba?").
3. **Saber cómo se aparta** (política escrita del §2) para responder "¿con
   cuánto se separa?" sin escalar a ciegas.
4. **Tiempos honestos** y, sobre todo, **atacar el tiempo de respuesta de la
   asesora** (alerta/cola de prioridad): es la palanca comercial más grande.
5. Callar o escalar cuando el cliente ya compró / manda documentos / hay pago.
6. Biblioteca de frases (abajo) como ejemplos por situación.

## Anexo — frases de asesoras para enseñar a Sol (anonimizadas)

- Cierre: "¿hacemos el bloqueo de una vez para asegurar tarifa?" · "entonces
  ¿reservamos esta opción?" · "¿el pago lo harías hoy? ¿y por qué medio?"
- Bloqueo: "envíame los documentos por ambos lados para bloquear tarifa y que
  no nos cambie"
- Anticipo: "lo puedes reservar desde el X % y el restante lo pagas un mes
  antes de la fecha de viaje"
- Ajuste: "¿le restamos un día? nos baja un poquito, ¿qué te parece?" ·
  "cuéntame en dónde me puedo ajustar"
- Valor: "sube solo $100.000 por pasajero, pero pierden menos tiempo en los
  traslados y no se pierden el desayuno"
- Pareja: "revísala con calma esta noche con tu esposo y me cuentas qué
  decidieron para ayudarte a congelar los cupos" · (día siguiente) "¿qué te
  dijo tu esposo?"
- Competencia: "¿me podrías compartir esa cotización? y te valido si te la
  puedo mejorar"
- Seguimiento: "¿pudiste revisar y comparar? ¿cuál te gustó más?" · "si logro
  conseguirte una mejor tarifa, ¿te gustaría aprovecharla hoy?" · "si prefieres
  dejarlo para más adelante, también está perfecto"
- Reactivar: "acuérdate que el plan es totalmente modificable: podemos
  agregar, quitar o cambiar la hotelería"
