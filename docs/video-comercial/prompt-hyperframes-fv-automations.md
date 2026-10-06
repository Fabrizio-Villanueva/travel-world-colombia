# PROMPT — Comercial "FV Automations" (HyperFrames · 3:00 · 16:9 · estilo Google)

> Copia todo lo que está debajo de la línea y pégalo en HyperFrames (skill `/hyperframes` en local, o Magic Edit del MCP de HeyGen).
> Los campos `[[ENTRE CORCHETES DOBLES]]` son datos que debes completar tú antes de renderizar.

---

## 0. ROL Y OBJETIVO

Actúa como **director creativo + motion designer senior + ingeniero de HyperFrames**. Vas a producir de punta a punta un **video comercial de 3 minutos exactos (180 s)** que vende **FV Automations** — la marca de automatización e IA de **Fabrizio Villanueva** — a **dueños y gerentes de agencias de viajes** (LatAm, hispanohablantes).

El producto que se vende es un **sistema completo de ventas y operación para agencias de viaje**, ya funcionando en producción en un caso real (Travel World Colombia, travelworldcolombia.com), compuesto por:

1. **Sol — agente de IA conversacional** (impulsado por Claude de Anthropic) que atiende 24/7 en WhatsApp, Instagram, Facebook Messenger y el chat de la web: responde al instante, entiende notas de voz (las transcribe), reconoce de qué anuncio de Meta viene el cliente y lo conecta con el paquete correcto, califica al lead (destino, fechas, viajeros, presupuesto), escribe todo en el CRM, hace seguimiento automático y escala a un asesor humano con una tarea asignada cuando el cliente está listo. Si un asesor no responde a tiempo (15 min fuera de horario / 2 h en horario), Sol cubre la conversación de respaldo.
2. **Web de reservas que vende** (Next.js en Vercel): catálogo de destinos con filtros por país/región/categoría, itinerario día a día con fotos, hospedaje por categoría y habitación, documentos descargables, página de pagos (PSE, tarjeta, transferencias, Zelle), botones a WhatsApp, Píxel de Meta medido, todo editable desde un panel sin tocar código.
3. **CRM GoHighLevel reestructurado**: pipelines de Leads y de Reservaciones, oportunidades con todos los datos del viaje, workflows de traspaso, tareas automáticas para el asesor, cero leads olvidados.
4. **Generador de contratos**: un asistente paso a paso que arma el contrato y llena automáticamente la oportunidad y el contacto en el CRM (embebido dentro de GoHighLevel).
5. **Portal seguro de documentos del viajero**: el cliente recibe un enlace, entra con un código de un solo uso por WhatsApp o correo, sube su pasaporte, la IA lee la zona MRZ y los datos quedan en el CRM; los archivos se purgan automáticamente.
6. **Seguridad y cumplimiento**: auditorías de seguridad, control de acceso por roles, registro de auditoría, protección de datos personales y cumplimiento de la Ley 2300 de Colombia (horarios de contacto).

**Promesa central del comercial:** *"Tu agencia vende 24/7, sin perder un solo lead, con un sistema que atiende, califica, cierra y organiza por ti."*
**CTA final:** agendar una demo con FV Automations.

Tono: **Google keynote / Google I/O / anuncios de producto de Google** — optimista, limpio, humano, preciso, con ritmo alto y "dopamínico": cortes en el beat, micro-sorpresas cada 2–4 segundos, nada estático más de 3 s.

---

## 1. ESPECIFICACIONES TÉCNICAS DEL ENTREGABLE

| Parámetro | Valor |
|---|---|
| Duración | **180.0 s exactos** |
| Resolución | **1920 × 1080**, 16:9 |
| FPS | **30 fps** (5400 frames) |
| Salida | **MP4 H.264**, yuv420p, ~16–20 Mbps, audio AAC 48 kHz estéreo 320 kbps |
| Loudness final | **−14 LUFS integrado**, true peak ≤ −1 dBTP |
| Safe areas | Títulos dentro del 90 % (action safe), texto crítico dentro del 80 % |
| Idioma | Español latinoamericano neutro (VO + textos en pantalla) |
| Subtítulos | Quemados en pantalla (kinetic captions) + archivo `.srt` aparte |
| Extras | Exportar también un **thumbnail 1280×720 PNG** y un **corte de 30 s** (versión ad) si el tiempo lo permite |

