# Auditoría de seguridad — Portal de documentos de viajeros

> 2026-10-03 · Alcance: `lib/documentos/*`, `app/documentos/[token]/*`, pestaña Documentos del Generador
> (`app/admin/reservas/[id]/DocumentosTab.tsx`, `documentos-actions.ts`), `/admin/documentos`, `/api/documentos/purga`,
> migración 026 (bucket `documentos-viajeros`, tablas `doc_*`). Revisión de código + pruebas en vivo contra Supabase.
> Estado: **#2 y #8 corregidos el mismo día** (código de un solo uso, migración 027). **#1 aceptado por el usuario** (textos se
> dejan como están por ahora). El resto, pendiente.

## Resumen
Sin hallazgos críticos: nadie sin el enlace puede llegar a los documentos, y la llave pública de Supabase no lee ni
las tablas ni el bucket (probado). Los dos puntos altos son de **promesa vs. realidad** (textos de seguridad que
prometen más de lo que el sistema hace) y de **fuerza bruta de los 4 dígitos** para quien ya tenga el enlace.

| # | Severidad | Hallazgo |
|---|---|---|
| 1 | Alta | Textos de seguridad engañosos ("cifrado de extremo a extremo", "nadie más puede verlas") — **riesgo aceptado por el usuario (03-oct)** |
| 2 | Alta | Los 4 dígitos se pueden adivinar en la vida del enlace (~72 % de probabilidad) — **✅ corregido** |
| 3 | Media | Lectura con IA sin límite de llamadas ni de páginas (abuso de costo) |
| 4 | Media | Los datos extraídos (pasaporte, nacimiento, IP) no se purgan nunca de Supabase |
| 5 | Media | El consentimiento no menciona que un proveedor externo (Anthropic) procesa las imágenes |
| 6 | Media | Cualquier usuario del Generador ve los documentos de cualquier viaje |
| 7 | Baja | El límite por IP depende de Upstash; sin él es por instancia |
| 8 | Baja | El segundo factor (últimos 4 del celular) lo conoce todo el equipo y quien tenga el chat — **✅ corregido** |
| 9 | Baja | El cliente puede sobrescribir P{n} sin revisión; texto `{{…}}` llegaría al contrato |
| 10 | Baja | La fecha de regreso se congela al crear el enlace (purga temprana o tardía) |
| 11 | Baja | La firma de la cookie deriva de la service-role key |
| 12 | Info | El pasaporte real del usuario quedó en el bucket de pruebas |

## Hallazgos

### 1. Textos de seguridad engañosos — Alta
- La intro dice «Cifrado de extremo a extremo · Solo lo ve tu asesora» (`IntroSeguro.tsx:98`); la garantía dice
  «Nadie más puede verlas» (`Verificacion.tsx:169`); el pie dice «solo los ve tu asesora» (`app/documentos/layout.tsx:37`).
