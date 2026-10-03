# Idea — Portal seguro de documentos de viajeros

> Propuesta del 2026-10-02. Estado: **plan, sin implementar**. Pendiente de las
> decisiones de la sección final.

## Problema
Al cerrar una venta hay que pedir pasaportes, visas o cédulas de todos los viajeros.
Hoy llegan como fotos por WhatsApp: quedan regadas en el chat, alguien las transcribe a
mano a los campos P1…P8 de la oportunidad y no hay control de quién las ve ni de cuándo
se borran (son **datos sensibles** bajo la Ley 1581).

## La idea en una frase
Un enlace personal por **viaje** (oportunidad) que lleva al cliente a una página de la
agencia donde sube los documentos de cada viajero; el sistema lee los datos del
documento, el cliente los confirma y quedan escritos en la tarjeta.

## Decisiones de diseño (recomendadas)

1. **Va ligado a la oportunidad, no al contacto.** Los datos de viajeros (P1–P8: nombre,
   documento, pasaporte, vencimiento, nacimiento) ya viven en la oportunidad; un cliente
   con dos viajes tiene dos juegos de documentos. El contacto solo se usa para enviarle
   el enlace.
2. **El enlace no expone ningún ID.** `travelworldcolombia.com/documentos/<token>`, donde
   el token es aleatorio (o firmado con HMAC) y guardado en Supabase con: oportunidad,
   requisitos, vencimiento (p. ej. 14 días) y estado. Se puede revocar y regenerar.
   Opcional: pedir los últimos 4 dígitos del celular antes de mostrar el formulario.
3. **Los archivos NO van a GHL ni a un bucket público.** Bucket **privado** nuevo en
   Supabase (`documentos-viajeros`; los actuales `destinos` y `documentos` son públicos),
   cifrado en reposo, sin URL pública: solo el servidor sube, y el equipo los ve desde
   el panel con URLs firmadas de 5 minutos y registro en el audit log existente.
   En GHL queda el **dato extraído** (campos P1–P8) y el **estado**, no la imagen.
4. **Retención automática:** los archivos se borran X días después de la fecha de regreso
   (cron). Los datos en los campos se quedan (los necesita el contrato/TMS).
5. **Consentimiento:** casilla obligatoria con el aviso de datos sensibles y enlace a la
   política, antes de subir. Queda registrado (fecha, IP).

## Qué ve el cliente
1. Portada con marca TWC, candado, "tus documentos viajan cifrados y solo los ve tu
   asesora", nombre del viaje y fecha de salida (sin más datos personales).
2. Una tarjeta por viajero (cantidad = la de la oportunidad). En cada una, solo los
   documentos que este viaje pide: 🛂 pasaporte · 🪪 cédula/TI · 📄 visa.
3. Sube la foto (cámara del celular o archivo) → en segundos ve los datos leídos
   (nombre, número, nacimiento, vencimiento) → **confirma o corrige** → listo.
4. Barra de progreso "3 de 5 viajeros completos"; puede volver con el mismo enlace.
5. Avisos útiles: "tu pasaporte vence antes de 6 meses después del regreso".

## De dónde salen los requisitos (dinámico)
- **Número de viajeros:** "Total pasajeros - Cantidad" (o adultos + niños) de la oportunidad;
  si ya hay nombres en P1–P8 se muestran precargados.
- **Qué documentos:** la asesora los marca en una pestaña nueva **"Documentos"** del
  Generador de Contratos (pasaporte / visa / identificación, por viaje), con valores
  sugeridos: internacional → pasaporte; destinos que piden visa a colombianos → visa;
  nacional → cédula/TI. La regla de visas por país vive en una tabla editable del panel
  (no se adivina).
- Máximo 8 viajeros (los campos P1–P8 que ya existen).

## Lectura automática de los documentos
- **Pasaporte:** la franja MRZ (las 2 líneas `P<COL…`) se lee de forma determinística
  (dígitos de control incluidos) → nombre, número, nacionalidad, nacimiento, sexo,
  vencimiento. Muy confiable.
