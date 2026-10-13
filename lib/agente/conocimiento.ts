import { getDestinos } from '@/lib/destinos'
import { getFaqs } from '@/lib/faqs'
import { SITE } from '@/lib/site'
import type { Destino } from '@/types/destino'

/**
 * Base de conocimiento de Sol, leída en vivo de Supabase. Se sirve en DOS capas
 * para no gastar tokens en cada mensaje (la mayoría de consultas ni tocan el
 * catálogo, o piden destinos a la medida):
 *
 * 1. `base` — ÍNDICE LIGERO: los ~11 destinos como una línea (nombre, país,
 *    precio desde, link) + FAQ + datos de la agencia. Es estable e idéntico para
 *    todas las conversaciones, así que va en el bloque cacheado del prompt.
 * 2. `detallesPara(texto)` — DETALLE COMPLETO (descripción, incluye, itinerario,
 *    experiencias) SOLO de los destinos que el cliente menciona en la
 *    conversación. Va en la parte NO cacheada, fresca por turno.
 *
 * Así Sol siempre sabe qué vendemos y a qué precio (barato), y solo carga el
 * detalle pesado cuando de verdad hace falta.
 */

/** Recorta muros de texto: cada carácter del detalle se paga cuando se incluye. */
function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length <= max ? limpio : `${limpio.slice(0, max).trimEnd()}…`
}

/** minúsculas + sin acentos, para emparejar "panama" con "Panamá". */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Nombres por los que un cliente podría referirse a un destino.
 *
 * SOLO nombre, nombre local y slug. Antes también entraban `pais` y `region`,
 * y eso metía el detalle completo de medio catálogo en cada turno: "Colombia"
 * disparaba 19 destinos y "Caribe" otros 10 (medido el 2026-09-16 con historial
 * real: 16 destinos por turno en promedio, ~7.900 tokens sin caché por llamada,
 * el 53% de la factura de Sol). Si el cliente habla de un país sin nombrar un
 * programa, le basta el índice ligero del bloque cacheado.
 */
function aliasesDe(d: Destino): string[] {
  // El nombre corto (antes de la coma o el guion): "Crucero Cartagena, Colombia"
  // → "crucero cartagena"; nadie escribe el nombre completo de la ficha.
  const corto = d.nombre?.split(/\s*[,·|(]\s*|\s+-\s+/)[0]
  // El barco, si la ficha lo nombra: "a bordo del Norwegian Luna".
  const barcos = [...`${d.frase_hero ?? ''} ${d.descripcion ?? ''}`.matchAll(/\b(?:norwegian|royal caribbean|msc|carnival|celebrity|disney)\s+[a-z]+/gi)].map(m => m[0])
  return [d.nombre, d.nombre_local, d.slug?.replace(/-/g, ' '), corto, ...barcos]
    .filter((x): x is string => Boolean(x && x.trim()))
    .map(normalizar)
    .filter(a => a.length >= 4) // evita falsos positivos con palabras cortas
}

/** Palabras que no distinguen un crucero de otro. */
const GENERICAS_CRUCERO = new Set(['crucero', 'cruceros', 'colombia', 'florida', 'caribe', 'desde', 'noches', 'dias'])

/**
 * Cruceros: "crucero desde Miami" o "el de La Romana" no traen el nombre de la
 * ficha ("Crucero por el Caribe - Joyas de ensueño…"). Si la conversación habla
 * de cruceros y nombra el puerto (palabra distintiva del slug), cuenta como
 * mencionado. Devuelve la última posición o -1. Caso real 13-oct: Sol no veía
 * la ficha del Norwegian Luna y no sabía su fecha de salida.
 */
function posCrucero(d: Destino, t: string): number {
  if (!d.es_crucero || !t.includes('crucer')) return -1
  const claves = (d.slug ?? '').split('-').filter(p => p.length >= 5 && !GENERICAS_CRUCERO.has(p))
  return Math.max(-1, ...claves.map(c => t.lastIndexOf(c)))
}

/** Tope de destinos MENCIONADOS con detalle completo por turno (cada uno pesa ~500 tokens). */
const MAX_DETALLES = 4
/** Tope total contando los programas del anuncio por el que llegó el cliente. */
const MAX_DETALLES_TOTAL = 6

const MES_CORTO: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
}
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * "Vie 5 Mar" (fecha del día 1 del itinerario, sin año) → "5 de marzo de 2027":
 * la próxima vez que cae esa fecha a partir de hoy.
 */
