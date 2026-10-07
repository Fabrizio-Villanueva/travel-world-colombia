# HANDOFF — Travel World Colombia

> Punto de entrada para una **sesión nueva**. Actualizado **2026-10-08**.
> Lee también `AGENTS.md` (esta versión de Next tiene cambios de API: consulta
> `node_modules/next/dist/docs/` antes de escribir código nuevo) y la memoria
> persistente del proyecto (se carga sola; `MEMORY.md` es el índice).

---

## ✅ CONTRATO PROPIO CON FIRMA ELECTRÓNICA (2026-10-08) — en producción

Reemplaza las plantillas de GHL Documents (4/8/12 pasajeros): contrato dinámico de 1 a 20
pasajeros, firma desde el celular con código, PDF con hoja de evidencia y GHL actualizado solo.
Traspaso completo: **`docs/handoff-contrato-propio.md`**. Pendiente del usuario: archivar C-02
viejo y C-03, borrar la oportunidad de prueba `wggaTPrYrtMImBbqnAz9`.

---

## ✅ DOMINIO MIGRADO (2026-08-30) — travelworldcolombia.com en producción

**El dominio real ya sirve el sitio de Vercel.** Cutover sin caída, correo
intacto, Search Console actualizado (sitemap enviado). Detalle completo en la
memoria `dominio-pendiente`. Resumen operativo:

- **DNS** (zona en el cPanel del hosting viejo, NS redexpertos): A del apex →
  `216.198.79.1` (Vercel, TTL 300); `www` CNAME → apex (Vercel lo 308-redirige
  al apex, que es el canónico). `mail.` → `23.111.141.202` y MX →
  `mail.travelworldcolombia.com` — el **correo sigue en el hosting viejo**.
- ⚠️ **NO cancelar el hosting viejo**: ahora es el servidor de correo (17
  cuentas). Rollback del sitio = devolver el A a `23.111.141.202` (5 min).
- **Redirects 301 del WP viejo** en `next.config.ts` (28 páginas + productos,
  sacados de sus sitemaps). En producción y verificados.
- **Páginas legales construidas** (commit `037b00d` en main): `/sostenibilidad`,
  `/codigo-de-conducta`, `/rnt` (¡2º registro descubierto: RNT 118011
  mayorista!), `/privacidad` (reescrita según Ley 1581/2012 — **pendiente
  revisión de abogado**), `/terminos-y-condiciones`. Armazón compartido:
  `components/legal/LegalShell.tsx`. Enlaces en el footer + sitemap.
- `NEXT_PUBLIC_SITE_URL=https://travelworldcolombia.com` en Vercel (Production,
  tipo Config) → canonicals/OG correctos. Los webhooks/crons siguen usando
  `travel-world-colombia.vercel.app` y **siguen funcionando** (el alias no se
  pierde).
- ⚠️ **Conflicto pendiente**: al mergear `mejoras/p0-p2` a main chocará la
  sección `redirects()` de `next.config.ts` — conservar el mapeo `legales` de
  main.
- Vigilancia: GSC ~2 semanas (404/cobertura; "Descubierta: sin indexar" es
  normal). Backup del WP viejo desde cPanel aún pendiente.

---

## ⏭️ FRENTE ABIERTO: curso de inducción GHL para agentes de viajes

**Contenido COMPLETO escrito (2026-08-26) en `docs/curso-ghl/`** — 7 módulos
(mapa mental, conversaciones/Sol, embudo 🎯 Leads, tarjeta, tareas/agenda,
🗂️ Reservaciones, reglas de oro + checklist de certificación), con ejercicios
sobre contactos de prueba (`PRUEBA - <nombre>` + tag `pruebas`). Decisiones del
usuario: formato = **herramienta de Comunidades de GHL en la subcuenta TWC**;
alcance = cero a cien completo; evaluación = ejercicios + checklist validado
por él. Guía de montaje paso a paso: `docs/curso-ghl/montaje-comunidad.md`
(la comunidad/curso se crea en la UI de GHL — no hay API pública).

**Pendiente:** crear el grupo "Academia TWC" + curso en la UI, pegar las
lecciones, incrustar la guía visual (Artifact **"Embudo TWC"** —
https://claude.ai/code/artifact/2868f34c-d7a6-421c-bbc2-6a2704b127a5 — como
imagen/PDF en la lección 2.1), invitar al equipo y correr la certificación.
El curso sigue siendo prerequisito de la Fase 5 de la migración (los campos
viejos no se borran hasta certificar a todo el equipo).

