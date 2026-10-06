# Plan — Sol vendedora (v2) · borrador 05-oct-2026

Base: [análisis de 302 ventas](analisis-ventas-reservaciones-2026-10.md) + flujo
propuesto por la dueña + revisión del código actual (`lib/agente/`).
Estado: **propuesta, nada implementado**. Las decisiones abiertas están al final.

## 1. Lo que ya existe (no hay que construirlo)

- **Arquitectura por capas** (`claude.ts` + `conocimiento.ts`):
  instrucciones fijas (cacheadas) → índice del catálogo + FAQ + datos de la
  agencia (cacheado, leído en vivo de Supabase = lo mismo que muestra la web) →
  detalle completo SOLO del destino que el cliente menciona (por turno) →
  situación del turno (fecha, horario, anuncio, seguimiento…).
- **Foto + link de la página de producto**: Sol ya puede adjuntar la foto
  principal con el marcador `[foto:slug]` y conoce el link `/destinos/slug` de
  cada programa. Falta convertirlo en una "jugada" explícita (ficha: foto +
  link + 2 líneas de por qué le encaja) y no "una foto, una vez".
- Seguimiento dinámico, temperatura, escritura en la oportunidad de GHL.

## 2. Lo que está mal en el conocimiento (arreglo de datos, no de código)

- **Los destinos que más se venden no tienen precio** en el catálogo:
  San Andrés, Cartagena, Santa Marta, Aruba, Coveñas (precio_desde vacío).
- Punta Cana SÍ está (slug `republica-dominicana`, desde $2.900.000) — corregido;
  es el destino más cotizado (36 cotizaciones en ventas).
- Cancún: a las ~19 h el texto decía "USD $3.200.000"; ahora dice $3.000.000 COP en ambos campos (alguien lo editó en el panel).
- No existe en ningún lado: política de reserva/anticipo, rangos por
  temporada, medios de pago para que Sol los explique.

## 3. Cómo estructurar a Sol (en vez de un prompt larguísimo)

Hoy `prompt.ts` es un solo bloque de ~25 KB que mezcla identidad, reglas,
método de venta, formato y operación. No es "demasiado largo" para el modelo,
pero tiene reglas que chocan entre sí (presupuesto obligatorio-pero-opcional,
"no presiones" vs cerrar) y todo pesa igual en cada turno. Propuesta:

| Capa | Qué lleva | Dónde vive | Quién lo edita |
|---|---|---|---|
| 1. Núcleo | Identidad, reglas que no se rompen, tono, formato WhatsApp, seguridad | Código (corto) | Nosotros |
| 2. Método de venta | Estados comerciales, qué hacer en cada uno, señales de compra, cuándo pasar a asesora | Código, por módulos | Nosotros (validado por la dueña) |
| 3. Conocimiento | Catálogo + FAQ (ya) · **tabla de rangos** · **política de reserva** · medios de pago · oficina | Supabase, panel /admin | La agencia |
| 4. Ejemplos | Frases reales de las asesoras por situación (2-3 por turno, no todas) | Supabase, panel | La agencia / nosotros |
| 5. Situación | Fecha, horario, anuncio, **estado comercial del turno anterior** | Por turno | Automático |

Clave: el **estado comercial** que Sol devuelve en un turno decide qué módulo y
qué ejemplos se inyectan en el siguiente (p. ej. si hay objeción de precio,
entra el módulo de objeciones + 2 ejemplos de "está caro"). Una sola llamada al
modelo por turno, sin costo extra; el prompt de cada turno es más corto y más
enfocado. Con ~40 programas NO hace falta base vectorial: el catálogo entra
completo como índice; los ejemplos se eligen por etiqueta de situación.

