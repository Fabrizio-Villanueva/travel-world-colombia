import { createHash } from 'node:crypto'
import { precioDesde } from '@/lib/precio'
import type { Destino } from '@/types/destino'
import type { MensajeGhl } from '@/lib/agente/ghl'

/**
 * Reactivación de leads — reglas PURAS (sin red ni base de datos).
 *
 * Todo lo que decide quién entra, qué se le ofrece y si un texto se puede
 * enviar vive aquí, para poder probarlo con casos fijos sin tocar GHL ni
 * Supabase (ver el script de pruebas del entregable). El orquestador
 * (`./correr.ts`) solo junta los datos y llama a estas funciones.
 */

export type Segmento = 'rescate' | 'silencioso'
export type Capa = 1 | 2 | 3
export type Variante = 'ia' | 'plantilla'
export type DecisionReactivacion = 'enviado' | 'callar' | 'error_validacion' | 'error_envio' | 'dry_run'

/** Lo que el cliente le contó a Sol (campos de la oportunidad, carpeta "⭐ Calificación (Sol)"). */
export interface Interes {
  destino?: string
  fechas?: string
  adultos?: number
  ninos?: number
  presupuesto?: string
  duracion?: string
  motivoViaje?: string
  objecion?: string
  detalleObjecion?: string
  resumen?: string
  temperatura?: string
  estadoComercial?: string
}

export interface ProductoCorto {
  slug: string
  nombre: string
  /** "Desde $1.290.000" tal como lo muestra la web (va SOLO en la ficha). */
  precio: string
  moneda: 'COP' | 'USD' | null
  duracion?: string
  pais: string
  /** Por qué quedó en la lista (para el motivo de la ficha de la plantilla). */
  razon: 'anuncio' | 'interes' | 'temporada'
  puntos: number
  /** Qué dice la ficha del catálogo sobre la visa. Solo con 'no_requiere' se puede decir "sin visa". */
  visa: 'no_requiere' | 'requiere' | 'sin_dato'
  esCrucero: boolean
}

export interface FichaElegida {
  slug: string
  motivo: string
}

const DIA_MS = 86_400_000

/** Minúsculas, sin tildes ni signos: para comparar textos del cliente con el catálogo. */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Variante A/B
// ---------------------------------------------------------------------------

/**
 * Variante estable por contacto: hash del contactId (mismo contacto → misma
 * variante siempre, aunque el lote cambie de un día a otro). La que quede
 * guardada en `agente_reactivacion` manda sobre el hash (ver correr.ts).
 */
export function variantePorHash(contactId: string): Variante {
  const byte = createHash('sha256').update(contactId).digest()[0]
  return byte % 2 === 0 ? 'ia' : 'plantilla'
}

// ---------------------------------------------------------------------------
// Segmento: ¿habló con Sol o nunca respondió?
// ---------------------------------------------------------------------------

export type Clasificacion =
  | { ok: true; segmento: Segmento; diasSinRespuesta: number; respuestasDelCliente: number }
  | { ok: false; motivo: string }

/**
 * Clasifica la conversación (mensajes del más reciente al más antiguo, como
 * los da GHL). `idsSol` = ids de los salientes que envió Sol (registrados en
 * `agente_mensajes_enviados`).
 *
 *  - Cualquier saliente que NO es de Sol = un humano (o el bot viejo) metió la
 *    mano: el lead es de una persona y no se toca (mismo criterio que
 *    `humanoTomoElChat`).
 *  - El último mensaje tiene que ser de Sol y llevar ≥ `diasMinimos` sin
 *    respuesta: si el último es del cliente, está pendiente de respuesta (eso
 *    es trabajo del vigilante, no de una reactivación).
 *  - `rescate` = el cliente contestó al menos una vez DESPUÉS del primer
 *    mensaje de Sol; `silencioso` = solo escribió el mensaje inicial (casi
 *    siempre el texto prellenado del anuncio) y nunca volvió.
 */