### Reglas de HyperFrames (obligatorias)
- La composición es **HTML + CSS + GSAP**, renderizada de forma **determinística** frame a frame. Antes de escribir código, **lee la documentación/skill de HyperFrames instalada** (`/hyperframes`, `/hyperframes-cli`, `/hyperframes-media`) y respeta su contrato exacto de atributos y timelines; si algo de este prompt contradice la doc, **manda la doc**.
- Root con `data-composition-id`, `data-width="1920"`, `data-height="1080"`; cada clip/escena con `data-start`, `data-duration` y `data-track-index`; un **timeline GSAP pausado por composición**, registrado como pide la doc (`window.__timelines[...]`). El renderer es quien avanza el tiempo.
- **Prohibido** en la animación: `setTimeout`, `setInterval`, `requestAnimationFrame` propios, `Date.now()`, CSS transitions/animations que no estén controladas por el timeline, `Math.random()` sin semilla (usa un PRNG con seed fija), videos/iframes en vivo, fuentes cargadas tarde. Todo lo que se mueva debe ser función del tiempo del timeline.
- **Arquitectura modular**: una sub-composición por escena (`scenes/s01-hook.html` … `scenes/s12-cta.html`) + `index.html` maestro que las monta en la línea de tiempo. Componentes reutilizables: `phone.html` (mockup de celular), `laptop.html`, `browser.html`, `chat-bubble`, `kanban-card`, `counter`, `google-dots`, `cursor`, `transition-*`.
- **Todos los assets locales** en `assets/` (img, svg, fonts, audio). Nada se carga de internet en tiempo de render.
- Flujo de trabajo: `init` → construir escena por escena → `lint` después de cada escena → `preview` para revisar timing → `render` final. Corrige todos los warnings del lint.
- Fuentes: precárgalas (`@font-face` local + `document.fonts.ready` según indique la doc) para que el primer frame ya tenga la tipografía correcta.

---

## 2. FASE 0 — INVESTIGACIÓN Y RECOLECCIÓN DE ASSETS (HAZLO ANTES DE ANIMAR)

**Tienes permiso para ir a la web** y buscar, descargar y guardar en `assets/` todo lo que haga falta. Lista mínima:

### 2.1 Marca FV Automations
- Busca "FV Automations", "Fabrizio Villanueva FV Automations" en la web/redes. Si existe logo oficial, úsalo en SVG/PNG de alta resolución.
- **Si no encuentras logo oficial**, diséñalo como parte del video: wordmark **"FV Automations"** en Google Sans Flex (peso 500, "FV" en 700), con un símbolo de 4 puntos/píldoras en los 4 colores de Google que se ensamblan formando una "F" y una "V" o un rayo/flujo. Entrégalo también como `assets/brand/fv-logo.svg` aparte. Firma secundaria: *"by Fabrizio Villanueva"*.

### 2.2 Logotipos de integraciones (uso nominativo, versión oficial, SVG preferido)
WhatsApp, Instagram, Facebook Messenger, Meta, GoHighLevel, Claude / Anthropic, Next.js, Vercel, Supabase, Google Calendar/Gmail (si aplica), PSE, Visa/Mastercard. Fuentes válidas: press kits oficiales, simpleicons.org, Wikimedia Commons, brand pages. **No deformes ni recolorees logos de terceros** (excepto versión monocromo oficial si la marca la ofrece). Guarda la URL de origen de cada uno en `assets/CREDITS.md`.

### 2.3 Screenshots / grabaciones reales
- Captura en alta (2x, 2880×1800 o similar) con navegador headless las **páginas públicas** de https://travelworldcolombia.com: home (hero), /destinos (filtros y tarjetas), una página de producto (itinerario día a día + hospedaje + botones WhatsApp), /pagos. Captura además **scrolls completos** (full-page) para animarlos como "scroll de cámara".
- Las vistas privadas (chat de Sol, CRM GoHighLevel, panel admin, generador de contratos, portal de documentos) **NO se capturan con datos reales**: **recréalas como mockups UI en HTML/CSS** con datos 100 % ficticios (nombres inventados, teléfonos tipo +57 300 000 0000, pasaporte de muestra "SPECIMEN"). Diseño fiel a cómo lucen esas apps (WhatsApp, GoHighLevel kanban, etc.) pero limpio y estilizado tipo Google.
- Si te sirve contexto visual de GoHighLevel, busca capturas públicas de su UI de "Opportunities / Pipelines" para replicar la estructura (no el contenido).

