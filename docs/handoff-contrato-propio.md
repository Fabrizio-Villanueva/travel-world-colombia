# Traspaso — Contrato propio con firma electrónica (oct-2026)

> Estado al **08-oct-2026**: **EN PRODUCCIÓN** (main `5d6707f`), probado de punta a punta en
> producción por el usuario. Reemplaza las plantillas fijas de GHL Documents (4/8/12 pasajeros).
> Memoria relacionada: `contrato-plantilla-unica`, `contrato-12-pasajeros`.

## 1. Qué es

El panel arma el contrato desde la oportunidad de GHL, guarda una **foto congelada** de su
contenido (con huella SHA-256), y le manda al titular un enlace `/contrato/<token>`. El titular se
verifica con un **código de 6 dígitos** (WhatsApp o correo), lee, escribe nombre y documento,
**firma con el dedo** y acepta. El servidor genera el **PDF final** (contrato + firma + hoja de
evidencia), lo guarda con su SHA-256 y actualiza GHL (estado, enlace al PDF, etapa ✍️ Contrato
Firmado, nota en el contacto).

**Por qué no GHL Documents:** no tiene lógica condicional (confirmado en su centro de ayuda) →
siempre dejaba filas vacías en pasajeros, trayectos, liquidación y pagos. La prueba de "bloque de
texto en un campo" funcionó (saltos de línea y viñetas sí; tablas y HTML no), pero el usuario quería
conservar el diseño → se eligió la opción 3 (contrato y firma propios).

## 2. Flujo

1. Asesora llena el Generador (`/admin/reservas/<id>`). Recuadro **"Contrato para firma"**
   (`ContratoPanel.tsx`): Vista previa · Enviar contrato para firma · Reenviar aviso · Enviar
   versión nueva · Anular · Ver PDF firmado. El paso viejo "Enviar Contrato" (campo
   `ENVIAR CONTRATO?`) está OCULTO desde el cutover (`CAMPOS_OCULTOS` en `lib/admin/reservas.ts`).
2. `crearYEnviarContrato` (`lib/contratos/registro.ts`): valida (`problemasParaEnviar`), anula la
   versión previa sin firmar, inserta en `contratos`, escribe en GHL Link/Estado y **dispara el
   workflow** vaciando y escribiendo "Enviar contrato al cliente" = Enviar/Reenviar; mueve la tarjeta
   a 📤 Contrato Enviado si está en 🗂️ Reservaciones.
3. Workflow **C-02 · Enviar contrato → enlace para firma** (lo armó el usuario): disparadores
   "Enviar contrato al cliente" **HA CAMBIADO A** Enviar / Reenviar → SMS (WhatsApp) + Email
   (HTML en `docs/correos/c02-contrato-para-firma.html`). No mueve etapas (lo hace el sistema).
4. Cliente en `/contrato/<token>`: splash + candado (`IntroSeguro`, una vez por dispositivo) →
   verificación (`Verificacion.tsx`, código por `lib/contratos/codigo.ts`) → contrato + `Firmar.tsx`
   (canvas) → `PantallaFirmando` → `Gracias` (avión) → página "¡Contrato firmado!" + descarga.
5. `firmarContrato`: sube el PNG del trazo, marca firmado (condicional `estado='enviado'`), genera el
   PDF (`asegurarPdf` → `lib/contratos/pdf.ts`), vacía el disparador del workflow, escribe en GHL
   Estado=Firmado + enlace `/admin/contratos/<id>/pdf`, mueve a ✍️ Contrato Firmado y deja nota.
   Si el PDF falla, la firma queda guardada y el PDF se genera al descargar.

## 3. Piezas (archivos)

