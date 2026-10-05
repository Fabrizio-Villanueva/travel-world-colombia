# Idea — Portal seguro de documentos de viajeros

> Propuesta del 2026-10-02. Estado: **IMPLEMENTADO (Fases 1, 2 y 3) el 2026-10-03** — ver "Estado de implementación" al final.
> Falta armar en GHL el workflow C-05 (instrucciones en docs/handoff-ghl-reestructura.md).

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
- Verificación extra: **ACTIVADA** (03-oct reemplazada por código de 6 dígitos por WhatsApp/correo; la idea original era: el CLIENTE escribe los últimos 4 dígitos del celular del contacto al abrir el
  enlace; varios intentos fallidos bloquean el enlace un rato.
- ✅ Plan de la Fase 1 completo: listo para implementar en una sesión nueva.

## Estado de implementación (2026-10-03)

**Hecho y publicado** (migración 026 ✓ en prod; 19 campos de oportunidad creados en GHL, carpeta 👥 Pasajeros):

| Pieza | Dónde |
|---|---|
| Bucket privado `documentos-viajeros` (10 MB, imágenes/PDF, sin políticas: solo service-role) | migración 026 |
| Tablas `doc_solicitudes` (token hasheado, requisitos, viajeros, consentimiento, bloqueo), `doc_archivos`, `doc_reglas_visa` | migración 026 |
| Página pública `/documentos/<token>`: acceso con **código de 6 dígitos por WhatsApp o correo** (desde 03-oct, migración 027; antes últimos 4 dígitos del celular), tope de 10 fallos por enlace, cookie de acceso firmada (12 h), consentimiento Ley 1581 (fecha/IP/navegador), una tarjeta por viajero, subida directa al bucket con URL firmada, lectura automática, confirmación y progreso | `app/documentos/`, `lib/documentos/` |
| Lectura: MRZ determinística (TD3 pasaporte y MRV-A visa, dígitos de control ICAO 9303) + visión Claude (`claude-opus-5-5`, salida JSON) para cédula/TI y respaldo | `lib/documentos/mrz.ts`, `lib/documentos/lectura.ts` |
| Escritura en P{n}: Nombre y Apellido, Documento, Pasaporte, Fecha de Nacimiento, Vencimiento Pasaporte, Visa Número, Visa Vencimiento (campos resueltos por nombre) | `lib/documentos/ghl-pasajeros.ts` |
| Estado en GHL: `Documentos del cliente` (Solicitados/Parciales/Completos) + nota en el contacto al completar | `lib/documentos/solicitudes.ts` |
| Generador de Contratos → pestaña **Documentos**: requisitos sugeridos por destino, viajeros, "Enviar enlace" (escribe `Link de documentos` y dispara `Solicitar documentos` = Enviar/Reenviar para C-05), reenviar (token nuevo), desactivar, ver documentos con URL firmada de 5 min (audit log `ver-documento`), reintentar escritura en GHL | `app/admin/reservas/[id]/DocumentosTab.tsx` |
| Panel `/admin/documentos` (lista de enlaces y progreso) y `/admin/documentos/visas` (reglas de visa por país, editables; semilla de 33 países) | `app/admin/documentos/` |
| Aviso de pasaporte que vence antes de 6 meses tras el regreso (y visa vencida antes del regreso) | `calcularAvisos` |
| Cron diario `/api/documentos/purga` (09:00 UTC): borra las fotos 30 días después del regreso (180 días desde la creación si no hay regreso) | `vercel.json`, `lib/documentos/purga.ts` |

**Probado el 03-oct** con la oportunidad de prueba `NnDUr5gyZfnGI4LWGHWl` (contacto Fabrizio): enlace → verificación (dígitos malos y buenos) → consentimiento → pasaporte (MRZ válida, alta), cédula (visión, alta) y visa (MRZ, alta) sintéticos → P1 escrito en GHL → `Documentos del cliente = Completos` → nota en el contacto. Parser MRZ probado con líneas recortadas, espacios, O/0 y controles dañados.

**Pendiente**
- Armar en GHL el workflow **C-05** (no se puede por API): disparador = campo de oportunidad `Solicitar documentos` cambia a Enviar o Reenviar → WhatsApp + correo con `{{opportunity.link_de_documentos}}`; y un aviso interno/tarea cuando `Documentos del cliente` cambie a Completos. Pasos exactos en el traspaso.
- Revisar la semilla de reglas de visa en `/admin/documentos/visas` (el equipo las conoce mejor que nadie).
- Opcional: recordatorio de documentos faltantes en V-03/V-04 (condición `Documentos del cliente` ≠ Completos).

## v2 (2026-10-05)
Tipos de viajero (adulto/menor/infante), cédula y TI por los dos lados (MRZ TD1 del reverso), registro civil para
infantes (nacional) y menores/infantes (internacional), y enlace `P{n} - Documentos (panel)` en la oportunidad (las fotos
NO se copian a GHL). Migración 029 ✓. Detalle en `docs/handoff-portal-documentos-v2.md`.