export function fechaConAnio(texto: string | undefined, hoy = new Date()): string | null {
  const m = (texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3})/)
  if (!m) return null
  const mes = MES_CORTO[m[2]]
  const dia = Number(m[1])
  if (mes === undefined || dia < 1 || dia > 31) return null
  const hoyIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(hoy)
  let anio = Number(hoyIso.slice(0, 4))
  const iso = (a: number) => `${a}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  if (iso(anio) < hoyIso) anio++
  return `${dia} de ${NOMBRE_MES[mes]} de ${anio}`
}

/**
 * Salidas del programa. Sin esto Sol no sabía cuándo sale nada (el itinerario
 * le llegaba sin fechas): aplazaba "las fechas te las confirmo" o validaba
 * meses sin salida (auditorías del 13-oct-2026).
 */
function lineaSalidas(d: Destino): string | null {
  const textos = [d.frase_hero, d.autor_frase, d.cargo_autor, d.subtitulo, d.cta_titulo, d.cta_subtitulo]
    .map(t => t?.replace(/\s+/g, ' ').trim())
    .filter((t): t is string => Boolean(t && /salida|sale el|zarpa/i.test(t)))
  const primerDia = fechaConAnio(d.itinerario?.[0]?.fecha)
  const partes = [
    ...textos.map(t => `«${recortar(t, 160)}»`),
    primerDia ? `el itinerario de la ficha arranca el ${primerDia}${textos.length ? ' (es una de las salidas; no digas que es la única si el texto habla de varias)' : ''}` : null,
  ].filter(Boolean)
  return partes.length
    ? `- salidas: ${partes.join(' · ')} (si el cliente pide otra fecha o mes, dile cuáles hay; no confirmes fechas que no estén aquí)`
    : '- salidas: no publicadas en la ficha (si piden una fecha, se confirma en la cotización; no digas que "encaja")'
}

/** El detalle pesado de un destino (lo que NO va en el índice ligero). */
function bloqueDetalle(d: Destino): string {
  const partes = [
    `### ${d.nombre}${d.nombre_local ? ` (${d.nombre_local})` : ''}`,
    d.precio_desde ? `- precio desde: ${d.precio_desde}` : '- precio: no publicado (se confirma en la cotización)',
    d.duracion ? `- duración: ${d.duracion}` : null,
    lineaSalidas(d),
    d.descripcion ? `- descripción: ${recortar(d.descripcion, 320)}` : null,
    d.incluye?.length ? `- incluye: ${recortar(d.incluye.join(' · '), 400)}` : null,
    d.no_incluye?.length ? `- NO incluye: ${recortar(d.no_incluye.join(' · '), 200)}` : null,
    d.itinerario?.length
      ? `- itinerario: ${d.itinerario.map((x, i) => `D${i + 1} ${x.titulo}`).join(' | ')}`
      : null,
    d.highlights?.length
      ? `- experiencias: ${d.highlights.map(h => h.titulo.trim() + (h.duracion ? `, ${h.duracion}` : '') + (h.precio ? ` (${h.precio})` : '')).join(' · ')}`
      : null,
    d.hospedaje?.length
      ? `- hospedaje: ${recortar(d.hospedaje.map(o => {
          const cat = o.estrellas ? `${o.estrellas}★ ` : ''
          const hoteles = (o.ciudades ?? []).map(c => `${c.nombre}: ${c.hoteles.join(', ')}`).join(' / ')
          const habs = (o.habitaciones ?? []).map(h => h.tipo + (h.precio ? ` ${h.precio}` : '')).join(', ')
          return `${cat}${o.titulo}${hoteles ? ` [${hoteles}]` : ''}${habs ? ` (hab: ${habs})` : ''}`
        }).join(' · '), 500)}`
      : null,
    `- página: ${SITE.url}/destinos/${d.slug}`,
  ]
  return partes.filter(Boolean).join('\n')
}

export interface Conocimiento {
  /** Índice ligero + FAQ + agencia. Estable y cacheable. */
  base: string
  /**
   * Detalle completo de los destinos mencionados en `texto` ('' si ninguno).
   * `slugsExtra`: programas que entran aunque nadie los haya nombrado (los del
   * anuncio por el que llegó el cliente); van después de los mencionados.
   */
  detallesPara: (texto: string, slugsExtra?: string[]) => string
  /** Nombre de un destino del catálogo por su slug. */
  nombreDe: (slug: string) => string | undefined
}