---

## 🎯 TRES FRENTES ACTIVOS

1. **Migración CRM contacto→oportunidad + TMS** — ver sección propia abajo.
   Circuito nuevo EN PRODUCCIÓN y probado punta a punta (2026-08-26).
2. **Sol** — el agente conversacional de IA (WhatsApp/IG/FB vía GoHighLevel).
   **Encendido en producción para TODOS los contactos** — y **repuntada a los
   pipelines nuevos** (commit `ef5cc31`).
3. **La web** — rediseño de `/destinos` con taxonomía + mapa interactivo,
   páginas `/servicios` y `/cruceros`, flujo "olvidé mi contraseña" del panel.

**Documentos de referencia (en el repo):**
- `docs/migracion-campos-oportunidad.md` — **diseño completo de la migración**
  (gobernanza, catálogo, fases, §8b checklist Fase 0, §8c criterio de borrado).
- `docs/agente-sol-diseno.md` — diseño funcional de Sol.
- `docs/handoff-sol-interaccion.md` — hand-off del pulido de interacción.
- `docs/ghl-twc-mapa.md` — IDs de la subcuenta GHL (pipeline, etapas, campos, tags).
- `docs/ghl-twc-auditoria.md` · `docs/auditoria-2026-08.md` — auditorías.

---

## 🔀 MIGRACIÓN CRM — estado al 2026-08-26 (todo verificado en producción)

**Modelo:** contacto = persona; oportunidad = viaje (1 tarjeta por reserva).
Detalle en `docs/migracion-campos-oportunidad.md` y en la memoria
`migracion-campos-oportunidad-ghl`.

**Hecho y probado:**
- **161 campos de oportunidad** creados en 8 carpetas (catálogo:
  `scripts/ghl-campos-oportunidad.catalog.json`, script idempotente:
  `scripts/ghl-crear-campos-oportunidad.mjs`, carpetas:
  `scripts/ghl-carpetas-oportunidad.json`). Los ~15 solapados con el TMS llevan
  sus nombres EXACTOS (el TMS resuelve por nombre).
- **Pipelines nuevos:** 🎯 Leads (venta) `MLoZOGIYvCBRUgQdYRA8` y
  🗂️ Reservaciones (operación) `Jq7CxjuirY9Gu44el0bs` (etapas mapeadas a
  estados del TMS). El PRINCIPAL viejo agoniza; "🛫 Clientes Viajando"
  **congelado** (nada nuevo entra).