| Archivo | Qué hace |
|---|---|
| `components/contrato/ContratoDocumento.tsx` + `.module.css` | Documento (diseño v2 aprobado). Solo filas que existen. `.hojaLegal` = cláusulas 08+09+declaración+firmas en hoja propia; `.juntos` = pagos+condiciones inseparables |
| `components/contrato/HojaEvidencia.tsx` | Última página del PDF firmado |
| `lib/contratos/tipos.ts` | `ContratoDatos` |
| `lib/contratos/armar.ts` | Traductor PURO GHL → contrato (por nombre de campo; P1–P20, T1–T4, Pago 1–4; números COP; fechas; quita emojis de Inclusiones) |
| `lib/contratos/desde-ghl.ts` | Lee oportunidad + contacto (facturación por fieldKey) + asesora asignada |
| `lib/contratos/registro.ts` | Ciclo de vida: crear/enviar/anular/visto/firmar/PDF |
| `lib/contratos/codigo.ts` | OTP (copia adaptada de `lib/documentos/codigo.ts`) |
| `lib/contratos/acceso.ts` | HMAC: cookie de acceso, huella del OTP, firma de la URL de impresión |
| `lib/contratos/pdf.ts` | puppeteer-core + `@sparticuz/chromium` (Vercel) / Chrome local |
| `lib/contratos/clausulas.ts` | Texto legal (cambia ~1 vez al año) |
| `lib/contratos/config.ts` | IDs de GHL, etapas, vigencia (15 días), bucket |
| `lib/contratos/muestra.ts` | Datos inventados; `muestraConPasajeros(n)` hasta 20 |
| `app/contrato/[token]/*` | Página pública, acciones, firma, pantallas animadas, `pdf/route.ts` |
| `app/contrato/imprimir/[id]` | Página que imprime Chromium (HMAC `?e&k`, 5 min) |
| `app/contrato/muestra` | Muestra con datos inventados; `?pax=N`; `?opp=<id>` SOLO en dev |
| `app/admin/reservas/[id]/ContratoPanel.tsx`, `contrato-actions.ts`, `contrato/page.tsx` | Panel |
| `app/admin/contratos/[id]/pdf/route.ts` | PDF para el equipo (pide sesión; registra `ver-contrato`) |
| `supabase/migrations/035_contratos.sql` | Tabla `contratos`, RPC `ct_*`, bucket privado `contratos` |
| `scripts/ghl-crear-campos-contrato.mjs`, `scripts/ghl-ampliar-pasajeros.mjs --hasta=N` | Campos GHL |

`IntroSeguro` y `Gracias` viven en `app/documentos/[token]/` y aceptan textos propios (los usa
también el contrato).

## 4. IDs y datos

- Campos de oportunidad (carpeta Contrato): Link del contrato `Ypegk5NGJz2BxwPeDLvJ`
  (`opportunity.link_del_contrato`), Estado del contrato `7yL8JdhJSgDDtF7gdZpM`
  (Enviado/Visto/Firmado/Anulado), Contrato firmado (PDF) `t8bIRDEiXjY3NdfJPhLA`, Enviar contrato al
  cliente `EdPNxTWoXR9j09mMkZjX` (Enviar/Reenviar).
- Pasajeros P1–P20 × 10 campos en 👥 Pasajeros (348 campos de opp en total); "Contrato - Numero de
  Pasajeros" 1–20. Catálogo del Generador: 274 entradas, todas resueltas.
- Etapas (🗂️ Reservaciones `Jq7CxjuirY9Gu44el0bs`): 📤 Contrato Enviado
  `9c94de93-0e54-4925-9901-f6bf8c6f57b6`, ✍️ Contrato Firmado `ecdf4a60-5ef6-4b21-b61c-0103fec0e146`.
- Migraciones en prod: 034 (docs 1–12), 035 (contratos), 036 (docs 1–20).

## 4b. Cambios pedidos por el cliente (08-oct-2026)

Ocho puntos aplicados el mismo día (contrato + Generador + GHL):

| # | Qué | Dónde |
|---|---|---|
| 1–2 | Avisos "Cargos e impuestos locales" y "Saldos pendientes" bajo el plan de pagos, antes de los medios de pago | `ContratoDocumento.tsx` (`AVISO_*`, `.aviso`) |
| 3 | Cláusula "Validez y confirmación de la reserva" tras las observaciones, antes de la hoja legal (bloque sin número; no mueve la numeración) | `ContratoDocumento.tsx` (`CLAUSULA_VALIDEZ`, `.validez`) |
| 4 | "Tipo de pago" → **Depósito mínimo requerido para confirmar reserva**: etiqueta en el Generador (`ETIQUETA_CAMPO`) y línea en el contrato (`depositoMinimo`). El campo GHL sigue siendo `Pago 1 - Tipo de Pago` (TEXT); si es solo número se imprime en pesos | `Wizard.tsx`, `armar.ts`, `ContratoDocumento.tsx` |
| 5 | "Liquidación Porción Terrestre **o Plan Turístico**": pestaña del Generador (`ETIQUETA_PASO`, la llave interna no cambia) y chip "Terrestre o plan turístico" en la tabla | `Wizard.tsx`, `ContratoDocumento.tsx` |
| 6 | **Cuotas pendientes**: campos `Cuota N - Importe` / `Cuota N - Fecha de vencimiento` (N=1..6, carpeta Plan de Pagos, `scripts/ghl-crear-campos-cuotas.mjs`); bloque propio en el paso Plan de Pagos (agregar/quitar, total programado, depósito a la vista, validaciones: importe > 0, total = abonos + cuotas, vencimiento ≤ un mes antes del viaje; nada se ajusta solo); tabla "Cuotas pendientes" + total programado en el contrato. Quitar una cuota vacía la ranura en GHL (`guardarReserva(..., limpiar)`), único caso en que el Generador borra. `cuotas`/`depositoMinimo` son opcionales en `ContratoDatos`: las fotos congeladas viejas se imprimen igual | `Wizard.tsx`, `actions.ts`, `reservas.ts` (`RE_CUOTA`), `armar.ts` (`MAX_CUOTAS`), `tipos.ts`, `muestra.ts` (`?cuotas=0`) |
| 7–8 | Opciones de Inclusiones (17) / No incluye (10) en GHL | `scripts/ghl-opciones-inclusiones.mjs` |
| — | "Tipo de Contrato": Tiquetes Aéreos · Paquete Turístico · Plan Todo Incluido · Asistencia en Viajes · Excursiones · Tiquetes Aéreos y Asistencia en Viajes (pedido de Ginna). `PASOS_NO_APLICAN` conserva también los nombres viejos | `scripts/ghl-opciones-tipo-contrato.mjs`, `Wizard.tsx` |