- **Cédula, tarjeta de identidad y visa:** Claude (visión) con salida estructurada.
- **Siempre con confirmación del cliente** antes de escribir; si la confianza es baja,
  se marca para revisión de la asesora.
- Se escribe en los campos existentes de la oportunidad: `P{n} - Nombre y Apellido`,
  `P{n} - Documento`, `P{n} - Pasaporte`, `P{n} - Fecha de Nacimiento`,
  `P{n} - Vencimiento Pasaporte`. Para visa harían falta 2 campos nuevos por viajero
  (número, vencimiento) o un campo de texto resumen.
- Costo estimado: ~1-2 centavos de dólar por documento.

## Cómo se dispara (un solo responsable por paso)
1. Venta ganada → la tarjeta llega a 🗂️ Reservaciones (C-01, ya existe).
2. La asesora abre el Generador → pestaña **Documentos** → marca requisitos → botón
   **"Enviar enlace de documentos"**. El servidor crea el token, guarda el enlace en un
   campo nuevo de la oportunidad (`Link de documentos`) y cambia `Solicitar documentos`
   a "Enviar" (mismo patrón que ENVIAR CONTRATO?).
3. Workflow nuevo **C-05 · Solicitar documentos → mensaje con el enlace**: WhatsApp +
   correo con `{{opportunity.link_de_documentos}}`. El texto lo edita el equipo en GHL.
4. Cuando el cliente termina: campo `Documentos del cliente` = Completos → workflow
   avisa a la asesora (tarea "Revisar documentos").
5. Si faltan documentos, V-03 (15 días) y V-04 (7 días) pueden recordárselo.

## Fases
| Fase | Qué | Resultado |
|---|---|---|
| 1 | Bucket privado + tabla de solicitudes/tokens + página de carga + vista en el panel + C-05 | Ya no llegan documentos por WhatsApp |
| 2 | Lectura MRZ + visión + confirmación + escritura en P1–P8 | Nadie transcribe a mano |
| 3 | Reglas de visa por país, recordatorios de faltantes, alertas de vencimiento, borrado automático | Control y cumplimiento |

## Prueba: ¿guardar los archivos en campos de archivo de GHL? (02-oct)
Se subió una imagen falsa por API (`POST /forms/upload-custom-files`) a un campo FILE_UPLOAD del
contacto de prueba. Resultado:
- GHL guarda un enlace permanente `backend.leadconnectorhq.com/contacts/file/download?id=…` que
  **descarga el archivo SIN iniciar sesión** (redirige a Google Storage con firma de 10 min, pero el
  enlace de GHL genera una firma nueva cada vez).
- Al **vaciar el campo**, el enlace viejo **sigue descargando** el archivo: no se puede revocar ni
  borrar el archivo desde la API.
- Conclusión: para pasaportes NO se usan los campos de archivo de GHL. Archivos en bucket privado
  propio (con borrado real); en GHL solo los datos extraídos + un enlace al panel (que pide sesión).
- La imagen de prueba (171 bytes, gris, sin datos) quedó huérfana en el almacenamiento de GHL.

## Decisiones del usuario (02-oct)
- Archivos: bucket privado propio (los campos de archivo de GHL quedaron descartados por la prueba).
- Retención: **30 días** después de la fecha de regreso, luego se borran las fotos (los datos quedan).
- Visa: **2 campos nuevos por viajero** en la oportunidad: `P{n} - Visa Número` y `P{n} - Visa Vencimiento` (16).
- Viajes nacionales: **solo cédula** por ahora (→ `P{n} - Documento`).
- Pasaporte: usa los campos que ya existen (`P{n} - Nombre y Apellido`, `P{n} - Pasaporte`,
  `P{n} - Fecha de Nacimiento`, `P{n} - Vencimiento Pasaporte`); la foto va al bucket privado.
- Verificación extra (últimos 4 del celular): la escribe el CLIENTE al abrir el enlace — pendiente de confirmar si se activa.