export function clasificarConversacion(
  mensajes: MensajeGhl[],
  idsSol: Set<string>,
  ahora: Date,
  diasMinimos: number
): Clasificacion {
  const reales = mensajes.filter(m => !m.messageType?.startsWith('TYPE_ACTIVITY'))
  // Mismo criterio que `salientesReales`: un saliente cuenta si trae tipo.
  const salientes = reales.filter(m => m.direction === 'outbound' && m.messageType)
  if (salientes.length === 0) return { ok: false, motivo: 'Sol nunca le escribió' }
  if (salientes.some(m => !m.id || !idsSol.has(m.id))) {
    return { ok: false, motivo: 'hay mensajes de una persona (o del bot viejo) en el chat' }
  }

  const ultimo = reales[0]
  if (ultimo.direction === 'inbound') return { ok: false, motivo: 'el último mensaje es del cliente (pendiente de respuesta)' }
  const fecha = ultimo.dateAdded ? Date.parse(ultimo.dateAdded) : NaN
  if (Number.isNaN(fecha)) return { ok: false, motivo: 'el último mensaje no trae fecha' }
  const dias = (ahora.getTime() - fecha) / DIA_MS
  if (dias < diasMinimos) return { ok: false, motivo: `el último mensaje de Sol es de hace ${dias.toFixed(1)} días (< ${diasMinimos})` }

  // Índice del saliente MÁS ANTIGUO de Sol en la ventana; lo que está antes en
  // el arreglo es más nuevo.
  let idxPrimerSol = -1
  reales.forEach((m, i) => {
    if (m.direction === 'outbound') idxPrimerSol = i
  })
  const respuestas = reales
    .slice(0, idxPrimerSol)
    .filter(m => m.direction === 'inbound' && ((m.body ?? '').trim() !== '' || (m.attachments?.length ?? 0) > 0)).length

  return {
    ok: true,
    segmento: respuestas >= 1 ? 'rescate' : 'silencioso',
    diasSinRespuesta: Math.floor(dias),
    respuestasDelCliente: respuestas,
  }
}

/**
 * Solo WhatsApp por la app de marketplace (GoGHL, proveedor custom): es la
 * ruta que entrega las tarjetas #btn y que no tiene la ventana de 24 h de la
 * API oficial de WhatsApp (por ahí un mensaje libre a los 3 días rebotaría).
 */
export function esWhatsappQr(mensajes: MensajeGhl[]): boolean {
  const entrante = mensajes.find(m => m.direction === 'inbound' && m.messageType)
  return (
    (entrante?.messageType === 'TYPE_CUSTOM_PROVIDER_SMS' || entrante?.messageType === 'TYPE_CUSTOM_SMS') &&
    Boolean(entrante.conversationProviderId)
  )
}

/** Tags que sacan a un contacto de la reactivación. Devuelve el motivo o null. */
export function exclusionPorTags(
  tags: string[],
  t: { stopBot: string; calificado: string; transferenciaHumano: string; noContactar: string; noCliente: readonly string[]; extra: readonly string[] }
): string | null {
  const bajos = tags.map(x => x.toLowerCase().trim())
  if (bajos.includes(t.noContactar)) return `pidió no recibir novedades (${t.noContactar})`
  if (bajos.includes(t.stopBot)) return 'tiene stop_bot (lo lleva una persona)'
  if (bajos.includes(t.calificado)) return 'ya calificó (sol_calificado)'
  if (bajos.includes(t.transferenciaHumano)) return 'ya se escaló al equipo'
  const noCliente = bajos.find(x => t.noCliente.includes(x))
  if (noCliente) return `no es cliente (${noCliente})`
  const extra = bajos.find(x => t.extra.includes(x))
  if (extra) return `tag "${extra}"`
  if (bajos.some(x => x.includes('prueba'))) return 'contacto de pruebas'
  return null
}

// ---------------------------------------------------------------------------
// Temporada y lista corta de productos
// ---------------------------------------------------------------------------

export interface Temporada {
  /** Para la plantilla: "Ya se acerca {texto}". */
  texto: string
  emoji: string
  /** Bonos de puntuación por tipo de producto. */
  finDeAno: number
  caribe: number
  nacional: number
  internacional: number
  crucero: number
}

/**
 * Qué se vende según el mes (calendario de Colombia): oct-dic, fin de año en
 * playa nacional y Caribe; ene-mar, Semana Santa; abr-jul, vacaciones de mitad
 * de año (más internacional y cruceros); ago-sep, la gente ya planea diciembre.
 */
