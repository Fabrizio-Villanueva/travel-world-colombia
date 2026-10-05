# Traspaso — Portal de documentos v2 (tipos de viajero, dos caras, imágenes en el CRM)

## ✅ ESTADO 05-oct (tarde): v2 IMPLEMENTADA Y PUBLICADA
Decisiones del usuario (respuestas a la sección 3):
- **A/B — imágenes en el CRM:** NO se suben archivos a GHL. En la OPORTUNIDAD quedan 8 campos TEXT
  **`P1…P8 - Documentos (panel)`** (carpeta 👥 Pasajeros, creados por API con
  `scripts/ghl-crear-campos-documentos-panel.mjs`; NO están en el catálogo del Generador a propósito) con el enlace
  `https://travelworldcolombia.com/admin/reservas/<opp>/documentos/<n>`. Esa página pide sesión del equipo (admin, editor o
  **representante**: las 6 asesoras), firma las fotos por 5 min, registra `ver-documento` (origen `enlace-crm`) en la bitácora
  y muestra frente/reverso + datos + avisos. Sin sesión → `/admin/login?next=…` y vuelve al documento tras entrar
  (`destinoSeguro` en `app/admin/actions.ts` solo acepta rutas `/admin/…`). /privacidad no cambia (las fotos siguen solo en
  el bucket privado y se borran a 30 días). Los 10 FILE_UPLOAD en cuarentena NO se tocaron.
- **D — menores internacionales:** solo **registro civil** (sin permiso de salida).
- **Tipo de viajero:** lo marca la asesora (selector Adulto/Menor/Infante por viajero en la pestaña Documentos),
  prellenado desde la liquidación (`Valor Niño - Cantidad` / `Cantidad de niños` y `Valor Infante - Cantidad`: los
  últimos viajeros son infantes, luego menores). Si la fecha de nacimiento leída no cuadra, aviso al cliente y a la asesora.

Reglas (`documentosDe` en `lib/documentos/config.ts`):
| Viaje marca | Adulto (18+) | Menor (7–17) | Infante (0–6) |
|---|---|---|---|
| Cédula (nacional) | Cédula de ciudadanía, frente + reverso | Tarjeta de identidad, frente + reverso | Registro civil (1 foto) |
| Pasaporte (internacional) | Pasaporte (página de datos) | Pasaporte + registro civil | Pasaporte + registro civil |
| Visa | Visa (1 foto) | Visa | Visa |

Técnico:
- **Migración 029 ✓ en prod**: `doc_solicitudes.viajeros_tipo jsonb`, `doc_archivos.cara` (frente/reverso/unica), tipo
  `registro_civil`, único `(solicitud_id, viajero, tipo, cara)`. Filas viejas = `unica` (cuentan como documento completo).
- La lectura y la confirmación viven en la **cara principal** (frente/única); el reverso solo guarda la imagen. Subir de
  nuevo una cara borra la lectura del documento. "Otra foto" borra todas las caras. Progreso = documentos (no caras),
  `calcularProgreso` compartido por servidor, panel y portal.
- Lectura: frente + reverso en UNA llamada (cuenta una sola vez en el cupo de la migración 028). Cédula/TI digital:
  **MRZ TD1** del reverso (`parsearMrzTd1`, probado con el ejemplo ICAO) → nombres y nacimiento verificados; el número
  impreso (NUIP) se coteja con la franja (alta si aparece, media si no). Registro civil: visión (NUIP, nombres,
  nacimiento, sexo) → `P{n} - Nombre y Apellido`, `Documento`, `Fecha de Nacimiento`.
- Portal: casilla de dos pasos ("Foto del frente" → "Ahora, foto del reverso") con silueta del lado; botón "Leer los
  datos" si las caras están pero falta la lectura (cliente que vuelve o lectura caída).