Límite técnico conocido: el esquema de salida está al borde ("Schema is too
complex"). Para agregar `estado_comercial`, `bloqueo` y `senal_compra` hay que
fusionar campos (p. ej. `confianza` e `idioma` al resumen).

## 4. Método de venta v2 (lo que Sol haría distinto)

Estados: **explorando · falta información · objeción · consultando con quien
decide · listo para reservar · nutrir (más adelante)**.

1. **Descubrimiento corto** (como las asesoras): destino, fecha, cuántos
   (edades), ciudad de salida. Presupuesto NO se pide de entrada.
2. **Ancla con rango real** de la tabla (por persona, temporada, qué incluye)
   + ficha (foto + link). Si no hay rango para ese destino, no inventa.
3. **Señal de compra** ("¿con cuánto se aparta?", "¿a dónde consigno?", manda
   documentos, elige opción, "¿hasta qué hora están?") → **listo para
   reservar**: traspaso inmediato con prioridad, explicando cómo se aparta.
4. **Sin señal pero interesado** → pregunta de compromiso UNA vez, en el
   lenguaje de la casa: "si te encontramos la opción que buscas, ¿te la dejamos
   bloqueada con el abono para que no se suba la tarifa?". Sí → traspaso.
   Todavía no → diagnosticar qué lo frena (presupuesto, fechas, quién decide).
5. **Objeciones** con las respuestas que cerraron ventas (ajustar una variable,
   "sube solo X pero…", "compárteme la otra cotización", "¿qué te dijo tu
   esposo?" al día siguiente).
6. **Nutrir** a los que no están listos: seguimiento con novedad, nunca el
   "hola, ¿cómo estás?" vacío.
7. **Tiempos honestos** al pasar a la asesora y **silencio** cuando el cliente
   ya está comprando/mandando documentos/pagando.

## 5. Traspaso y velocidad (la palanca más grande)

La mediana entre el traspaso de Sol y el primer mensaje de la asesora es
~13 h. Propuesta: etapa/tag "🔥 Listo para reservar" separado de "calificado",
alerta inmediata a la asesora asignada (y a la dueña si no responde en X min),
y medir el tiempo de respuesta. Sin esto, mejorar a Sol rinde poco.

## 6. Fases

0. **Datos y limpieza** (sin tocar a Sol): precios del catálogo,
   política de reserva escrita, tabla de rangos v1 (abajo), cambiar las
   contraseñas expuestas, verificar que el bot viejo de GHL esté apagado.
1. **Sol v2**: prompt por capas + estados + señales + compromiso + rangos +
   política + ficha foto/link. Probada contra un banco de 30-50 escenarios
   (los 4 de la dueña + casos reales) antes de salir.
2. **Traspaso rápido**: etapa "Listo para reservar", alertas, métrica de tiempo.
3. **Aprender de la mejor vendedora**: biblioteca de ejemplos (ya hay ~40
   frases) + las conversaciones nuevas de la dueña + prueba a ciegas.
4. **Medir**: % de leads que pasa Sol, tasa de cierre de esos leads, tiempo a
   cotización — antes vs después.

## 7. Tabla de rangos v1 (por persona, desde Bogotá, acomodación doble)

Propuesta para que la dueña la corrija. "Ventas TWC" = precios por persona
cotizados por las asesoras en las conversaciones que terminaron en venta
(feb-sep 2026, mayormente temporada baja/media). "Mercado" = ofertas públicas
consultadas el 05-oct-2026 (Decameron, Aviatur, On Vacation, etc.).

| Destino | Ventas TWC (mín – máx, mediana) | Mercado (baja) | Notas |
|---|---|---|---|
| San Andrés (4-5 días) | 1,73 – 3,45 M (med 2,5 M), 32 cotizaciones | 2,0 – 3,5 M todo incluido; 1,0 – 1,5 M con desayuno | + tarjeta de turismo ~153.000 aparte |
| Punta Cana (5 noches) | 1,6 – 6,7 M (med 3,3 M), 36 cotizaciones | 2,8 – 5,5 M; resorts top hasta ~7,7 M | El destino más cotizado; catálogo: desde $2.900.000 |
| Cartagena (3 noches) | 1,3 – 2,3 M (med 1,6 M) | 1,6 – 3,0 M | |
| Santa Marta (3 noches) | 1 dato: 1,06 M | 1,45 – 2,5 M | Datos internos insuficientes |
| Panamá ciudad + playa | 1,1 – 6,0 M (med 3,5 M) | 3,5 – 4,0 M; enero ~5,3 M | |
| Cancún (5-6 noches) | 2,6 – 2,9 M (2 datos) | 3,0 – 6,0 M (baja confianza) | Catálogo: desde $3.000.000 |
| Aruba | 1 dato: 4,98 M | 2,5 – 4,5 M desayuno; 5,5 – 6,2 M todo incluido | |
| Curazao (4 noches) | — | 3,5 – 5,0 M | |
| Coveñas (3 noches) | 1 dato: 2,98 M | 1,88 M baja / 2,35 M alta (con vuelo) | Bus mucho más barato |
| Eje Cafetero (3 noches) | catálogo desde 1,1 – 1,28 M | 0,95 – 1,3 M por tierra | |
| Crucero Caribe desde Cartagena (7 n.) | catálogo USD 1.886 | USD 1.009 – 1.790 según cabina | + propinas ~USD 130/semana y vuelo a Cartagena |

Diciembre-enero y Semana Santa casi no están verificados: subir ~15-25 % y
decir siempre "sujeto a fecha y disponibilidad".

## 8. Sistema a prueba de errores del catálogo (diseño acordado, sin ejecutar)

Decidido el 05-oct-2026:
- **Publicar sin precio se BLOQUEA**, salvo que el programa se marque
  explícitamente como "a la medida, sin precio publicado".
- Al guardar: confirmación si el precio se sale de rango razonable
  (USD > 20.000; COP < 100.000 o > 50 M) + fecha de actualización del precio
  (aviso si tiene más de 90 días).
- Página "Salud del catálogo" en /admin (sin precio, sin foto, precio viejo,
  moneda sospechosa, sin itinerario) con contador en el menú, usando el MISMO
  código que la web y Sol (getDestinos / precioDesde), no consultas aparte.
- Prueba automática: Sol recibe todos los programas activos (mismo conteo que la web).
- **Alerta semanal por SMS al usuario (Fabrizio) y a Ginna Cardenas.**
  Pendiente al ejecutar: sus números / ids de usuario en GHL y desde qué
  número de la subcuenta sale el SMS.

## 9. Respuestas del usuario (05-oct-2026)

1. **Anticipo: 20 %** para empezar (se ajusta después; la meta es que funcione).
   → Debe quedar editable desde el panel, no fijo en código.
2. **Rangos: sí**, arrancamos con la tabla del §7.
3. **Compromiso: pregunta DINÁMICA** que Sol adapta al contexto, cuyo fin es
   lograr un primer compromiso ("pie de entrada"), no un guion fijo.
4. **Traspaso: como hoy** (silencioso, "dame un momento mientras armamos tu cotización").
5. **Precios faltantes del catálogo: los está cargando la agencia.**
6. **Saldo:** se paga un mes antes del viaje; si el viaje es en menos de un
   mes, pago total. Editable en el panel, igual que el 20 %.
7. **Sin "fuera de horario":** Sol ya NO dice que las asesoras no están
   disponibles ni habla de horarios. Confirma lo que se hizo (p. ej. que su
   solicitud ya quedó en manos del equipo) y que lo contactan lo más pronto
   posible, con palabras que salgan de la conversación (dinámico, sin frase
   fija). Aplica a todo: traspaso, escalada, modo respaldo y seguimientos.
   Hoy hay que quitarlo de: prompt.ts (Camino 1 "apenas abramos", Camino 2),
   la situación de claude.ts (líneas de enHorario) y lineaRespaldo.
8. **Oficina y llamada:** Sol puede ofrecer ambas cuando el cliente ya está interesado.
9. **Aviso "listo para reservar":** a la asesora asignada (notificación GHL);
   si no responde en 30 min en horario, aviso a Fabrizio Villanueva y Ginna
   Cardenas.
10. **Urgencia:** solo promociones con fecha límite y cupos cargados en el
    panel; nada inventado.
11. **Ciudad de salida:** Bogotá por defecto, confirmándola de pasada.
12. **Canal de alertas (catálogo y "listo para reservar"):** el mismo canal
    de hoy — el proveedor "SMS" de GHL que en realidad sale por WhatsApp
    (custom provider), desde el número de la cuenta, a los contactos
    "Fabrizio Villanueva" y "Ginna Cardenas" que ya existen en GHL.
    Registrar esos envíos en agente_mensajes_enviados (si no, el vigilante los
    toma como mensajes humanos).

## 10. Probar a la nueva Sol sin reemplazar a la actual

Pedido del usuario: nada reemplaza a la Sol actual hasta probar la nueva.
1. **Banco de escenarios (sin clientes):** 30-50 conversaciones (los 4 casos de
   la dueña + casos reales de ventas y de Leads). Se corren v1 y v2 lado a lado;
   informe con las diferencias para revisar con la dueña.
2. **Modo sombra (clientes reales, sin enviar):** v2 decide en paralelo cada
   mensaje real; su respuesta se guarda en Supabase pero NO se envía. Informe
   diario "lo que mandó v1 vs lo que habría mandado v2". Costo de modelo ~2x
   mientras dure.
3. **Piloto con tag `sol_v2`:** v2 responde solo a contactos con ese tag —
   primero contactos de prueba (Fabrizio, Ginna, opps de CAPACITACIÓN), luego
   un % de leads nuevos.
4. **Interruptor:** volver a v1 al instante (variable/panel), sin deploy. El
   código de v1 queda intacto hasta retirar v1.
5. **Criterios de paso definidos antes de empezar** (cero datos inventados,
   cero repreguntas, tono aprobado por la dueña, etc.).

## 11. Revisión de campos de oportunidad (05-oct-2026, solo lectura)

Datos: 207 campos de oportunidad; pipeline Leads con 1.670 oportunidades
(todas leídas), 465 creadas en los últimos 30 días.

- **Llenado de la calificación (últimos 30 días):** nivel de urgencia 64 %,
  destino 46 %, adultos/fechas/brief 34 %, ciudad 30 %, presupuesto 4 %.
  Pendiente separar cuánto es "el lead no contestó" vs "Sol no lo capturó".
- **Motivo de pérdida: 1 de 54** perdidas/abandonadas lo tiene → hoy no se
  puede aprender de las ventas perdidas.
- `Motivo del viaje` existe en la oportunidad y Sol no lo escribe (solo va al resumen).
- Los 11 campos `sol_*` (estado, temperatura, objeciones…) siguen en el
  CONTACTO, mientras la calificación ya vive en la OPORTUNIDAD: con dos viajes
  del mismo cliente se mezclan.

**Faltan para Sol v2 (en la oportunidad):** estado comercial (lista),
señal de compra (texto), respuesta a la pregunta de compromiso (sí / todavía
no / no preguntada), objeción principal (lista) + detalle, quién decide,
rango de referencia que Sol dio, canal de cierre preferido (WhatsApp /
llamada / oficina). Los tiempos (hora de "listo para reservar" y primera
respuesta de la asesora) mejor en Supabase: los campos DATE de GHL no guardan hora.

## 12. Mover los `sol_*` del contacto a la oportunidad (diseño, sin ejecutar)

Pedido del usuario (05-oct): borrarlos del contacto, crearlos en la
oportunidad, en su carpeta. ⚠️ Revierte una decisión del 02-oct
(handoff-ghl-reestructura: "sol_* se quedan en el contacto").

Carpeta destino: **⭐ Calificación (Sol)** de oportunidad (`x2Jw8uhopfBq1Or1zH2y`,
ya existe; la API crea campos dentro con `parentId`, como ya se hizo con los 161).

| Campo contacto (carpeta IA) | En la oportunidad |
|---|---|
| sol_estado | → **Estado comercial** (lista nueva: explorando / falta información / objeción / consultando con quien decide / listo para reservar / nutrir / escalado / no interesado / dormido) |
| sol_temperatura | → Temperatura (igual) |
| sol_resumen | → ya existe "Mensaje de cotización"; el resumen va en un campo propio "Resumen de Sol" |
| sol_objeciones | → **Objeción principal** (lista) + **Detalle de la objeción** |
| sol_motivo_cierre | → se apoya en el motivo de pérdida nativo de GHL |
| sol_confianza | → Confianza de los datos |
| sol_canal, sol_ultima_interaccion, sol_proximo_seguimiento, sol_intentos_seguimiento | → oportunidad (por viaje) |
| sol_idioma | → **se queda en el contacto** (decidido 05-oct: es de la persona) |

Más los nuevos de §11 (señal de compra, respuesta al compromiso, quién decide,
rango dado, canal de cierre preferido) y empezar a escribir **Motivo del viaje**
(ya existe en 🗺️ Generales del Viaje).

Orden seguro: (1) respaldo de los valores en .respaldos-ghl/ → (2) crear los
campos en la oportunidad → (3) copiar los valores a la oportunidad abierta de
Leads de cada contacto → (4) Sol escribe en los nuevos → (5) verificar que
ningún workflow / lista inteligente use los viejos (la API no lo muestra:
revisarlo en la UI) → (6) recién ahí borrar los del contacto (o cuarentena
"🗄️ Por eliminar" como los 180 anteriores).

## 13. Lo que le faltaba al plan (revisión 05-oct)

1. **Medir la línea base ANTES de cambiar nada** (leads → venta, tiempo a
   cotización, % que pasa Sol, motivo de pérdida). Sin foto del "antes" no hay
   forma de demostrar la mejora.
2. **El lado de las asesoras:** SLA de respuesta, usar el brief sin
   repreguntar, motivo de pérdida obligatorio, etapa "Listo para reservar".
   Capacitación corta (encaja en el curso GHL de docs/curso-ghl/).
3. **Acelerar la cotización:** que Sol deje un BORRADOR en formato "TU VIAJE
   SOÑADO" (catálogo + rangos) para que la asesora solo valide y envíe. Ataca
   la mediana de ~13 h.
4. **Clientes que vuelven y referidos:** reconocer ventas previas
   (Reservaciones) y tratarlos distinto (no recalificar desde cero).
5. **Instagram/Facebook:** solo permiten responder 24 h tras el último mensaje
   del cliente → el seguimiento/nutrición ahí no funciona; Sol debe pedir pasar
   a WhatsApp temprano.
6. **Pie de entrada con el portal de documentos (ya existe):** evaluar que el
   compromiso sea "sube aquí los documentos para bloquear la tarifa" en vez de
   que Sol pida cédulas por chat (datos personales: mejor en el portal).
7. **Legal:** rangos y precios siempre "por persona", con qué incluye y "sujeto
   a fecha y disponibilidad" (Estatuto del Consumidor); urgencia solo real;
   seguimientos dentro de la Ley 2300 (ya está).
8. **Limpiar antes del modo sombra:** confirmar que el bot viejo de GHL está
   apagado (los ~114 mensajes sin registrar), apagar el workflow Stop/Active
   Bot pendiente, y cambiar las contraseñas expuestas en el chat interno.
9. **Riesgos técnicos conocidos:** límite de complejidad del esquema, precalentar
   tras desplegar, alerta si Sol falla en silencio, costo doble del modo sombra.
10. **La tabla de rangos también envejece:** fecha de actualización + aviso en
    "Salud del catálogo".
11. **Conversaciones de la dueña:** que responda desde su usuario de GHL; se
    extraen por usuario igual que en el análisis de ventas.
12. **Coordinación:** otra sesión puede estar tocando lib/agente; la borrada de
    los 180 campos en cuarentena (~16-oct) se cruza con el paso de los sol_*.

### Decisiones sobre §13 (05-oct)
- 3. Borrador de cotización: pendiente de aprobar tras la aclaración (campo
  "Borrador de cotización" en ⭐ Calificación (Sol), texto en el formato real
  "TU VIAJE SOÑADO" con los huecos que solo la asesora llena; nunca lo ve el
  cliente; sin PDF).
- 4. Portal de documentos como compromiso: **DESCARTADO** (cierre demasiado agresivo).
- 8. Bot viejo de GHL: **apagado** (confirmado por el usuario). Workflow
  Stop/Active Bot: **apagado**. Contraseñas: **fuera de este plan** (no depende del usuario).
- 9. Tabla de rangos: revisión periódica cada 6 meses (aviso en "Salud del catálogo").
- 10. Coordinación con la borrada de los 180 campos: se ve en su fecha (~16-oct).
- 3. Borrador de cotización: **APROBADO** usando la copia de la plantilla real
  "TU VIAJE SOÑADO" sacada de las ventas (no hay versión oficial guardada).
  Incluye el link de la página del producto para que la asesora lo reenvíe.

### Ficha del destino (foto + link) — confirmado en el plan
Ya existe a medias (marcador `[foto:slug]` + link `/destinos/slug`). En v2 se
vuelve una jugada de venta: **foto + link de la página + 1-2 líneas de por qué
le encaja a ESE cliente**, enviada cuando el cliente muestra interés en un
destino del catálogo (o pide fotos/más info), no en el saludo. Reglas: una ficha
por destino (no repetir salvo que la pida), máximo 2 destinos por mensaje al
comparar; destino sin foto → solo link; viaje a la medida → sin link (no hay
página). Por definir en el laboratorio: si se manda más de una foto (galería).

### Mensajes interactivos de WhatsApp (GoGHL) — evaluado 05-oct
Fuente: help.goghl.ai (botones y lista). Se envían escribiendo una sintaxis en el texto:
- Botón: `#btn|título|subtítulo|image*URL|tipo*texto*valor` — tipos `quick_reply`
  (respuesta rápida), `cta_url` (abre link), `cta_call` (llamar), `cta_copy`
  (copiar texto). Texto del botón ≤ 20-25 caracteres. Imagen o video opcional arriba.
- Lista: `#list|título|descripción|pie|textoBotón|Sección*Elemento*Descripción*id/...`

Uso propuesto:
1. **Ficha del destino = foto + botón "Ver el viaje" (cta_url a la página).** Sí.
2. **Botón "Llamar"** (cta_call) cuando el cliente prefiere hablar. Sí.
3. **Respuestas rápidas** solo para elegir entre 2-3 opciones concretas
   (destinos u hoteles, o WhatsApp / llamada / oficina). Con moderación.
4. **Copiar** (cta_copy) cuenta/llave de pago: más para la asesora en la reserva.
5. **Listas tipo menú: NO** al inicio — es justo la sensación de "bot de
   botones" que la dueña critica.

Por probar en el laboratorio (la documentación no lo dice): si funciona
enviado por la API de GHL con nuestro proveedor; cómo se ve en iPhone y
WhatsApp Web; cómo llega la respuesta del cliente cuando toca un botón (para
que Sol la entienda); y siempre mandar texto de respaldo por si el botón no
se muestra. Cuidar el riesgo de bloqueo del número no oficial (no abusar).

**Prueba real 05-oct (19:33):** ficha `#btn` de San Andrés enviada por la API de
GHL (proveedor TYPE_CUSTOM_SMS, `type: SMS` + conversationProviderId) al
WhatsApp del usuario → **funcionó perfecto en WhatsApp Web**: foto WebP arriba,
título, texto y botón "Ver el viaje" que abre la página. Registrada en
agente_mensajes_enviados. Pendiente: iPhone/Android, respuestas rápidas
(qué llega al tocar), y que Sol reconozca el `#btn|…` crudo en el historial
(así lo guarda GHL y así lo ven las asesoras).

## 14. Visibilidad y cómo se revisan las pruebas (05-oct)

- **Paso 2 (datos nuevos del panel: política de reserva, tabla de rangos,
  promociones) → SOLO rol `admin`.** Editor, lector y representante no los ven
  (roles en lib/admin/allowlist.ts). Igual para la página de pruebas de Sol.

**Página "Laboratorio de Sol" en /admin (solo admin)** — ahí se ve todo el flujo:
1. **Chat de prueba:** el admin escribe como si fuera el cliente y Sol v2
   responde en el panel (no sale nada por WhatsApp). Al lado de cada respuesta,
   lo que Sol pensó: estado comercial, señal de compra, objeción, si mandó
   ficha, si dejó borrador de cotización y el motivo.
2. **Escenarios simulados:** los 30-50 escenarios se corren con un "cliente
   simulado" (otra IA que actúa el papel: la de San Andrés con esposo, la que
   dice que está caro…) para ver la conversación COMPLETA de principio a fin,
   no solo un mensaje. Se ven como chat, con botones 👍/👎 + comentario por
   mensaje para la dueña.
3. **Modo sombra:** por cada conversación real, línea de tiempo con lo que
   escribió el cliente, lo que mandó la Sol actual y lo que HABRÍA mandado la v2
   (+ su razonamiento). Filtros por día y por "diferencias importantes".
4. **Piloto:** las conversaciones reales con la etiqueta `sol_v2` se ven en GHL
   como siempre, y además en esta página con el razonamiento.

## 15. Qué pasa con todo esto si nos quedamos con Sol v2

**Se queda (permanente):** Sol v2 como la Sol oficial; datos del panel
(política de reserva, rangos, promociones); salud del catálogo + alertas;
campos nuevos del CRM; borrador de cotización; fichas con botón; aviso
"listo para reservar"; **Laboratorio de Sol** como herramienta para probar
cualquier cambio futuro antes de publicarlo; **banco de escenarios** como
examen obligatorio de cada cambio (si algo que antes salía bien sale mal, no
se publica).

**Se apaga (temporal):** modo sombra (cuesta el doble; se reactiva solo para
probar un cambio grande); etiqueta de piloto `sol_v2` (v2 pasa a ser la de
todos).

**Se borra (después de un periodo de respaldo de 2-4 semanas):** el código de
Sol v1 (mientras tanto es el botón de regreso) y los 10 campos `sol_*` viejos
del contacto.

## 16. CAMBIO 05-oct: prueba A/B en vez de modo sombra (no duplicar costos)

Decisión del usuario: **se elimina el modo sombra** (duplicaba el costo del
modelo). Nuevo camino:
1. **Laboratorio corto** (se mantiene: es un gasto único y chico, no mensual) —
   chat de prueba + banco de escenarios para atrapar errores graves antes de
   tocar clientes.
2. **A/B en producción:** cada lead NUEVO se asigna a v1 o v2 (empezar con
   ~20 % a v2 y subir a 50 % si va bien). La asignación se fija al primer
   mensaje y no cambia (etiqueta `sol_v2`), así ningún cliente salta de una
   Sol a otra; las conversaciones que ya están en curso siguen con v1.
   **Cada mensaje lo responde UNA sola Sol → costo igual al de hoy.**
3. **Monitoreo diario** en el Laboratorio (las conversaciones v2 con su
   razonamiento) y ajustes sobre la marcha; comparación por grupo: % que llega
   a "listo para reservar", ventas, quejas, repreguntas.
4. **Botón de regreso** intacto: v2 → 0 % al instante si algo sale mal.

## 17. HOJA DE RUTA FINAL (05-oct, manda sobre las fases anteriores)

0. Medir el "antes" (solo lectura).
1. Catálogo a prueba de errores (bloqueo sin precio, Salud del catálogo, alerta semanal WhatsApp a Fabrizio y Ginna).
2. Datos nuevos en el panel, solo admin (política de reserva 20 %, tabla de rangos, promociones con fecha límite).
3. CRM: campos nuevos en la oportunidad + mover sol_* (idioma se queda en contacto); borrar los viejos al final.
4. Construir Sol v2 al lado de v1 (sin activarla).
5. Laboratorio de Sol (solo admin): chat de prueba + banco de escenarios. Revisión con la dueña.
6. A/B en producción: 20 % de leads nuevos → v2, monitoreo diario, subir a 50 %.
7. Aviso "listo para reservar" a la asesora + segundo aviso a los 30 min.
8. Decidir: v2 al 100 %, v1 de respaldo 2-4 semanas y luego se borra.

## 18. ESTADO DE EJECUCIÓN (05/06-oct-2026) — pasos 0 a 5 construidos

- **Paso 0** ✓ docs/linea-base-sol-2026-10.md (mediana 18,3 h de respuesta tras Sol; 30 % sin respuesta humana; conversión jul 16 %, ago 23 %).
- **Paso 1** ✓ código: migración 030 (a_la_medida, precio_actualizado_en, trigger candado), validación del formulario (sin precio / precio raro + "Confirmo este precio"), /admin/catalogo, lib/catalogo/salud.ts, cron lunes 13:00 UTC /api/catalogo/salud → WhatsApp a Fabrizio y Ginna (lib/agente/alertas.ts). ⚠️ Migración 030 SIN aplicar: se aplica junto con el deploy.
- **Paso 2** ✓ migración 031 APLICADA (sol_politica_reserva 20 %, sol_rangos con la tabla §7, sol_promociones) + /admin/sol (solo admin).
- **Paso 3** ✓ 17 campos de oportunidad creados en ⭐ Calificación (Sol) (scripts/ghl-campos-sol-v2.mjs); valores sol_* copiados a 373 oportunidades abiertas de Leads (0 errores; respaldo .respaldos-ghl/sol_contacto_2026-10-06.json, 513 contactos); crm.ts ya escribe en la oportunidad (idioma sigue en contacto). Pendiente: revisar en GHL que ningún workflow/lista use los sol_* del contacto → recién ahí borrarlos.
- **Paso 4** ✓ lib/agente/v2/ (prompt por capas, decidir, ficha #btn, borrador). NO conectada al webhook (se conecta en el paso 6).
- **Paso 5** ✓ migración 032 APLICADA + /admin/sol/laboratorio (chat de prueba, 17 escenarios base cargados, cliente simulado con Haiku 4.5, 👍/👎). Probados 9 escenarios (~US$0,03-0,15 c/u); ajustes hechos: no sub-rangos, revisar fechas vs hoy antes del anticipo, no decir que un presupuesto bajo "alcanza", borrador solo en listo_para_reservar.
- Pendiente para salir: aplicar migración 030 + publicar (push a main).