export function temporadaDe(fecha: Date): Temporada {
  const mes = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', month: 'numeric' }).format(fecha))
  if (mes >= 10) return { texto: 'la temporada de fin de año', emoji: '🎄', finDeAno: 4, caribe: 3, nacional: 2, internacional: 0, crucero: 1 }
  if (mes <= 3) return { texto: 'Semana Santa', emoji: '🌴', finDeAno: 0, caribe: 2, nacional: 2, internacional: 1, crucero: 1 }
  if (mes <= 7) return { texto: 'las vacaciones de mitad de año', emoji: '✈️', finDeAno: 0, caribe: 1, nacional: 1, internacional: 2, crucero: 2 }
  return { texto: 'la temporada de fin de año', emoji: '🎄', finDeAno: 3, caribe: 2, nacional: 2, internacional: 1, crucero: 1 }
}

const RE_CARIBE =
  /caribe|cartagena|san andres|santa marta|punta cana|dominicana|aruba|curazao|curacao|cancun|riviera maya|cuba|jamaica|bahamas|baru|rosario|perlas|providencia|tayrona|la romana/

/** Palabras que no dicen nada del destino (para no "coincidir" por "viaje" o "plan"). */
const VACIAS = new Set([
  'viaje', 'viajes', 'viajar', 'plan', 'planes', 'paquete', 'paquetes', 'quiero', 'quisiera', 'para', 'personas',
  'persona', 'dias', 'noches', 'desde', 'hasta', 'todo', 'incluido', 'informacion', 'info', 'precio', 'precios',
  'con', 'los', 'las', 'del', 'una', 'unos', 'unas', 'algo', 'como', 'mas', 'familia', 'pareja', 'vacaciones',
  'fin', 'ano', 'semana', 'santa', 'mitad', 'bogota', 'salida', 'salir', 'hotel', 'tour', 'esposa', 'esposo',
  'hijos', 'amigos', 'colombia', 'nacional', 'internacional', 'diciembre', 'enero', 'junio', 'julio',
])

function palabrasDeInteres(i: Interes | null): string[] {
  if (!i) return []
  const fuente = [i.destino, i.motivoViaje].filter(Boolean).join(' ')
  return [...new Set(normalizarTexto(fuente).split(' ').filter(p => p.length >= 4 && !VACIAS.has(p)))]
}

export function imagenDe(d: Destino): string | undefined {
  return d.imagen_hero || d.imagen_thumb || d.galeria?.[0] || undefined
}

/**
 * Lista corta (5-8) de productos vigentes con precio y foto, puntuados por
 * coincidencia con el interés del cliente, el anuncio por el que llegó y la
 * temporada. Los slugs de `excluir` (ya enviados en una reactivación anterior)
 * no entran; los que Sol ya le mostró en el chat (`yaVistos`) pierden un poco
 * de prioridad pero pueden volver (en un rescate, repetir el plan que le gustó
 * es justo lo que funciona: así lo hacía la despedida fija de Sol v2).
 */
/**
 * Visa según el texto del catálogo. "Trámite de pasaporte, visa y valores
 * consulares (cuando se requiera)" es genérico y NO cuenta. Caso real 09-oct:
 * la IA dijo "Crucero Cartagena sin visa" y el catálogo no lo dice (solo La
 * Romana trae "No requiere Visa").
 */
export function visaDe(d: Destino): ProductoCorto['visa'] {
  const t = JSON.stringify(d)
  if (/no requiere visa/i.test(t)) return 'no_requiere'
  if (/pasaporte y visa|requiere visa|visa (americana|estadounidense)/i.test(t)) return 'requiere'
  return 'sin_dato'
}