Probado el 05-oct (local, solicitud TEMPORAL en la opp de prueba con V2 adulto / V3 menor / V4 infante, nacional; ya
borrada junto con sus fotos, y P2–P4 vaciados): cédula y TI leídas por MRZ TD1 con confianza alta, registro civil por
visión, escritura en P2–P4 + `Documentos (panel)`, estado `Parciales` (C-06 no se disparó). Visor y pestaña revisados en
captura; sin sesión redirige al login con `?next=`. **Efecto colateral:** `Documentos del cliente` de la opp de prueba
quedó en **Parciales** (antes Completos); no se volvió a poner Completos para no disparar C-06 (SMS a Luisa).
Una lectura falló en local por `SELF_SIGNED_CERT_IN_CHAIN` (red de este PC), no por código; el reintento funcionó.

Pendiente / ideas:
- Probar en producción con el celular (cédula real por los dos lados) desde la opp de prueba.
- Opcional: campo `P{n} - Tipo de documento` (CC/TI/RC/PA) en GHL; hoy el tipo solo vive en Supabase.
- Opcional: en GHL, mostrar los `P{n} - Documentos (panel)` en la vista de la tarjeta (son enlaces clicables de texto).
- La capacitación (sección 5) sigue pendiente; las 9 opps de capacitación ya verán el selector de tipo.

---

## (Contexto original del traspaso, previo a la implementación)

> Preparado el 2026-10-05 al cierre de sesión. Lee también: `docs/idea-portal-documentos.md` (diseño y estado v1),
> `docs/auditoria-seguridad-portal-documentos-2026-10-03.md` (auditoría y decisiones aceptadas) y la sección
> "Portal de documentos" de `docs/handoff-ghl-reestructura.md` (campos GHL, C-05/C-06, capacitación).
> Subcuenta TWC `RMFUo0i4KOVl7eZHEn7s`; API con `GHL_TWC_PIT` de `.env.local`. Supabase `xedqgagkrtfcbenyimkg`.
> ⚠️ `app/admin/reservas/actions.ts` tiene WIP de otra sesión: NO `git add -A`; stagear solo lo propio.

## 1. Estado actual (v1, en producción)
- `/documentos/<token>`: intro (logo → candado → cortina), acceso con **código de 6 dígitos** por WhatsApp/correo
  (`lib/documentos/codigo.ts`, migr. 027), consentimiento Ley 1581, una tarjeta por viajero (máx. 8 = P1–P8), una casilla
  por documento (pasaporte / cédula / visa), subida directa al bucket privado `documentos-viajeros` con URL firmada,
  pantalla de análisis cifrado, lectura (MRZ TD3/MRV-A determinística + Claude visión, `lib/documentos/lectura.ts`),
  confirmación, escritura en P{n} de la oportunidad, pantalla final del avión (`Gracias.tsx`).
- Tope de lecturas IA por enlace (migr. 028), purga de fotos 30 días tras el regreso (cron `/api/documentos/purga`).
- Panel: pestaña 13 "Documentos" del Generador (`app/admin/reservas/[id]/DocumentosTab.tsx`), `/admin/documentos`,
  `/admin/documentos/visas`.
- GHL: C-05 (Solicitar documentos → WhatsApp + correo con el enlace) y C-06 (Documentos del cliente = Completos →
  tarea + aviso) **armados y probados por el usuario**.
- Modelo de datos: `doc_archivos` tiene UNA fila por `(solicitud_id, viajero, tipo)` (constraint único). Tipos:
  `pasaporte | cedula | visa`. La cédula hoy es UNA foto (frente).

## 2. Lo que pidió el usuario (05-oct)
1. **Tipos de viajero: infantes, menores y adultos.**
2. **Documentos de menores y adultos requieren foto de los DOS lados** (frente y reverso).
3. **Alojar las imágenes capturadas en el CRM**: crear **campos de contacto** para eso.

## 3. Decisiones que hay que confirmar con el usuario ANTES de construir
Estas cambian el diseño; preguntarlas al inicio (AskUserQuestion) con la recomendación:

**A. Imágenes en GHL vs. lo ya decidido (CRÍTICO).** El 02-oct se probó (`docs/idea-portal-documentos.md`, sección
"Prueba: ¿guardar los archivos en campos de archivo de GHL?"): el enlace de un campo FILE_UPLOAD de GHL **descarga el
archivo sin iniciar sesión** y **no se puede revocar ni borrar** por API (vaciar el campo no borra el archivo). Por eso
v1 guarda las fotos solo en el bucket privado y la auditoría/privacidad prometen almacenamiento privado y borrado a 30 días
(`app/privacidad/page.tsx`, sección "Documentos de viaje"). Subir a GHL contradice ambas cosas. Opciones:
- (a) **Recomendada**: en GHL guardar un **enlace al panel** por documento (requiere sesión, URL firmada de 5 min, queda
  en bitácora) en vez del archivo. El equipo lo abre desde la tarjeta/contacto sin descargar nada público.
