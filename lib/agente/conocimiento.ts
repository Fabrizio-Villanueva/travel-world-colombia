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
  return [d.nombre, d.nombre_local, d.slug?.replace(/-/g, ' ')]
    .filter((x): x is string => Boolean(x && x.trim()))
    .map(normalizar)
    .filter(a => a.length >= 4) // evita falsos positivos con palabras cortas
}

/** Tope de destinos con detalle completo por turno (cada uno pesa ~500 tokens). */
const MAX_DETALLES = 4

/** El detalle pesado de un destino (lo que NO va en el índice ligero). */
function bloqueDetalle(d: Destino): string {
  const partes = [
    `### ${d.nombre}${d.nombre_local ? ` (${d.nombre_local})` : ''}`,
    d.precio_desde ? `- precio desde: ${d.precio_desde}` : '- precio: no publicado (lo confirma una asesora)',
    d.duracion ? `- duración: ${d.duracion}` : null,
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
  /** Detalle completo de los destinos mencionados en `texto` ('' si ninguno). */
  detallesPara: (texto: string) => string
}

export async function construirConocimiento(): Promise<Conocimiento> {
  const [destinos, faqs] = await Promise.all([getDestinos(), getFaqs()])

  const indice = destinos
    .map(d => {
      const local = d.nombre_local ? ` (${d.nombre_local})` : ''
      const lugar = [d.pais, d.region].filter(Boolean).join(', ')
      const precio = d.precio_desde ? `desde ${d.precio_desde}` : 'precio a confirmar'
      const foto = d.imagen_hero || d.imagen_thumb || d.galeria?.[0] ? ' · 📷' : ''
      return `- **${d.nombre}**${local}${lugar ? ` — ${lugar}` : ''} — ${precio}${foto} · ${SITE.url}/destinos/${d.slug}`
    })
    .join('\n')

  const preguntas = faqs.length
    ? faqs.map(f => `**${f.pregunta}**\n${f.respuesta}`).join('\n\n')
    : '(sin preguntas frecuentes publicadas)'

  const base = `## Catálogo de viajes — índice (${destinos.length} programas activos)

Estos son los ÚNICOS programas ya armados que vende la agencia, con su precio de
referencia. Si el cliente pregunta por un destino que NO está en esta lista, se
arma a la medida (lo cotiza una asesora) — enmárcalo en positivo, sin decir que
no está publicado. Cuando el cliente se interese por uno de esta lista, su
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

  const detallesPara = (texto: string): string => {
    const t = normalizar(texto)
    // Los mencionados más recientemente van primero: si la conversación pasó
    // por varios destinos, el tope se queda con los que están sobre la mesa.
    const relevantes = destinos
      .map(d => ({ d, pos: Math.max(...aliasesDe(d).map(a => t.lastIndexOf(a))) }))
      .filter(x => x.pos >= 0)
      .sort((a, b) => b.pos - a.pos)
      .slice(0, MAX_DETALLES)
    return relevantes.map(x => bloqueDetalle(x.d)).join('\n\n')
  }

  return { base, detallesPara }
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