### 2.4 Música (licencia libre para uso comercial)
Busca en **YouTube Audio Library, Pixabay Music, Uppbeat (free), Mixkit o Free Music Archive (CC-BY)** un tema:
- Género: **upbeat electro-pop / future-bass ligero / tech-pop optimista**, estilo música de keynote de Google o comercial de Pixel.
- **118–128 BPM**, compás 4/4, intro corta, con un **drop** reconocible para usar ~0:25 (revelación de marca) y un segundo pico ~2:20–2:40.
- Sin voces (o voces chopeadas sin letra), duración ≥ 3:00 o con loop limpio.
- Guarda la licencia/atribución en `assets/CREDITS.md`. Detecta BPM y marca el **grid de beats** (`beats.json`) para sincronizar cortes.

### 2.5 SFX (licencia libre: Pixabay SFX, Mixkit, Freesound CC0)
Descarga un kit coherente "UI tech limpio": `pop` (3 variantes), `click/tap` suave, `whoosh` corto y largo, `swoosh reverse`, `riser` 2 s y 4 s, `impact/boom` suave (sub-drop), `glitch` corto, `notification ding` tipo WhatsApp-like (genérico, no el oficial), `typing` (teclado suave), `cash register / success chime`, `shutter/scan` (para el pasaporte), `bubble` (burbuja de chat), `tick` de contador, `shimmer/sparkle`.

### 2.6 Voz en off (TTS)
- Genera la locución con el TTS de HyperFrames/HeyGen (`/hyperframes-media` o el que indique la doc). Voz **masculina o femenina joven-adulta, cálida, segura, latina neutra**, ritmo **~150 palabras/min**, energía 7/10, sonrisa en la voz. Elige la voz que mejor suene en español; genera 2 opciones y quédate con la más natural.
- Genera **un archivo por escena** (`vo/s01.wav`…) para poder ajustar timing sin regenerar todo. Transcribe con timestamps por palabra para los subtítulos cinéticos.

---

## 3. DIRECCIÓN DE ARTE — "GOOGLE PURO"

### 3.1 Color
| Token | Hex | Uso |
|---|---|---|
| `--g-blue` | `#4285F4` | color principal, acciones, Sol |
| `--g-red` | `#EA4335` | problemas, alertas, "antes" |
| `--g-yellow` | `#FBBC05` | énfasis, highlights, estrellas |
| `--g-green` | `#34A853` | éxito, "después", ventas cerradas |
| `--ink` | `#202124` | texto principal |
| `--ink-2` | `#5F6368` | texto secundario |
| `--surface` | `#FFFFFF` | fondo principal |
| `--surface-2` | `#F8F9FA` | tarjetas / fondos alternos |
| `--outline` | `#DADCE0` | bordes |
| `--blue-tint` | `#E8F0FE` | contenedores tonales |

- Fondos **mayormente blancos/claros**. Escenas de "problema" pueden ir en `#202124` (modo oscuro) para contraste dramático, y volver al blanco en la revelación.
- Los 4 colores aparecen **siempre juntos** en los momentos de marca (puntos, barras, confeti geométrico), como en Google.

### 3.2 Tipografía
- **Google Sans Flex** (Google Fonts) para todo; fallback **Roboto Flex** / Inter. Descárgala local.
- Titulares: 500–700, tracking −1 % a −2 %, tamaños 96–160 px. Cuerpo/captions: 400–500, 40–56 px. Números/contadores: 700, tabulares (`font-variant-numeric: tabular-nums`).
- Palabras clave resaltadas con color de Google o con un **highlighter pill** animado detrás.

### 3.3 Formas y UI
- **Material 3**: radios 16–28 px, píldoras, chips, FAB, tarjetas con elevación suave (`0 1px 3px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)`).
- Elementos gráficos: los **4 puntos de Google** (círculos que rebotan, se fusionan, forman líneas), líneas de conexión con dash animado, iconos **Material Symbols Rounded** (descárgalos SVG).
- Mockups: celular Pixel-style sin marca, laptop/navegador minimalista estilo Chrome.

### 3.4 Sistema de movimiento (motion tokens)
- **Easings Material 3** (usa `CustomEase` de GSAP):
  - `emphasized` = `cubic-bezier(0.2, 0, 0, 1)` — por defecto
  - `emphasizedDecelerate` = `cubic-bezier(0.05, 0.7, 0.1, 1)` — entradas
  - `emphasizedAccelerate` = `cubic-bezier(0.3, 0, 0.8, 0.15)` — salidas
  - `bounce` = `back.out(1.7)` / `elastic.out(1, 0.5)` solo para pops de puntos y chips