- Realidad: hay cifrado en tránsito (TLS) y en reposo (Supabase), pero **no** de extremo a extremo: el servidor abre la
  imagen, Anthropic la procesa para leerla, y cualquier usuario del panel con acceso al Generador (admin, editor,
  representante) puede verla (ver #6).
- Riesgo: Ley 1581 (principios de veracidad y transparencia) y Estatuto del Consumidor (información engañosa). Si hay un
  incidente, el texto agrava la responsabilidad.
- Corrección: cambiar a «Conexión cifrada · Solo el equipo de tu reserva puede verlas · Cada vista queda registrada», o
  bien hacer verdad la promesa restringiendo el acceso a la asesora asignada (#6).

### 2. Fuerza bruta de los 4 dígitos — Alta
- `verificarDigitos` (`lib/documentos/solicitudes.ts:366`): tras 5 fallos bloquea 30 min y **reinicia el contador**.
  Eso da 240 intentos por día y ~7.200 en los 30 días del enlace frente a 10.000 combinaciones: quien tenga el enlace
  acierta con ~72 % de probabilidad, y en promedio en ~21 días.
- Además la cuenta no es atómica (lee `intentos_fallidos` y luego escribe): varias peticiones en paralelo cuentan como
  una, así que una ráfaga multiplica los intentos por ventana.
- Mitigantes reales: el token tiene 192 bits (el enlace no se adivina) y hay un límite de 15 intentos/10 min por IP.
- Corrección: tope total de fallos (p. ej. 10 en la vida del enlace → enlace revocado + aviso a la asesora), contador
  atómico en SQL (`update … set intentos = intentos + 1 … returning`), y bloqueo progresivo.

### 3. Lectura con IA sin límite — Media
- `procesar` (`app/documentos/[token]/actions.ts:148`) no tiene límite y vuelve a leer el mismo archivo cada vez que se
  llama. El bucket acepta PDF de hasta 10 MB, que la API lee página por página con `claude-opus-5-5`.
- Quien tenga acceso a un enlace puede generar costo de forma repetida (decenas de centavos a dólares por llamada con
  un PDF largo).
- Corrección: leer cada archivo una sola vez (si ya tiene `datos_extraidos`, devolverlo), límite por solicitud
  (p. ej. 20 lecturas/hora), y solo imágenes o solo la primera página del PDF.

### 4. Los datos extraídos no se purgan — Media
- La purga (`lib/documentos/purga.ts`) borra las fotos y marca `borrado_en`, pero deja en Supabase `datos_extraidos`,
  `datos_confirmados` (número de pasaporte, cédula, nacimiento, vencimiento), `nombres`, `ip`, `consentimiento_ip` y
  `consentimiento_ua` para siempre. El panel ya no los muestra, pero existen.
- Esos datos ya viven en GHL (la fuente de verdad), así que la copia en Supabase no aporta y contradice la minimización.
- Corrección: en la purga, poner en `null` esos campos (conservar solo fechas y el hecho del consentimiento).

### 5. Consentimiento sin mención del procesador externo — Media
- El texto de «Antes de empezar» (`Portal.tsx`) dice que los documentos se usan para la reserva y se guardan cifrados,
  pero no informa que la imagen la procesa un proveedor de IA fuera de Colombia (transmisión a un encargado, Ley 1581 y
  Decreto 1377).
- Corrección: añadir una frase: «Para leer los datos automáticamente, la imagen la procesa nuestro proveedor tecnológico
  (Anthropic, EE. UU.) como encargado, sin usarla para otros fines.» y reflejarlo en `/privacidad`.

### 6. Acceso del panel sin restricción por asesora — Media
- `documentos-actions.ts` solo exige `requireReservas()`: cualquier admin, editor o representante puede ver (URL firmada)
  los documentos de cualquier oportunidad si tiene su id. Queda registrado en la bitácora (`ver-documento`), lo cual es
  bueno, pero no lo impide. Es el mismo modelo del resto del Generador.
- Corrección (decisión de negocio): limitar `verDocumento` al usuario asignado al contacto + admins, o aceptar el modelo y
  corregir los textos (#1).

### 7. Límite por IP sin Upstash — Baja
- `checkRateLimit` usa Upstash si existen sus variables; si no, un contador en memoria por instancia (poco fiable en
  Vercel). No están en `.env.local`; no se pudo verificar Vercel (CLI no instalada).
- Corrección: confirmar `UPSTASH_REDIS_REST_URL/TOKEN` en Vercel o instalar la integración.

### 8. Segundo factor débil por diseño — Baja
- Los últimos 4 dígitos los ve todo el equipo en GHL y los conoce cualquiera con quien el cliente hable por WhatsApp.
  Protege contra un enlace reenviado a un desconocido, no contra alguien cercano.
- Aceptable para el riesgo; documentado. Opción futura: código de un solo uso por WhatsApp.

### 9. El cliente sobrescribe P{n} sin revisión — Baja
- `confirmarArchivo` escribe directo en la oportunidad (es el diseño). Un cliente podría cambiar el nombre que la asesora
  ya tenía, o escribir texto con `{{ }}` que luego aparece en el contrato.
- Corrección: quitar `{` y `}` en `sanearDatos`; y si P{n} ya tenía un valor distinto, marcar `revision_requerida` en vez
  de pisarlo en silencio (o dejar nota en el contacto).

### 10. Fecha de regreso congelada — Baja
- `fecha_regreso` se copia de GHL al crear el enlace. Si el viaje cambia de fecha, la purga se calcula con la vieja.
- Corrección: releer la fecha de GHL en la purga, o actualizarla al «Enviar al cliente».

### 11. Firma de la cookie derivada de la service-role key — Baja
- `lib/documentos/token.ts` deriva la llave HMAC de `SUPABASE_SERVICE_ROLE_KEY`. Es seguro hoy, pero acopla dos
  secretos: rotar uno invalida el otro uso.
- Corrección: variable propia `DOCUMENTOS_COOKIE_SECRET`.

### 12. Pasaporte real en el bucket de pruebas — Info
- Solicitud `c38b8926…` (oportunidad de prueba). Borrar cuando termine la prueba.

## Corrección aplicada (03-oct) — #2 y #8
El acceso ya no usa los últimos 4 dígitos: el cliente pide un **código de 6 dígitos** que llega a su WhatsApp (por la
misma vía de Sol, registrado en `agente_mensajes_enviados`) o a su correo (`lib/documentos/codigo.ts`, migración 027).
- Aleatorio (`crypto.randomInt`); en la base solo su HMAC ligado a la solicitud. Vence en 10 min, un solo uso (consumo
  atómico con un `UPDATE` condicionado), 5 intentos por código.
- Envíos: 1 por minuto y 5 por hora por enlace (función SQL `doc_reservar_envio_otp`, atómica) + 10 por hora por IP.
- Tope de **10 fallos en la vida del enlace** (función `doc_fallo_otp`, atómica): el enlace se desactiva, se limpia
  el campo de GHL y queda una nota en el contacto para la asesora.
- Nunca se envía solo al abrir la página (las vistas previas de WhatsApp abren enlaces); el cliente lo pide.
- Las funciones solo las ejecuta `service_role` (la llave pública recibe 42501).
- Probado: 12 casos contra la base real (correcto, incorrecto, reuso, formato, 1/minuto, 5 por código, tope de 10 con
  solicitud temporal, permisos) y de punta a punta con WhatsApp real al contacto de prueba.
- Probabilidad de acierto por fuerza bruta: 5 intentos sobre 1.000.000 por código, y como máximo 10 en total por enlace
  → 0,001 %.

## Lo que está bien (verificado)
- **Bucket privado**: sin políticas en `storage.objects` para `documentos-viajeros`; listar con la llave pública
  devuelve `[]` y la URL pública da 400 (probado en vivo).
- **Tablas `doc_*`**: RLS activo sin políticas; la llave pública recibe `[]` en las tres (probado en vivo).
- **Token**: 192 bits aleatorios, en la base solo su SHA-256; regex estricta antes de consultar.
- **Cookie de acceso**: HMAC, `httpOnly`, `secure`, `SameSite=Lax`, limitada a la ruta del enlace, 12 h.
- **Cada acción del portal** revalida token + cookie; viajero y tipo se acotan en el servidor; la ruta del archivo la
  elige el servidor (UUID); tamaño y tipo los impone el bucket.
- **Vista en el panel**: URL firmada de 5 minutos y registro `ver-documento` en la bitácora.
- **Sin XSS**: todo texto (incluidas las observaciones de la IA) se renderiza como texto por React.
- **Sin fugas por analítica**: GTM/píxel no cargan en `/documentos`; `noindex` + `robots.txt`.
- **Cron de purga**: 401 sin secreto (probado en producción).
- **GHL**: solo recibe datos y estado; nunca la imagen.

## Orden sugerido de corrección
1. #1 textos (minutos) y #5 consentimiento.
2. #2 tope total de intentos + contador atómico.
3. #3 lectura una sola vez + límite.
4. #4 purga de datos extraídos.
5. #6 decisión de acceso; #9–#11 cuando se toque el módulo.