export async function construirConocimiento(): Promise<Conocimiento> {
  const [destinos, faqs] = await Promise.all([getDestinos(), getFaqs()])

  const indice = destinos
    .map(d => {
      const local = d.nombre_local ? ` (${d.nombre_local})` : ''
      const lugar = [d.pais, d.region].filter(Boolean).join(', ')
      const precio = d.precio_desde ? `desde ${d.precio_desde}` : 'precio a confirmar'
      const foto = d.imagen_hero || d.imagen_thumb || d.galeria?.[0] ? ' · 📷' : ''
      // Categorías del panel (ej. "Cruceros · Sin visa"): Sol puede responder
      // "¿qué cruceros sin visa tienen?" o "¿qué planes todo incluido hay?".
      const cats = d.etiquetas?.length ? ` · [${d.etiquetas.join('; ')}]` : ''
      return `- **${d.nombre}**${local}${lugar ? ` — ${lugar}` : ''} — ${precio}${cats}${foto} · ${SITE.url}/destinos/${d.slug}`
    })
    .join('\n')

  const preguntas = faqs.length
    ? faqs.map(f => `**${f.pregunta}**\n${f.respuesta}`).join('\n\n')
    : '(sin preguntas frecuentes publicadas)'

  const base = `## Catálogo de viajes — índice (${destinos.length} programas activos)

Estos son los ÚNICOS programas ya armados que vende la agencia, con su precio de
referencia; entre corchetes van sus categorías (ej. Cruceros · Sin visa, Todo
incluido), útiles si el cliente busca por tipo de plan. Si el cliente pregunta
por un destino que NO está en esta lista, se arma a la medida (se cotiza
aparte) — enmárcalo en positivo, sin decir que no está publicado. Cuando el cliente se interese por uno de esta lista, su
detalle completo (qué incluye, itinerario…) aparecerá más abajo en el contexto.

${indice}

## Preguntas frecuentes

${preguntas}

## Datos de la agencia

- Nombre: ${SITE.nombre} (RNT ${SITE.rnt})
- Web: ${SITE.url} · Correo: ${SITE.email}
- Dirección: ${SITE.direccion}, ${SITE.ciudad}, ${SITE.region}
- Horario de atención (hora de Colombia): ${SITE.horario}
`

  const detallesPara = (texto: string, slugsExtra: string[] = []): string => {
    const t = normalizar(texto)
    // Los mencionados más recientemente van primero: si la conversación pasó
    // por varios destinos, el tope se queda con los que están sobre la mesa.
    const mencionados = destinos
      .map(d => ({ d, pos: Math.max(posCrucero(d, t), ...aliasesDe(d).map(a => t.lastIndexOf(a))) }))
      .filter(x => x.pos >= 0)
      .sort((a, b) => b.pos - a.pos)
      .slice(0, MAX_DETALLES)
      .map(x => x.d)
    // Después, los del anuncio que aún no estén (el cliente vino por ellos
    // aunque no los haya escrito), hasta el tope total.
    const extra = slugsExtra
      .map(s => destinos.find(d => d.slug === s))
      .filter((d): d is Destino => Boolean(d) && !mencionados.includes(d!))
    const elegidos = [...mencionados, ...extra].slice(0, MAX_DETALLES_TOTAL)
    return elegidos.map(bloqueDetalle).join('\n\n')
  }

  const nombreDe = (slug: string) => destinos.find(d => d.slug === slug)?.nombre

  return { base, detallesPara, nombreDe }
}

const RE_FOTO = /\[foto:\s*([a-z0-9-]+)\s*\]/gi

/**
 * Convierte los marcadores `[foto:slug]` que Sol pone en su mensaje en imágenes
 * adjuntas: quita el marcador del texto y resuelve la URL hero (pública, de
 * Supabase Storage) del destino del catálogo. Solo destinos del catálogo (los a
 * la medida no tienen foto). Máximo UNA foto por mensaje.
 */
export async function extraerFotos(texto: string): Promise<{ texto: string; imagenes: string[] }> {
  const slugs = [...texto.matchAll(RE_FOTO)].map(m => m[1].toLowerCase())
  const limpio = texto
    .replace(RE_FOTO, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (slugs.length === 0) return { texto: limpio, imagenes: [] }

  const destinos = await getDestinos()
  const porSlug = new Map(destinos.map(d => [d.slug, d]))
  const imagenes: string[] = []
  for (const s of slugs) {
    const d = porSlug.get(s)
    const url = d?.imagen_hero || d?.imagen_thumb || d?.galeria?.[0]
    if (url && !imagenes.includes(url)) imagenes.push(url)
    if (imagenes.length >= 1) break // una sola foto por mensaje
  }
  return { texto: limpio, imagenes }
}