- **Duraciones**: micro 150–250 ms · elementos 350–500 ms · transiciones de escena 500–800 ms · movimientos de cámara 1.2–2.5 s.
- **Stagger** 40–80 ms en listas, chips, letras.
- **Cámara virtual**: cada escena vive dentro de un `.camera` wrapper; los zooms se hacen con `scale` + `x/y` sobre ese wrapper (transform-origin en el punto de interés), con `motion blur` simulado (duplicado con opacidad/blur direccional durante los 3–4 frames de mayor velocidad) en whip-pans y zoom-throughs.
- **Regla dopamina**: algo cambia cada **2–4 s**; cada corte cae **en un beat** del `beats.json`; cada aparición importante tiene SFX; los contadores siempre suben con `tick`; ningún plano estático > 3 s (usa push-in lento de 2–4 % de escala como "respiración").

### 3.5 Catálogo de transiciones (úsalas variadas, nunca la misma 2 veces seguidas)
1. **Google Dots Wipe** — 4 círculos de colores crecen desde un punto hasta cubrir la pantalla y se retiran revelando la escena siguiente.
2. **Zoom-through** — la cámara entra en un elemento (pantalla del celular, un chip, un punto) hasta que ese elemento *es* la siguiente escena.
3. **Zoom-out reveal** — lo que veíamos resulta ser una tarjeta dentro de una vista mayor (ej. el chat es una tarjeta del CRM).
4. **Shape morph** — un chip/píldora se transforma en botón → en tarjeta → en pantalla (morph de `border-radius`, `width`, `height`).
5. **Whip pan** horizontal con motion blur + whoosh.
6. **Mask reveal** con barras de los 4 colores en diagonal.
7. **Match cut** — un círculo de una escena coincide en posición/tamaño con otro de la siguiente.
8. **Glitch cut** (solo en la zona de "problema").
9. **Line draw** — una línea de conexión dibuja el camino hacia la siguiente escena.

### 3.6 Subtítulos cinéticos
- Abajo-centro, píldora blanca semitransparente (o texto con sombra suave en fondos claros), máx. 2 líneas, 42–48 px.
- Palabra activa resaltada en `--g-blue` (o el color de la escena) sincronizada con los timestamps del TTS.
- Además, **las palabras clave del VO aparecen gigantes** en pantalla (kinetic typography) en los momentos de impacto.

---

## 4. DISEÑO DE AUDIO

- **Mezcla**: VO −16 LUFS a nivel de voz; música −24 a −26 LUFS **bajo la voz** (ducking automático −10/−12 dB con ataque 80 ms, release 300 ms) y sube a −18 en momentos sin VO (drops, transiciones de marca).
- **Estructura musical**: 0:00–0:08 intro filtrada (low-pass) → 0:08–0:25 tensión (beat seco, notas graves) → **0:25 DROP** en la revelación de FV Automations → 0:25–2:20 groove energético → 2:20 build/riser → **2:40 segundo pico** en el CTA → fade/stinger final en 2:58–3:00.
- **SFX**: todos a −20/−24 LUFS, nunca tapan la voz. Cada `pop` de chip, cada burbuja de chat, cada tarjeta que se mueve en el CRM, cada contador y cada transición lleva su SFX. Varía los pops (pitch ±2 semitonos) para que no suene repetitivo.
- **Silencio dramático**: 0.3–0.5 s de silencio total justo antes del DROP de 0:25.

---

## 5. GUION Y STORYBOARD (TIMECODES EXACTOS)

> VO total ≈ 410–430 palabras. Ajusta los `data-start` finales a la duración real de cada archivo de VO, manteniendo los cortes en beat.

### S01 · HOOK — 0:00 → 0:08 (fondo oscuro `#202124`)
- **Visual**: negro. Un punto azul late. *Ding*. Aparece un celular en el centro; empiezan a caer notificaciones de WhatsApp, Instagram y Messenger cada vez más rápido (stagger acelerando). Reloj en pantalla: **11:47 p. m.** Un chat muestra "Hola! ¿precio del plan a Cartagena para 4? 🙏" con el doble check gris… sin respuesta. Zoom-in lento al chat.
- **VO**: *"Son las once y cuarenta y siete de la noche. Alguien quiere viajar con tu agencia… y nadie le está respondiendo."*
- **SFX**: dings en cascada (pitch subiendo), latido grave, tic de reloj.
- **Transición**: glitch cut.