export function listaCorta(
  destinos: Destino[],
  c: {
    interes: Interes | null
    slugsAnuncio: string[]
    temporada: Temporada
    nacional: boolean
    excluir: Set<string>
    yaVistos: Set<string>
    max?: number
  }
): ProductoCorto[] {
  const palabras = palabrasDeInteres(c.interes)
  const candidatos: ProductoCorto[] = []
  for (const d of destinos) {
    if (!d.activo || c.excluir.has(d.slug)) continue
    const precio = precioDesde(d)
    if (!precio || !imagenDe(d)) continue

    const nombreSlug = normalizarTexto(`${d.nombre} ${d.slug.replace(/-/g, ' ')} ${d.nombre_local ?? ''}`)
    const lugar = normalizarTexto(`${d.pais} ${d.region ?? ''} ${(d.etiquetas ?? []).join(' ')}`)
    const todo = `${nombreSlug} ${lugar}`
    const esNacional = normalizarTexto(d.pais) === 'colombia'
    const esCaribe = RE_CARIBE.test(todo)

    let puntos = 0
    let razon: ProductoCorto['razon'] = 'temporada'
    if (c.slugsAnuncio.includes(d.slug)) {
      puntos += 12
      razon = 'anuncio'
    }
    let coincidencias = 0
    for (const p of palabras) {
      if (nombreSlug.includes(p)) coincidencias += 6
      else if (lugar.includes(p)) coincidencias += 4
    }
    if (coincidencias > 0) {
      puntos += Math.min(coincidencias, 12)
      if (razon !== 'anuncio') razon = 'interes'
    }
    const t = c.temporada
    if (d.salida_fin_ano) puntos += t.finDeAno
    if (esCaribe) puntos += t.caribe
    if (d.es_crucero) puntos += t.crucero
    puntos += esNacional ? t.nacional : t.internacional
    if (c.nacional && d.precio_moneda === 'COP') puntos += 1
    if (d.destacado) puntos += 1
    if (c.yaVistos.has(d.slug)) puntos -= 1

    candidatos.push({
      slug: d.slug,
      nombre: d.nombre,
      precio,
      moneda: d.precio_moneda ?? null,
      duracion: d.duracion || undefined,
      pais: d.pais,
      razon,
      puntos,
      visa: visaDe(d),
      esCrucero: Boolean(d.es_crucero),
    })
  }
  // Empate: se respeta el orden del catálogo (getDestinos ya viene ordenado).
  return candidatos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.puntos - a.p.puntos || a.i - b.i)
    .slice(0, c.max ?? 8)
    .map(x => x.p)
}

/** Capa de interés: 1 = lo que le dijo a Sol, 2 = el anuncio, 3 = nada (temporada). */
export function capaDe(interes: Interes | null, slugsAnuncioEnLista: string[]): Capa {
  if (interes && (interes.destino || interes.motivoViaje || interes.fechas || interes.presupuesto)) return 1
  if (slugsAnuncioEnLista.length > 0) return 2
  return 3
}

// ---------------------------------------------------------------------------
// Plantilla (variante determinista)
// ---------------------------------------------------------------------------