- (b) Subir el archivo a campos FILE_UPLOAD (lo pedido literal). Si se elige: actualizar `/privacidad` (copia en el CRM,
  sin borrado automático), quitar de la purga la promesa de borrado para esa copia, y anotar el riesgo en la auditoría.
- (c) Ambos: archivo en GHL solo cuando la asesora lo pida (botón "Copiar al CRM") — explícito y auditado.

**B. ¿Contacto u oportunidad?** GHL **solo tiene FILE_UPLOAD en contacto** (verificado por API 05-oct: 10 campos
`contact:FILE_UPLOAD`, 0 de oportunidad). Pero los viajeros P1–P8 son de la OPORTUNIDAD (regla "contacto = la persona,
oportunidad = el viaje"): un cliente con dos viajes pisaría las fotos del viaje anterior, y los acompañantes (P2–P8) no
son ese contacto. Si se elige (b): campos de contacto por posición (P1…P8 × documento × cara) aceptando esa limitación,
o crear un contacto por acompañante (mucho más complejo). Con (a) el enlace puede ir en campos TEXT de la oportunidad.

**C. Campos de archivo viejos en cuarentena.** Los 10 FILE_UPLOAD existentes ("Pasajero 1 Pasaporte", "Pasaporte -
Pasajero 1", …) están en la carpeta de contacto **"🗄️ Por eliminar (migrados a oportunidad)"** (`8QoctQg2QrsSGx5vVNwv`),
cuyo borrado el usuario planea **~16-oct**. No reutilizarlos sin decidirlo; si se crean nuevos, ponerlos en otra carpeta.

**D. Reglas de tipo de viajero (Colombia):** propuesta —
- **Adulto (18+)**: cédula de ciudadanía (frente + reverso) para nacionales; pasaporte para internacionales.
- **Menor (7–17)**: tarjeta de identidad (frente + reverso); pasaporte si es internacional.
- **Infante (0–6)**: **registro civil de nacimiento** (una página; no tiene reverso útil); pasaporte si es internacional.
- Internacional con menores: ¿pedir también **registro civil** (prueba de parentesco) y **permiso de salida del país**
  (si no viaja con ambos padres)? Confirmar con el usuario; serían tipos de documento nuevos.
- ¿Cómo se sabe el tipo? Opciones: la asesora lo marca por viajero en la pestaña Documentos (recomendado, con sugerencia
  desde `Valor Niño - Cantidad` / `Valor Infante - Cantidad` / ADL de la liquidación), o el cliente lo elige, o se
  deduce de la fecha de nacimiento leída (solo como verificación: avisar si no cuadra).
- ¿Qué cara lleva el pasaporte? Solo la página de datos (una foto). ¿La visa? Una foto.

## 4. Diseño técnico propuesto (ajustar según las respuestas)
**Base de datos — migración 029**
- `doc_solicitudes.viajeros_tipo jsonb` (índice 0 = viajero 1: `adulto|menor|infante`), por defecto todos `adulto`.
- `doc_archivos.cara text not null default 'unica' check (cara in ('frente','reverso','unica'))`; cambiar el único a
  `(solicitud_id, viajero, tipo, cara)`.
- Nuevos tipos en el check de `doc_archivos.tipo`: `tarjeta_identidad`, `registro_civil` (y los que salgan de D).
  Alternativa más simple: mantener `cedula` como "documento nacional" y guardar el subtipo (CC/TI/RC) en datos.

**Requisitos por viajero** (`lib/documentos/config.ts`): hoy `Requisitos` es por viaje; pasar a una función
`documentosDe(viajeroTipo, requisitosViaje)` que devuelva la lista `{tipo, caras[]}` por viajero. Progreso = suma de
caras requeridas confirmadas.

**Lectura** (`lib/documentos/lectura.ts`): leer frente + reverso en UNA llamada (dos imágenes) cuando ambas existan.
La **cédula colombiana nueva (digital) trae MRZ TD1 en el reverso** (3 líneas × 30): agregar `parsearMrzTd1` en
`lib/documentos/mrz.ts` (mismos dígitos de control ICAO 9303) → lectura determinística de número, nacimiento,
vencimiento, sexo. Registro civil: visión (NUIP, nombres, fecha de nacimiento, padres).
Escritura en GHL: TI y RC van a `P{n} - Documento` (como la cédula); revisar si conviene un campo "P{n} - Tipo de
documento" (CC/TI/RC/PA) — hoy no existe.

**Portal** (`app/documentos/[token]/Portal.tsx`): la casilla de un documento de dos caras muestra dos pasos ("Frente" →
"Reverso", con una silueta guía de qué lado fotografiar); la pantalla de análisis corre tras la segunda foto; el
formulario de confirmación es uno solo. Etiquetas del viajero: "Adulto / Menor / Infante".

**Panel** (`DocumentosTab.tsx`): selector de tipo por viajero (stepper de viajeros ya existe), la tarjeta del documento
muestra las dos miniaturas/“Ver frente” “Ver reverso”.

**CRM** (según A/B): crear campos por API con `scripts/` (patrón de `ghl-crear-campos-oportunidad.mjs`, `parentId` de
una carpeta nueva — no la de cuarentena). Si es (a): campos TEXT de oportunidad `P{n} - Documentos (panel)` con la URL
`/admin/reservas/<opp>#documentos`. Si es (b): FILE_UPLOAD de contacto vía `POST /forms/upload-custom-files`
(probado el 02-oct) — subir desde el servidor después de confirmar.

**Purga**: debe borrar ambas caras; si hay copia en GHL (b), documentar que esa copia NO se borra.

**Costos**: dos imágenes por lectura ≈ el doble de tokens; el cupo de la migración 028 se calcula por documento —
ajustar a "por cara" o contar la lectura conjunta como una.

## 5. Pendientes heredados (no olvidar)
- **Capacitación**: 9 oportunidades "CAPACITACIÓN – Portal documentos (Nombre)" (ids en el traspaso GHL).
  **Adriana** sin celular en su contacto (su usuario tiene el número de la agencia) → pedir su celular personal.
  **Johana**: su celular está en el contacto "Cl Conta al día" (`Dpby2l4v7VZBpk53HsVS`, tag johana_lozano) → confirmar
  si es ella antes de mover la oportunidad. Al terminar la capacitación: borrar fotos y cerrar esas oportunidades.
- Pasaporte REAL del usuario en la solicitud de prueba `c38b8926-80cf-4db3-9837-fcf2b08cd3ca` → borrar cuando avise.
- Auditoría, bajos abiertos: #7 Upstash en Vercel, #9 sanear `{{ }}` y no pisar P{n} sin revisión, #10 releer fecha de
  regreso en la purga, #11 secreto propio para la cookie. Aceptados por el usuario: #1 textos, #4 datos extraídos, #6
  acceso del equipo.

## 6. Datos de prueba
- Oportunidad de prueba `NnDUr5gyZfnGI4LWGHWl` (PRUEBA – Portal documentos, Reservaciones), contacto Fabrizio
  `uw120Td4Hyo4an1K4S0L` (celular termina en 9447, e.fabrizio@hotmail.com). **Solo probar con este contacto.**
- Generador de imágenes sintéticas (pasaporte/cédula/visa con MRZ válida): estaba en el scratchpad de la sesión del
  03-oct (`generar-docs.mjs`, Playwright); recrearlo si hace falta (para TD1: 3 líneas × 30, pesos 7-3-1).
- Confirmar un documento real dispara C-06 (tarea + SMS a Luisa): para probar la UI final usar una página temporal
  (`app/vista-*-tmp`, no se commitea) o una solicitud temporal.
- Verificación habitual: `npx tsc --noEmit -p tsconfig.json`, `npx eslint <archivos>`, `npx next build` (si falla por
  `.next/dev/types`, `rm -rf .next/dev`), capturas con Playwright en 390 px.