### S02 · EL PROBLEMA — 0:08 → 0:25 (oscuro, acentos `--g-red`)
- **Visual**: grid de "dolores" que entra con stagger y glitch, cada uno con icono Material + contador rojo:
  - "Leads olvidados en el CRM" → contador sube a **[[512]]**
  - "Conversaciones sin leer" → **[[170]]**
  - "Tiempo de respuesta" → "**horas**" (tachado parpadeante)
  - "Contratos a mano", "Pasaportes por WhatsApp", "Asesores saturados" como chips rojos que tiemblan.
  - Push-in agresivo; al final todos los chips se comprimen en un único punto rojo en el centro.
- **VO**: *"Leads que se enfrían. Conversaciones sin leer. Contratos hechos a mano y pasaportes perdidos en el chat. Cada mensaje sin respuesta es un viaje que le vendes… a tu competencia."*
- **SFX**: glitch, ticks de contador, buzz de error; riser 4 s que termina en **silencio** (0:24.5).
- **Nota**: las cifras entre corchetes provienen de una auditoría real del caso; preséntalas como *"En una agencia real encontramos:"* (texto pequeño arriba).

### S03 · REVELACIÓN DE MARCA — 0:25 → 0:35 (corte a blanco)
- **Visual**: en el DROP, el punto rojo se divide en **los 4 puntos de Google** (rojo, azul, amarillo, verde), rebotan con `elastic`, se fusionan formando el logo **FV Automations**; flash blanco; el fondo pasa a blanco. Debajo: *"by Fabrizio Villanueva"*. Luego tagline en kinetic type: **"Tu agencia vende 24/7."**
- **VO**: *"Por eso creamos FV Automations: un sistema completo que atiende, califica, vende y organiza tu agencia… incluso mientras duermes."*
- **SFX**: boom suave en el drop, 4 pops afinados (acorde mayor), shimmer.
- **Transición**: zoom-through en el punto azul → S04.

### S04 · PILAR 1: SOL, TU AGENTE DE IA — 0:35 → 1:05 (la escena estrella, 30 s)
- **Visual** (sub-beats cada 3–4 s):
  1. Del punto azul nace el avatar de **Sol** (un sol/círculo con gradiente de los 4 colores, minimalista). Título: **"Conoce a Sol."** Chip: *"Impulsado por Claude"* con logo Anthropic/Claude.
  2. Mockup de celular: el mismo chat de la escena 1 → ahora Sol responde **en 2 s** (contador "⏱ 2 s" verde). Burbujas entran con bounce.
  3. El cliente envía una **nota de voz** → onda de audio animada → se convierte en texto (efecto typing) → chip "🎙 Audio transcrito".
  4. Etiqueta flotante: **"Viene del anuncio: Cartagena 4D/3N"** con logo de Meta → línea que conecta el anuncio con la tarjeta del paquete correcto.
  5. Sol hace preguntas y se van llenando **chips de calificación** con stagger: 📍 Destino · 📅 Fechas · 👨‍👩‍👧‍👦 Viajeros · 💰 Presupuesto → barra de "Lead calificado" se llena en verde.
  6. **Zoom-out**: el celular es uno de 4 celulares en fila (WhatsApp, Instagram, Messenger, Web chat), todos atendidos a la vez → logos de cada canal hacen pop.
- **VO**: *"Conoce a Sol, tu agente de inteligencia artificial. Responde en segundos por WhatsApp, Instagram, Messenger y tu web. Escucha notas de voz, sabe de qué anuncio llegó cada cliente y le muestra el paquete correcto. Pregunta destino, fechas, viajeros y presupuesto… y te entrega el lead calificado. Y si tu asesor no alcanza a responder, Sol cubre la conversación."*
- **SFX**: bubble pops, typing, onda de audio, ding de éxito al completar la calificación, whoosh en el zoom-out.
- **Transición**: zoom-out reveal → los 4 celulares se vuelven tarjetas que vuelan hacia la columna "Nuevo lead" de S05… pero antes pasamos por la web (whip pan → S05 web).