- **Circuito probado en los 6 eslabones**: creación automática de tarjeta (wf
  "1.-Lead nuevo → crear oportunidad") · Sol repuntada · Ganada→Reservaciones
  vía webhook · cierres del pipeline viejo convergen · **cliente repetidor** (2
  won en el mismo pipeline) · copia de fecha a CPA-Fecha de Ida (wf "4.- fecha
  de viaje", dispara en 📤 Contrato Enviado).
- **Endpoint `/api/agente/reservacion`** (POST, auth `AGENTE_WEBHOOK_SECRET`,
  espera `customData.contact_id`): muda la MISMA tarjeta a Reservaciones + won
  y copia la fecha. Existe porque la acción nativa de GHL **crea duplicados**
  al cruzar pipelines (verificado). Regla nueva en §8c: eventos de negocio se
  disparan por etapa, nunca por "Contacto Modificado".
- **`allowDuplicateOpportunity: true`** activado por API (requisito del
  sistema: sin él no hay cliente repetidor). No hay UI en la marca blanca; se
  usó un PIT de AGENCIA guardado como `GHL_AGENCY_PIT` en `.env.local`.
- Workflow legacy **"Compro" despublicado** (creaba tarjetas en Viajando
  disparando por campo de contacto).
- **Guía de capacitación publicada** (Artifact "Embudo TWC", link arriba).

**Pendientes de la migración (en orden):**
1. **Auditar la carpeta de workflows "Clientes en Viaje"** (45/30/15/2 días,
   4.-En Viaje, 5.-Termino su viaje, 6.-Solicitar Review): los triggers por
   CPA-Fecha de Ida están BIEN (la copia los mantiene vivos); lo que hay que
   revisar son las ACCIONES que creen/muevan tarjetas en Viajando (quitarlas,
   conservar mensajes/notificaciones). El usuario iba a mandar capturas.
   También revisar "Ganado / Abonado" y "8.- Cierre Ganado" (siguen published).
2. **Capacitar al equipo** (→ el curso de arriba). Hasta entonces NO se borran
   campos viejos.
3. **Contrato v2** (`{{opportunity.*}}` + disparo por etapa 📤 Contrato
   Enviado): **EN PAUSA a pedido del usuario hasta después de la capacitación.**
   El mapeo de los 128 tags sale de `sourceContactKey` en el catálogo. Los
   merge tags de oportunidad YA están verificados (resuelven en workflows por
   etapa). Plantillas actuales: "🌎4-"/"🌎8-" (API `/proposals/`).
4. **Fase 4 ∥: alta de TWC en el TMS** (repo `tms-agencias`): fila en
   `agencies` + extender `getTokenForLocation` + scripts de campos puente +
   Custom Menu Link. El informe técnico del TMS está en la conversación de la
   memoria (2026-08-25).
5. Limpieza de tarjetas de prueba: contacto `wcTyG99DQ8J22fG9AmvK` (creado por
   Claude, borrable con sus 2 won de prueba) y la won de prueba del contacto
   real de Fabrizio `uw120Td4Hyo4an1K4S0L`.

---

## 🤖 SOL — estado al 2026-08-25

### Fases: todas desplegadas

| Fase | Estado |
|---|---|
| 1 · Webhook escucha/registra | ✅ producción |
| 2 · Cerebro (Opus 5 + catálogo) | ✅ producción |
| 3 · Escribe en GHL (crm.ts) | ✅ producción |
| 4 · Seguimiento dinámico (cola + runner + cron) | ✅ commiteada y desplegada — ⚠️ ver "cron" abajo |
| **Encendido** | ✅ **responde a TODOS** (sonda GET lo confirma) |
| Vigilante de leads sin respuesta | ✅ código en producción — ⚠️ falta activarlo (workflow GHL + cron externo) |

### Crisis resuelta (2026-08-19/20): Sol se apagaba en cadena

- **Causa raíz**: el **auto-saludo del dispositivo WhatsApp `+57 320 489 1930`**
  (mensajes `🔁 Sent from another device`) respondía solo; la compuerta
  anti-choque lo leía como "humano tomó el chat" → `stop_bot`. Afectó
  **153/191 contactos**. **El cliente ya APAGÓ ese auto-saludo** — no volver a activarlo.
- **Bug 400 CORREGIDO** (`lib/agente/claude.ts`): el bloque de "situación" iba
  como mensaje `role:'system'` al final de `messages` y rompía cuando el último
  del historial era saliente. Ahora es el 3er bloque del arreglo `system`
  (después del breakpoint de caché — el caché no se ve afectado).
- **Bug lead-nuevo-en-silencio CORREGIDO** (`lib/agente/enriquecer.ts`): en
  leads de PRIMER contacto el webhook llegaba antes de que GHL indexara la
  conversación (carrera) → Sol callaba (~15 leads perdidos). Fix: reintentos
  (3× con 2 s) de `conversacionDe()`.
- **Rescate ejecutado**: se respondió manualmente (imitando a Sol, registrando
  los `messageId` en `agente_mensajes_enviados`) a los leads colgados; los
  calificados recibieron el tag `sol_calificado`.

### Vigilante de leads sin respuesta (nuevo, falta encender)

`lib/agente/vigilante.ts` + `GET /api/agente/vigilante` (auth `CRON_SECRET` o
`AGENTE_WEBHOOK_SECRET`; `?dry=1` = simulación sin escribir). Cada corrida:
busca conversaciones con mensaje del cliente >60 min sin NINGÚN saliente (Sol
o humano), **solo dentro del horario de atención** (`enHorario`), y pone/quita
el tag **`lead_sin_respuesta`**. Probado en dry contra producción.

**Para activarlo (pendiente del usuario):**
1. Workflow en GHL: trigger *Contact Tag* = `lead_sin_respuesta` → notificación
   interna al **Assigned User** (rama sin asignar → notificar coordinador).
   NO mensajear al cliente; NO quitar el tag (lo quita Sol al re-armar).
2. Cron **externo** (cron-job.org, gratis — el proyecto Vercel es **Hobby**, sin
   crons horarios): GET cada hora a
   `https://travel-world-colombia.vercel.app/api/agente/vigilante` con header
   `x-sol-secret: <AGENTE_WEBHOOK_SECRET>`. Probar primero con `?dry=1`.

### ⚠️ Cron de seguimiento probablemente NUNCA ha corrido

`vercel.json` tiene 2 crons de `/api/agente/seguimiento` (15:00 y 20:00 UTC)
pero **`CRON_SECRET` NO existe en Vercel** (verificado 2026-08-20 en el
dashboard) → los crons reciben 401. Opciones: crear `CRON_SECRET` en Vercel, o
sumar 2 jobs más al cron externo con el header `x-sol-secret`. **Nadie ha
verificado un seguimiento real enviado.**

### Cuellos de botella de canal (siguen vivos, no son bugs de Sol)

- **Instagram/Facebook**: pasadas 24 h del último mensaje del cliente, la API
  rechaza el envío (política de Meta). Solo se puede responder desde el inbox.
- **Contactos SIN teléfono** (custom provider `6a22bfc4fcbd457e97784fbb`):
  todo envío por API falla con `422 Missing phone number`. Las asesoras deben
  responder desde ese inbox o conseguir el número.

### Limpieza del pipeline (2026-08-19, hecha por API)

Etapa "Lead Nuevo" tenía 519 oportunidades → quedaron **8**: 309 (ya asignadas)
→ "Asignado a Agente", 169 (muertas >90 días) → `lost`, 33 B2B/proveedores →
`abandoned` + tag `proveedor`. **7 ventas activas quedaron protegidas en Lead
Nuevo y el cliente debe reubicarlas a mano** (Alicia Castro, Ecoinnhotelcusco,
Nath, LuzA, Fernanda, María Eugenia + 1). Causa de fondo NO resuelta: ningún
workflow mueve la etapa al asignar → se volverá a acumular.

Confirmado: el tag **`sol_calificado`** dispara el workflow **"2.-Calificado
por Bot (Actualización en Pipeline)"** que **asigna asesora automáticamente**.

---

## 🌐 WEB — estado al 2026-09-03

### Actualizaciones 2026-09-03 (en producción)

- **Doble RNT en `/nosotros`**: la sección "Registro Oficial" ahora son 2
  tarjetas — RNT 27287 (Travel World Colombia **Agencia de Viajes**) y RNT
  118011 (Travel World **Mayorista de Turismo**) — cada una con botón
  "Verificar en el RUES →" (link de Ginna:
  https://www.rues.org.co/registro-nt). Fuente única en `lib/site.ts`
  (`rntMayorista`, `rntVerificarUrl`); `/rnt` también usa esas constantes y su
  enlace de verificación pasó de confecamaras al RUES. Commit `3c27e26`.
- **Menú con dropdowns HECHO** (era la "Fase 4"): submenús de Destinos
  (regiones) y Servicios (`ef7010d`), hover amarillo (`2d4e2ea`), y al llegar
  a `/destinos` con filtro del menú aterriza en el listado filtrado
  (`c029120`).
- **`/servicios` ampliada**: catálogo completo con los 11 servicios pedidos
  por el cliente (`5787a99`).
- **`/destinos`**: tarjetas de categorías dinámicas al tamaño de producto,
  mapa clicable POR PAÍS, mapa arriba, filtro en URL (`?f=`). Falta que el
  cliente etiquete datos en el panel (ver Pendientes del usuario).

### `/destinos` — taxonomía + mapa interactivo (aprobado por el cliente)

- **Modelo por facetas** (no árbol): `pais` + `region` (= continente en
  internacionales) + `transporte` ('bus'|'avion', solo Colombia; migración
  **014**) + `salida_fin_ano` (bool, 014) + `destacado` (= "Favoritos") +
  `es_crucero` (bool, migración **015**).
- **`MapaDestinos.tsx`**: mapamundi interactivo con **geografía real**
  (Natural Earth 110m → `components/destinos/mapa-mundo.ts`, generado por
  `scripts/generar-mapa-mundo.mjs`; regenerable con `npm i d3-geo` + node).
  Compacto (max-w-3xl centrado), visible en **todas** las pantallas (el cliente
  lo aprobó también en móvil). Hover ilumina + pastilla con conteo; clic filtra
  la página a esa región (toggle); pin animado de Colombia → nacionales;
  regiones sin datos tenues y no clicables.
- **`DestinosExplorador.tsx`** (reemplazó a DestinosLista): el mapa es LA
  navegación geográfica; chips solo para facetas transversales (⭐ Favoritos,
  🎄 Salidas fin de año cuando exista data) + chip ✕ de limpiar. Colombia en
  sub-grupos 🚌 bus / ✈️ avión; internacionales en grilla de 3 por región con
  el país como etiqueta en cada tarjeta (`DestinoCard.tsx`, badges ⭐/🎄).
- `/destinos` **excluye** cruceros.

### Páginas nuevas

- **`/servicios`**: catálogo completo de 11 servicios con CTA de WhatsApp
  (contenido hardcodeado; ampliada 2026-09-03).
- **`/cruceros`**: lista los destinos con `es_crucero` (checkbox en el panel);
  estado vacío "Muy pronto" + CTA mientras no haya cruceros cargados.
- **Nav**: Inicio · Destinos · Cruceros · Servicios · Nosotros · Contacto,
  con dropdowns de Destinos (regiones) y Servicios (hecho 2026-09-03).

### Panel admin

- **"Olvidé mi contraseña" en producción**: `/admin/recuperar` (pide enlace,
  respuesta genérica anti-enumeración) + `/admin/actualizar-password` (nueva
  contraseña sobre la sesión de recovery). Server actions `solicitarReset` /
  `actualizarPassword` en `app/admin/actions.ts`; rutas eximidas en `proxy.ts`.
  La plantilla **"Reset Password" de Supabase ya quedó configurada** por el
  cliente (`/auth/confirm?token_hash=...&type=recovery&next=/admin/actualizar-password`).
- Form de destinos: controles nuevos (Transporte, Salida fin de año, Es
  crucero, Región/Continente con hint).
- ⚠️ El panel de FAQs **no tiene botón de editar** (solo crear/ocultar/borrar);
  las correcciones de texto se hicieron directo en la BD. Mejora candidata.

### Cifras de marca (corregidas en toda la web + FAQs en BD)

**+500 destinos · +14 años de experiencia · 1 centro de operación** (antes
había 8+/5/15/3 mezclados). Si aparece una cifra vieja en algún lugar nuevo,
esa es la fuente de verdad.

---

## 🔑 CONFIGURACIÓN / INFRA

- **Vercel**: cuenta **ElFabre**, plan **Hobby** (sin crons horarios; el
  cliente descartó migrar a Pro). Auto-deploy con push a `main`. Preview
  deployments **funcionan** (el cliente habilitó las env vars de Supabase para
  el entorno Preview) pero están tras login de Vercel.
- **Env en Vercel**: todo cargado **excepto `CRON_SECRET`** (ver arriba).
- **Sonda de Sol**: `GET /api/agente/webhook` con header
  `x-sol-secret: <AGENTE_WEBHOOK_SECRET>` → dice modo y variables presentes.
- **Supabase**: proyecto `xedqgagkrtfcbenyimkg` (MCP). Migraciones aplicadas
  en prod hasta la **015**.
- **GitHub**: `ElFabre/travel-world-colombia`. Si el push da 403:
  `gh auth switch --user ElFabre`.
- **MCP de Vercel apunta al team equivocado** (Fabrizio, no ElFabre): para
  estado de deploys usar `gh api repos/ElFabre/travel-world-colombia/deployments`
  (+ `/statuses`).

---

## ⚠️ PENDIENTES DEL USUARIO (no son de código)

1. **Activar el vigilante**: workflow GHL del tag `lead_sin_respuesta` + cron
   externo (ver sección del vigilante).
2. **`CRON_SECRET` en Vercel** (o cron externo) para que el seguimiento corra.
3. **Etiquetar destinos en el panel**: revisar `transporte` pre-cargado por SQL
   (bus = Andina/Eje Cafetero, avión = Caribe), marcar ⭐ favoritos reales y
   🎄 salidas fin de año, y **cargar los cruceros** (checkbox "Es crucero").
4. **Reubicar las 7 ventas activas** que quedaron protegidas en "Lead Nuevo".
5. Leads sin teléfono pendientes de respuesta humana: Trujillo, Diego Romero,
   Killiam, Esteban (custom provider) · Diana M Muñoz, El Mapu620 (inbox IG).
6. Workflow que **mueva la etapa al asignar** (para que Lead Nuevo no se vuelva
   a llenar) — se puede diseñar en una sesión.
7. Históricos aún abiertos: registros públicos de Supabase (Sign Ups),
   protección HaveIBeenPwned, precio de "Perú de Colores", fotos del
   itinerario perdidas, fotos de los 7 paquetes ocultos de Drive.
8. **Post-dominio**: backup del WP viejo desde cPanel · revisar `/privacidad`
   con abogado · vigilar GSC (404/cobertura) ~2 semanas · confirmar que los
   Outlook/celulares del equipo usen `mail.travelworldcolombia.com` como
   servidor de correo (no el dominio a secas).

## ⏭️ CANDIDATOS PARA SESIONES FUTURAS

- **El curso de inducción GHL** (prioridad — ver sección al inicio).
- Auditoría de la carpeta "Clientes en Viaje" (si el usuario trae capturas).
- Alta de TWC en el TMS (sesión con el repo `tms-agencias`).
- ~~Fase 4 de la web: menú con dropdowns~~ → hecho 2026-09-03.
- Botón "Editar" en el panel de FAQs.
- Probar un seguimiento real de punta a punta (tras resolver el cron).
- Migrar el correo a Google Workspace/Zoho para poder cancelar el hosting
  viejo (disco al 85%; hasta entonces el hosting NO se toca).
- ~~Workflow de progresión de pipeline al asignar~~ → resuelto por el circuito
  nuevo (la asignación mueve a "Asignado a Agente" en el pipeline nuevo).

---

## 📦 ESTADO DEL PROYECTO

**Stack:** Next.js 16.3.4 (App Router, Turbopack) · React 19 · Tailwind v4 ·
TypeScript · Supabase · GoHighLevel (API REST con `GHL_TWC_PIT`) · Claude Opus 5.
**Repo:** `C:\Users\efabr\Travelworldcolombia`.
**Producción:** https://travelworldcolombia.com (el alias
travel-world-colombia.vercel.app sigue activo — webhooks/crons lo usan).

### Gotchas vigentes

1. **Turbopack cachea `globals.css`**: tras editarlo, `rm -rf .next` + reiniciar.
2. **El navegador del preview congela animaciones/screenshots** — verificar por
   estilos computados o `javascript_tool`, no por screenshot.
3. **PowerShell 5.1 no manda UTF-8**: probar webhooks con emojis pasando bytes.
4. **GHL `/conversations/search`**: el parámetro `page` se IGNORA — paginar con
   `startAfterDate` + `startAfter` (el campo `sort` viene como `[epoch_ms]`,
   pasar el entero). La API está tras **Cloudflare**: curl necesita
   `--ssl-no-revoke` y User-Agent de navegador (si no, error 1010/403); tras
   muchos requests puede bloquear temporalmente.
5. **Zod descarta lo que no está en el esquema**: al agregar un campo hay que
   tocar `types/destino.ts`, `lib/validations/destino.ts`, el form del panel
   **y** `construirPayload` en `app/admin/destinos/actions.ts`.
6. **No usar el MCP `prod-ghl-mcp`**: apunta a otra subcuenta. API REST directa.
7. **Enviar mensajes "como Sol" por API**: POST `/conversations/messages` con
   `type:'SMS'` + `conversationProviderId` del canal del cliente (WhatsApp
   custom = `67fb7921ff76fb73c232c866`), y **registrar el `messageId` en
   `agente_mensajes_enviados`** — si no, Sol lo lee como humano y se apaga.
8. Las páginas públicas son ISR: un cambio hecho directo en la BD no se ve
   hasta revalidar (redeploy o `revalidatePath` desde una action).

### Convenciones

- Server Components por defecto; `'use client'` solo cuando hace falta.
- Animaciones en CSS puro (no framer-motion).
- `npx tsc --noEmit` **y** lint antes de commitear (ignorar el error de tipos
  generados obsoletos en `.next/dev/types`).
- No commitear sin aprobación explícita del usuario.
- Commits: conventional commits en español.
- Español para el dominio, inglés para infraestructura.

### Deuda conocida (de `docs/auditoria-2026-08.md`)

Sin cambios: `select('*')` manda jsonb completos al cliente · hero sin
`<Image>` (LCP) · fallback de imagen roto para destinos sin foto · route group
`(public)` a medio migrar · tres formatos de resultado en server actions ·
revalidación duplicada · drift de `nombre_local` · limpieza P3.