/** Destino dicho por el cliente, solo si se puede citar tal cual (sin cifras ni frases largas). */
export function destinoCitable(destino?: string): string | undefined {
  const d = destino?.replace(/\s+/g, ' ').trim()
  if (!d || d.length < 3 || d.length > 35) return undefined
  if (!/^[\p{L}\s,.'-]+$/u.test(d)) return undefined
  return d
}

/** Nombre de pila para el saludo: solo el confirmado (IA - NOMBRE); el del perfil de WhatsApp no es fiable. */
export function nombreDePila(nombreConfirmado?: string): string | undefined {
  const primero = nombreConfirmado?.trim().split(/\s+/)[0]
  if (!primero || primero.length < 2) return undefined
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase()
}

function motivoPlantilla(p: ProductoCorto, temporada: Temporada, d: Destino | undefined, i: number, segmento: Segmento): string {
  // La segunda ficha es la alternativa: no puede decir también "el plan por el que nos escribiste" (dry-run 09-oct).
  if (i > 0 && p.razon !== 'temporada') return 'Otra opción para comparar'
  if (p.razon === 'anuncio') return 'El plan por el que nos escribiste'
  // Un silencioso no nos "contó" nada: solo preguntó o llegó por un anuncio.
  if (p.razon === 'interes') return segmento === 'rescate' ? 'Va con lo que me contaste de tu viaje' : 'Va con lo que nos preguntaste'
  // "Salida confirmada" sería una promesa: solo se nombra la temporada.
  if (d?.salida_fin_ano && temporada.finDeAno > 0) return 'Un plan para fin de año'
  if (d?.es_crucero) return 'Un crucero para la temporada'
  return p.pais && normalizarTexto(p.pais) === 'colombia' ? 'Un plan nacional para la temporada' : 'Un plan internacional para la temporada'
}

/**
 * Texto fijo por capa, con la estructura aprobada por el dueño (ejemplos del
 * 09-oct-2026): saludo con nombre, por qué le escribimos, UNA pregunta y dos
 * fichas. Sin precios en el texto (el precio va en la ficha), sin urgencia.
 * La línea de baja la agrega después el código, igual que en la variante IA.
 */
export function plantilla(c: {
  segmento: Segmento
  capa: Capa
  nombre?: string
  interes: Interes | null
  lista: ProductoCorto[]
  temporada: Temporada
  destinos: Destino[]
  slugsAnuncio: string[]
}): { mensaje: string; fichas: FichaElegida[] } {
  const porSlug = new Map(c.destinos.map(d => [d.slug, d]))
  // Capa 2: el producto del anuncio va primero.
  const ordenada =
    c.capa === 2 ? [...c.lista.filter(p => c.slugsAnuncio.includes(p.slug)), ...c.lista.filter(p => !c.slugsAnuncio.includes(p.slug))] : c.lista
  const elegidos = ordenada.slice(0, 2)
  const fichas = elegidos.map((p, i) => ({ slug: p.slug, motivo: motivoPlantilla(p, c.temporada, porSlug.get(p.slug), i, c.segmento) }))
  const icono = elegidos[0]?.esCrucero ? '🛳️' : '✈️'
  // "tu viaje a Crucero Disney Caribe" → "el crucero Disney Caribe".
  const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
  const elPlan = (t: string) => (/^crucero/i.test(t) ? `el ${minuscula(t)}` : `el plan ${t}`)
  const dos = elegidos.length >= 2
  const opciones = dos ? 'dos opciones' : 'una opción'

  const saludo = c.nombre ? `Hola ${c.nombre} 👋 Soy Sol, de Travel World Colombia.` : 'Hola 👋 Soy Sol, de Travel World Colombia.'
  const destino = destinoCitable(c.interes?.destino)

  let razon: string
  let pregunta: string
  if (c.capa === 1) {
    if (c.segmento === 'rescate') {
      razon = `Me quedé pensando en ${destino ? (/^crucero/i.test(destino) ? elPlan(destino) : `tu viaje a ${destino}`) : 'el viaje que me contaste'} 💛 Te dejo ${opciones} que te pueden servir para retomarlo.`
      pregunta = '¿Quieres que te arme la cotización con tus fechas?'
    } else {
      razon = `Hace unos días nos escribiste por ${destino ? (/^crucero/i.test(destino) ? elPlan(destino) : `un viaje a ${destino}`) : 'un viaje'} y quería saber si sigues con la idea ${icono} Te dejo ${opciones} para que les eches un ojo.`
      pregunta = '¿Para cuándo lo estás pensando?'
    }
  } else if (c.capa === 2) {
    const producto = elegidos[0]?.nombre ?? 'nuestro plan'
    razon =
      c.segmento === 'rescate'
        ? `Retomando lo que hablamos ${elPlan(producto).replace(/^el /, 'del ').replace(/^(?!del )/, 'de ')} ${icono} Te lo dejo por aquí${dos ? ' con una alternativa, por si quieres compararlas' : ''}.`
        : `Hace unos días nos escribiste por ${elPlan(producto)} ${icono} Te lo dejo por aquí${dos ? ' con una alternativa, por si quieres compararlas' : ''}.`
    pregunta = '¿Te cuento qué fechas tenemos?'
  } else {
    razon = `Ya se acerca ${c.temporada.texto} ${c.temporada.emoji} y quería compartirte ${dos ? 'dos planes' : 'un plan'} que te pueden gustar.`
    pregunta = dos ? '¿Cuál te llama más la atención?' : '¿Te gustaría que te cuente más?'
  }

  return { mensaje: `${saludo}\n\n${razon}\n\n${pregunta}`, fichas }
}

// ---------------------------------------------------------------------------
// Validación (aplica a las DOS variantes por igual)
// ---------------------------------------------------------------------------

export const MAX_CARACTERES = 400
const MAX_MOTIVO_FICHA = 120

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'
const DIAS_SEMANA = 'lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo'

/** Patrones prohibidos: cifras de dinero, porcentajes, escasez/urgencia, fechas concretas. */
const PROHIBIDOS: { nombre: string; re: RegExp }[] = [
  { nombre: 'cifra de dinero', re: /\$\s?\d|\b(usd|cop|us\$)\b|\d[\d.,]*\s?(mil|millones?|palos|k|lucas|pesos|d[oó]lares)\b|\b\d{1,3}(\.\d{3})+\b|\b\d{4,}\b/i },
  { nombre: 'porcentaje', re: /\d\s?%|por\s?ciento/i },
  { nombre: 'cupos', re: /\bcupos?\b/i },
  { nombre: 'escasez/urgencia', re: /(^|[^a-záéíóúñ])[uú]ltim[oa]s?\b|solo por hoy|s[oó]lo hoy|se agota|ag[oó]tal|quedan pocos|no te lo pierdas|antes de que se acabe/i },
  // Demanda inventada ("varias familias ya están armando su plan"): visto en el primer dry-run (09-oct-2026).
  { nombre: 'demanda inventada', re: /est[aá]n reservando|se est[aá]n (llenando|vendiendo|moviendo)|varias familias|muchas (familias|personas)|muchos (clientes|viajeros|est[aá]n|ya)|todo el mundo|m[aá]s (vendid|pedid|reservad|solicitad|buscad)[oa]s?|m[aá]s nos (piden|est[aá]n pidiendo)|\bpopular(es)?\b/i },
  // Voseo: Sol habla con "tú" en español de Colombia (visto en el dry-run: "¿Seguís pensando…?").
  { nombre: 'voseo', re: /\b(segu[ií]s|ten[eé]s|quer[eé]s|pod[eé]s|sab[eé]s|ven[ií]s|viv[ií]s|dec[ií]s|pens[aá]s|prefer[ií]s|contame|decime|avisame|escribime|fijate)\b/i },
  { nombre: 'descuento/oferta', re: /\bdescuentos?\b|\bofertas?\b|\bpromo(ci[oó]n)?(es)?\b|\brebaja/i },
  { nombre: 'fecha concreta', re: new RegExp(`\\b\\d{1,2}\\s*(de\\s+)?(${MESES})\\b|\\b\\d{1,2}[/-]\\d{1,2}\\b|\\b20\\d{2}\\b|\\b(este|el pr[oó]ximo|pr[oó]ximo)\\s+(${DIAS_SEMANA})\\b`, 'i') },
  { nombre: 'enlace o marcador', re: /https?:\/\/|www\.|\[|\]|#btn/i },
  // Promesa de trabajo o de tiempo (dry-run 09-oct: "Mientras te armamos esa opción a la medida"; auditoría: 60 "hoy mismo").
  { nombre: 'promesa', re: /estamos armando|te (lo |la )?estamos (armando|preparando|cotizando)|\bmientras te\b|ya te (armamos|enviamos|mando)|te (env[ií]o|mando|comparto|paso|tengo) (la|tu) cotizaci[oó]n|hoy mismo|en breve|ya mismo|con prioridad|en un momento/i },
]

/** Afirmaciones de "sin visa" (en el texto o en el motivo de una ficha). */
const RE_SIN_VISA = /sin (tr[aá]mite de |necesidad de |pedir |necesitar |requerir )?visa|no (necesitas?|necesitan|requieren?|hace falta|piden?)( la| de)? visa|tampoco (requiere|necesita|pide)n? visa|no la necesitan|no necesitas? la visa/i
/** Un crucero sale del país aunque zarpe de Cartagena (dry-run 09-oct: "Crucero nacional… sin salir del país"). */
const RE_SIN_SALIR = /sin salir del pa[ií]s|crucero nacional/i
/** Lo que solo se puede decir si el cliente lo contó (un silencioso no contó nada). */
const RE_SABER = /\bs[eé] que\b|me contaste|me dijiste|quedamos en|lo que hablamos|tu sue[nñ]o/i

/**
 * Valida la salida (de la IA o de la plantilla) ANTES de enviar. Devuelve la
 * lista de errores (vacía = se puede enviar). Si hay errores NO se cae a la
 * plantilla: se registra `error_validacion` y no se envía, para no mezclar
 * variantes en el A/B.
 *
 * `promo`: si hay promoción del mes, lo que aparezca LITERAL en ella se permite
 * (su cifra o su porcentaje); todo lo demás sigue prohibido.
 */
export function validarSalida(
  salida: { mensaje: string; fichas: FichaElegida[] },
  lista: ProductoCorto[],
  promo: string | null = null,
  segmento?: Segmento
): string[] {
  const errores: string[] = []
  const texto = salida.mensaje.trim()
  if (!texto) errores.push('mensaje vacío')
  if (texto.length > MAX_CARACTERES) errores.push(`mensaje de ${texto.length} caracteres (máx. ${MAX_CARACTERES})`)

  const promoNorm = promo ? promo.toLowerCase() : null
  const revisar = (t: string, donde: string) => {
    for (const { nombre, re } of PROHIBIDOS) {
      const m = t.match(re)
      if (!m) continue
      if (promoNorm && promoNorm.includes(m[0].toLowerCase().trim())) continue
      errores.push(`${donde}: ${nombre} («${m[0].trim()}»)`)
    }
  }
  // Los nombres de los productos de la lista son del catálogo (pueden traer un
  // año o un número, p. ej. "Crucero … 2026"): no cuentan como cifra inventada.
  let sinNombres = texto
  for (const p of lista) {
    const escapado = p.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    sinNombres = sinNombres.replace(new RegExp(escapado, 'gi'), ' ')
  }
  revisar(sinNombres, 'texto')

  const preguntas = (texto.match(/\?/g) ?? []).length
  if (preguntas > 1) errores.push(`${preguntas} preguntas (máx. 1)`)

  if (segmento === 'silencioso' && RE_SABER.test(texto)) errores.push(`texto: da por hecho algo que un silencioso no contó («${texto.match(RE_SABER)?.[0]}»)`)

  // Visa: solo con respaldo del catálogo. En el texto, todas las fichas deben ser "no requiere".
  const porSlugLista = new Map(lista.map(p => [p.slug, p]))
  if (RE_SIN_VISA.test(texto) && !(salida.fichas.length > 0 && salida.fichas.every(f => porSlugLista.get(f.slug)?.visa === 'no_requiere'))) {
    errores.push('texto: dice "sin visa" y el catálogo no lo respalda para todas las fichas')
  }
  for (const f of salida.fichas) {
    if (RE_SIN_VISA.test(f.motivo) && porSlugLista.get(f.slug)?.visa !== 'no_requiere') errores.push(`ficha ${f.slug}: dice "sin visa" y el catálogo no lo respalda`)
  }

  const hayCrucero = salida.fichas.some(f => porSlugLista.get(f.slug)?.esCrucero)
  if (hayCrucero && RE_SIN_SALIR.test(texto)) errores.push('texto: dice que un crucero no sale del país')
  for (const f of salida.fichas) {
    if (porSlugLista.get(f.slug)?.esCrucero && RE_SIN_SALIR.test(f.motivo)) errores.push(`ficha ${f.slug}: dice que un crucero no sale del país`)
  }

  if (salida.fichas.length > 2) errores.push(`${salida.fichas.length} fichas (máx. 2)`)
  const validos = new Set(lista.map(p => p.slug))
  const vistos = new Set<string>()
  for (const f of salida.fichas) {
    if (!validos.has(f.slug)) errores.push(`ficha fuera de la lista corta: ${f.slug}`)
    if (vistos.has(f.slug)) errores.push(`ficha repetida: ${f.slug}`)
    vistos.add(f.slug)
    if (f.motivo.length > MAX_MOTIVO_FICHA) errores.push(`motivo de la ficha ${f.slug} muy largo`)
    revisar(f.motivo, `ficha ${f.slug}`)
  }
  return errores
}

/** Mensaje final: el texto + la línea de baja (siempre la pone el código) + los marcadores de ficha. */
export function componerMensaje(texto: string, fichas: FichaElegida[], lineaBaja: string): string {
  const marcadores = fichas.map(f => `[ficha:${f.slug}|${f.motivo.replace(/[[\]|*\n\r]+/g, ' ').trim()}]`)
  return [`${texto.trim()}\n\n${lineaBaja}`, ...marcadores].join('\n')
}

// ---------------------------------------------------------------------------
// Baja ("SALIR")
// ---------------------------------------------------------------------------

/**
 * Frases de baja. Lista CORTA y conservadora a propósito: comparación exacta
 * (normalizada), nunca "contiene". "Quiero salir de viaje en diciembre" no es
 * una baja; "SALIR" o "no me escriban más" sí.
 */
const FRASES_BAJA = new Set([
  'salir',
  'stop',
  'no me escriban',
  'no me escriban mas',
  'no me escribas',
  'no me escribas mas',
  'no quiero mas mensajes',
  'no quiero recibir mas mensajes',
  'no me envien mas mensajes',
  'no me manden mas mensajes',
  'no me sigan escribiendo',
])

export function esBaja(texto: string | null | undefined): boolean {
  if (!texto) return false
  let t = normalizarTexto(texto)
  // Cortesías alrededor: "SALIR por favor", "gracias, no me escriban más".
  t = t.replace(/^(gracias|por favor|porfa|porfavor)\s+/, '').replace(/\s+(gracias|por favor|porfa|porfavor)$/, '')
  return FRASES_BAJA.has(t)
}