### S05 · PILAR 2: UNA WEB QUE VENDE — 1:05 → 1:25
- **Visual**: laptop estilo Chrome entra con morph desde una píldora. Dentro, **screenshots reales de travelworldcolombia.com** animados como scroll de cámara:
  1. Hero del home → cursor animado hace clic en "Destinos".
  2. Filtros por país/región/categoría (chips que se activan con pop) → tarjetas se reordenan (FLIP animation).
  3. Página de producto: **zoom-in** al itinerario día a día, luego a la sección de hospedaje (pestañas ★★★/★★★★), luego al botón verde de WhatsApp (pulse).
  4. Página de pagos: logos PSE / tarjeta / Zelle entran con stagger.
  5. Callout lateral: **"Editas todo desde tu panel. Sin programadores."** + mini mockup del panel admin.
  6. Badge: "Medido con Píxel de Meta" (logo Meta).
- **VO**: *"Tu web deja de ser un folleto y se convierte en vendedora: catálogo con filtros, itinerario día a día, hospedaje, pagos en línea y un botón directo a WhatsApp. Y todo lo cambias tú, desde tu panel, sin programadores."*
- **SFX**: clicks del cursor, swipe de scroll, pops de chips, cash-chime en pagos.
- **Transición**: Google Dots Wipe.

### S06 · PILAR 3: CRM QUE NO OLVIDA — 1:25 → 1:45
- **Visual**: tablero kanban estilo GoHighLevel (recreado, datos ficticios), logo GHL en esquina. Columnas: *Nuevo lead → Calificado por Sol → Cotizado → Reservado → Viajó*.
  1. Tarjetas llegan volando desde la escena anterior y caen en "Nuevo lead".
  2. Una tarjeta se mueve sola a "Calificado por Sol" (badge azul de Sol) → aparece un **toast**: "Tarea creada para Andrea · Llamar hoy 10:00 a. m." (nombre ficticio).
  3. Zoom-in a la tarjeta: campos del viaje llenos automáticamente (destino, fechas, pax, presupuesto, fuente del anuncio, nota resumen de Sol).
  4. Zoom-out rápido: el tablero completo fluye; contador **"Leads olvidados: 0"** en verde.
- **VO**: *"Cada conversación termina en tu CRM con todos los datos del viaje. Tu equipo recibe la tarea exacta, en el momento exacto. Cero leads olvidados."*
- **SFX**: whooshes de tarjetas, drop suave al caer, ding del toast, tick del contador bajando a 0.
- **Transición**: shape morph (una tarjeta → documento de contrato).

### S07 · PILAR 4: CONTRATOS Y DOCUMENTOS EN AUTOMÁTICO — 1:45 → 2:05
- **Visual**:
  1. **Generador de contratos**: wizard de 4 pasos (stepper Material) avanzando solo; campos se autocompletan con efecto typing; al final el contrato (PDF mock) se ensambla con piezas que encajan + check verde; línea que lo conecta a la tarjeta del CRM ("Oportunidad actualizada").
  2. Match cut al celular del viajero: llega un mensaje "Sube tus documentos aquí 🔒" → pantalla del **portal seguro**: código de 6 dígitos que se completa dígito a dígito → cámara escanea un **pasaporte SPECIMEN** (línea láser de escaneo verde recorriendo la zona MRZ) → los datos saltan a campos del CRM.
  3. Chip final: "🗑 Archivos purgados automáticamente · Datos protegidos".
- **VO**: *"El contrato se arma solo y se guarda en tu CRM. Y tus viajeros suben su pasaporte a un portal seguro, con código de un solo uso: la IA lee los datos y los deja listos para emitir."*
- **SFX**: clicks del stepper, typing, encaje "clack", shutter + scan, success chime.
- **Transición**: zoom-out reveal hacia el diagrama de integraciones.

### S08 · TODO CONECTADO + SEGURIDAD — 2:05 → 2:20
- **Visual**: diagrama orbital estilo Google: en el centro el logo FV Automations; en órbita, los logos oficiales (WhatsApp, Instagram, Messenger, Meta, GoHighLevel, Claude/Anthropic, Next.js, Vercel, Supabase). Líneas de conexión con dash animado y "paquetes de datos" (puntos de colores) viajando por ellas. Luego un escudo Material con 3 chips: **"Accesos por roles" · "Registro de auditoría" · "Cumple Ley 2300"**.
- **VO**: *"Todo conectado, todo medido y todo seguro: accesos por rol, auditoría de cada cambio y cumplimiento de la ley de contacto con tus clientes."*
- **SFX**: shimmer orbital, pops de logos, "lock" al aparecer el escudo.
- **Transición**: whip pan.