Paginación tras los cambios (muestra, carta, márgenes de `pdf.ts`): 4 páginas con o sin cuotas
(antes 3). `.juntos` ya no obliga a pagos + condiciones en la misma hoja (cada sección entera,
`.validez` pegada a las condiciones): si no, la liquidación quedaba sola en una hoja casi vacía.

## 5. Pendiente

**Del usuario (GHL):**
1. Despublicar y mandar a ZZ: **C-02 viejo** ("Enviar contrato → documento al cliente", ramas por
   asesora) y **C-03 · Preview → borrador**.
2. Borrar la oportunidad de prueba **"PRUEBA – Contrato dinámico"** `wggaTPrYrtMImBbqnAz9`
   (contacto Fabrizio Villanueva `uw120Td4Hyo4an1K4S0L`). No lo hace Claude: borrado permanente.
3. Avisar al equipo del flujo nuevo.

**Ideas ofrecidas, no hechas:**
- "Descargar borrador en PDF" con marca de agua BORRADOR en la vista previa del panel.
- Editar las cláusulas desde el panel (como `/admin/textos`).
- ¿Cláusulas distintas por "Tipo de contrato" (Tiquetes Aéreos vs Paquetes)? Se preguntó, sin
  respuesta: hoy todos usan las mismas.
- Subir el logo blanco a la biblioteca de medios de GHL (el correo hoy lo toma del sitio).
- Los contactos del usuario están duplicados (`uw120…` +52, `wnhe12…` +57, `BCa2EE…` solo correo).
  Su WhatsApp real es **+52 322 779 9447** (correcto, no es error de prefijo).

## 6. Trampas conocidas

- **Chrome local**: con puppeteer, el `chrome.exe` completo de Playwright da `spawn UNKNOWN` en esta
  máquina; `pdf.ts` usa primero `chromium_headless_shell-*`. En Vercel se usa `@sparticuz/chromium`
  (binario incluido por `outputFileTracingIncludes` en `next.config.ts`).
- **Vistas previas de Vercel** están protegidas: el PDF se imprime llamándose a sí mismo, así que en
  preview necesitaría `VERCEL_AUTOMATION_BYPASS_SECRET` (no configurado). Producción usa `SITE.url`.
- **El panel del navegador de Claude** puede estar oculto (`innerWidth 0`): el canvas mide 2 px. Para
  probar la firma usar Playwright headless (devices iPhone 13) con la cookie de acceso calculada
  (`twc_ct_<sha256(token)[0:16]>` = `<id>.<exp>.<hmac('acceso:'+id+'.'+exp)>`, clave
  `sha256('contratos:'+SERVICE_ROLE_KEY)`).
- **Paginación**: Chromium ignora el espacio "aparente"; medir por página con `pypdf` (Python) en
  vez de a ojo. Hoy: 1–5 pax → 3 páginas, 6–20 → 4; la hoja legal mide 856/980 px.
- **Workflow con "is"** en vez de "ha cambiado a" reenviaría el enlace en cada cambio de la tarjeta;
  por eso el sistema vacía el disparador al firmar/anular.
- `NEXT_PUBLIC_SITE_URL` en local es `localhost:3000`: los enlaces creados en local apuntan ahí.