### S09 · CASO REAL — 2:20 → 2:40
- **Visual**: título "Caso real: **Travel World Colombia**" (logo de TWC descargado de su web) + screenshot del home. Split screen **ANTES (rojo, oscuro) / DESPUÉS (verde, claro)** con contadores animados:
  - Respuesta: "horas" → **"segundos, 24/7"**
  - Conversaciones sin leer: **[[170]]** → **[[0]]**
  - Leads sin seguimiento: **[[512]]** → **[[0]]**
  - **[[MÉTRICA DE VENTAS / LEADS CALIFICADOS POR MES — dato real]]**
  - El divisor del split barre de izquierda a derecha "convirtiendo" el antes en después.
- **VO**: *"Travel World Colombia ya lo usa todos los días: respuestas en segundos, las veinticuatro horas, y un equipo que solo se dedica a cerrar ventas."*
- **SFX**: riser hacia el segundo pico, ticks de contador, impacto en el "después".
- **Regla**: **no inventes cifras**. Si un `[[dato]]` no fue completado, omite esa fila en vez de rellenarla.

### S10 · CTA — 2:40 → 2:56 (segundo pico musical)
- **Visual**: fondo blanco, los 4 puntos rebotan en el beat y forman una barra de búsqueda estilo Google donde se escribe solo: *"cómo vender más en mi agencia de viajes"* → al dar Enter, el "resultado" es la tarjeta de **FV Automations**. Botón FAB gigante: **"Agenda tu demo"** con pulse. Debajo: **[[WhatsApp de contacto]]** · **[[sitio web / link de agenda]]** · **[[@usuario de Instagram]]** + código QR de [[link de agenda]] (genéralo local).
- **VO**: *"Deja de perder viajes. Agenda tu demo con FV Automations y pon a tu agencia a vender veinticuatro siete."*
- **SFX**: typing, click de Enter, pop del resultado, boom en "Agenda tu demo".

### S11 · END CARD — 2:56 → 3:00
- **Visual**: logo FV Automations centrado + *"by Fabrizio Villanueva"*; los 4 puntos hacen el último rebote y se quedan quietos en el frame final (frame 5400 limpio, apto como thumbnail).
- **VO**: (sin VO) — stinger musical.
- **SFX**: pop final + shimmer, música cierra en el beat.

---

## 6. CONTROL DE CALIDAD (verifícalo tú antes de entregar)

- [ ] Duración exacta 180.0 s, 1920×1080, 30 fps, sin frames negros ni saltos.
- [ ] `lint` sin errores ni warnings; render determinístico (renderizar dos veces da el mismo resultado).
- [ ] Todos los cortes caen en beat (±1 frame) según `beats.json`.
- [ ] Ningún plano estático > 3 s; ninguna transición repetida dos veces seguidas.
- [ ] VO inteligible por encima de música (ducking funcionando), −14 LUFS final, sin clipping.
- [ ] Subtítulos sincronizados palabra a palabra, sin errores ortográficos, tildes correctas.
- [ ] Logos de terceros sin deformar, versión oficial, fuentes en `assets/CREDITS.md`.
- [ ] **Cero datos personales reales** en mockups (nombres, teléfonos, pasaportes ficticios / SPECIMEN).
- [ ] Cero cifras inventadas: solo las de los `[[...]]` completados.
- [ ] Música y SFX con licencia comercial documentada.
- [ ] Contraste de texto WCAG AA en todas las escenas.
- [ ] Revisa 10 frames clave como imagen (0:03, 0:20, 0:27, 0:45, 1:15, 1:35, 1:55, 2:10, 2:30, 2:50) y corrige cualquier elemento cortado o superpuesto.

## 7. ENTREGABLES

1. `out/fv-automations-comercial-3min.mp4`
2. `out/fv-automations-comercial-3min.srt`
3. `out/thumbnail.png` (1280×720)
4. `out/fv-automations-ad-30s.mp4` (si el tiempo lo permite: hook S01 + S03 + highlights de S04 + CTA)
5. Proyecto HyperFrames completo (HTML/CSS/JS + `assets/` + `CREDITS.md` + `beats.json`)
6. Un breve `README.md` con: estructura de escenas, cómo cambiar textos/cifras/CTA y cómo re-renderizar.
