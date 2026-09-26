import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDestinos } from '@/lib/destinos'
import type { Destino } from '@/types/destino'

/**
 * Anuncios de Meta (clic a WhatsApp) y su vínculo con el catálogo.
 *
 * Cuando un cliente escribe desde un anuncio, GHL reenvía en el webhook la
 * etiqueta del anuncio (id, título, texto completo, app, tipo de pieza). Aquí:
 *
 *  1. `extraerReferral` la lee del payload crudo.
 *  2. `registrarAnuncio` guarda el anuncio y por cuál llegó cada conversación.
 *  3. `anuncioParaConversacion` devuelve el anuncio de una conversación con su
 *     vínculo al catálogo YA resuelto: la primera vez que aparece un anuncio (o
 *     cuando el catálogo cambió), el modelo lee el texto del anuncio junto con
 *     el índice del catálogo y decide a qué programas corresponde. Nadie tiene
 *     que pegar ids a mano: subir y bajar anuncios no requiere mantenimiento.
 *
 * Nada de esto puede tumbar un turno de Sol: todo captura sus errores y, en el
 * peor caso, Sol responde sin saber del anuncio (como hasta ahora).
 */

export interface ReferralMeta {
  adId: string
  titulo?: string
  texto?: string
  sourceApp?: string
  mediaType?: string
  sourceUrl?: string
  ctwaClid?: string
}

export type EstadoVinculo = 'pendiente' | 'auto' | 'manual' | 'ninguno'

export interface AnuncioContexto {
  adId: string
  /** Nombre corto para humanos y para la fuente del lead ("Crucero Disney Caribe"). */
  nombre: string
  titulo?: string
  texto?: string
  sourceApp?: string
  /** Programas del catálogo a los que corresponde el anuncio ([] si no está). */
  slugs: string[]
  vinculo: EstadoVinculo
}

interface FilaAnuncio {
  ad_id: string
  titulo: string | null
  texto: string | null
  source_app: string | null
  media_type: string | null
  source_url: string | null
  nombre: string | null
  slugs: string[] | null
  vinculo: EstadoVinculo
  vinculo_motivo: string | null
  catalogo_firma: string | null
  leads: number
}

/** Lee la etiqueta del anuncio del payload crudo del webhook (campos de nivel superior). */
export function extraerReferral(crudo: unknown): ReferralMeta | null {
  if (!crudo || typeof crudo !== 'object') return null
  const o = crudo as Record<string, unknown>
  const s = (k: string): string | undefined => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim() : undefined
  }
  const adId = s('source_id')
  if (!adId || !/^\d+$/.test(adId)) return null
  return {
    adId,
    titulo: s('title'),
    texto: s('body'),
    sourceApp: s('source_app'),
    mediaType: s('media_type'),
    sourceUrl: s('source_url'),
    ctwaClid: s('ctwa_clid'),
  }
}

/**
 * Registra el anuncio (si es nuevo) y la conversación que llegó por él. Cuenta
 * un lead por conversación, no por mensaje (GHL repite la etiqueta en varios
 * mensajes de la misma conversación).
 */
export async function registrarAnuncio(
  ref: ReferralMeta,
  conversationId: string,
  contactId?: string
): Promise<void> {
  try {
    const admin = createAdminClient()
    const ahora = new Date().toISOString()

    const { data: existente } = await admin
      .from('agente_anuncios')
      .select('ad_id, titulo, texto, vinculo')
      .eq('ad_id', ref.adId)
      .maybeSingle()

    if (existente) {
      // Solo se completa lo que falte: el texto de la primera vez manda, así el
      // vínculo automático no cambia porque Meta varíe el headline. Los clics
      // desde estados de WhatsApp llegan SIN texto y con título genérico; si el
      // texto aparece después (mismo anuncio visto en Instagram/Facebook), el
      // vínculo vuelve a 'pendiente' para que el modelo lo decida con el texto.
      const cambios: Record<string, string> = { ultima_vez: ahora }
      if (!existente.texto && ref.texto) {
        cambios.texto = ref.texto
        if (existente.vinculo !== 'manual') cambios.vinculo = 'pendiente'
      }
      if (esTituloGenerico(existente.titulo) && ref.titulo && !esTituloGenerico(ref.titulo)) {
        cambios.titulo = ref.titulo
      }
      const { error } = await admin.from('agente_anuncios').update(cambios).eq('ad_id', ref.adId)
      if (error) console.error('registrarAnuncio (update) error:', error.message)
    } else {
      const { error } = await admin.from('agente_anuncios').insert({
        ad_id: ref.adId,
        titulo: ref.titulo ?? null,
        texto: ref.texto ?? null,
        source_app: ref.sourceApp ?? null,
        media_type: ref.mediaType ?? null,
        source_url: ref.sourceUrl ?? null,
        primera_vez: ahora,
        ultima_vez: ahora,
      })
      // Una carrera entre dos mensajes del mismo anuncio nuevo choca en la PK:
      // no es un problema, el otro ya lo insertó.
      if (error && error.code !== '23505') console.error('registrarAnuncio (insert) error:', error.message)
    }

    const { data: conv } = await admin
      .from('agente_conversacion_anuncio')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .maybeSingle()
    if (conv) return

    const { error: errConv } = await admin.from('agente_conversacion_anuncio').insert({
      conversation_id: conversationId,
      contact_id: contactId ?? null,
      ad_id: ref.adId,
      ctwa_clid: ref.ctwaClid ?? null,
      visto_en: ahora,
    })
    if (errConv) {
      if (errConv.code !== '23505') console.error('registrarAnuncio (conversación) error:', errConv.message)
      return
    }

    const { data: fila } = await admin.from('agente_anuncios').select('leads').eq('ad_id', ref.adId).maybeSingle()
    await admin
      .from('agente_anuncios')
      .update({ leads: (fila?.leads ?? 0) + 1 })
      .eq('ad_id', ref.adId)
  } catch (err) {
    console.error('registrarAnuncio excepción:', (err as Error).message)
  }
}

/**
 * El anuncio por el que llegó una conversación, con el vínculo al catálogo
 * resuelto (llama al modelo si hace falta). null si no vino de un anuncio o si
 * algo falla: Sol sigue sin ese dato, nunca se cae el turno.
 */
export async function anuncioParaConversacion(conversationId: string): Promise<AnuncioContexto | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('agente_conversacion_anuncio')
      .select('ad_id, anuncio:agente_anuncios(*)')
      .eq('conversation_id', conversationId)
      .maybeSingle()
    if (error || !data) return null

    const bruto = (data as { anuncio: FilaAnuncio | FilaAnuncio[] | null }).anuncio
    const fila = Array.isArray(bruto) ? bruto[0] : bruto
    if (!fila) return null

    const destinos = await getDestinos()
    const resuelta = await asegurarVinculo(fila, destinos)
    return aContexto(resuelta, destinos)
  } catch (err) {
    console.error('anuncioParaConversacion excepción:', (err as Error).message)
    return null
  }
}

/** Fuerza el vínculo automático de un anuncio (botón del panel). */
export async function revincularAnuncio(adId: string): Promise<AnuncioContexto | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('agente_anuncios').select('*').eq('ad_id', adId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const destinos = await getDestinos()
  const fila = await vincularConModelo(data as FilaAnuncio, destinos)
  return aContexto(fila, destinos)
}

function aContexto(fila: FilaAnuncio, destinos: Destino[]): AnuncioContexto {
  const activos = new Set(destinos.map(d => d.slug))
  return {
    adId: fila.ad_id,
    nombre: nombreDe(fila),
    titulo: fila.titulo ?? undefined,
    texto: fila.texto ?? undefined,
    sourceApp: fila.source_app ?? undefined,
    // Un programa que se ocultó del catálogo deja de inyectarse aunque siga vinculado.
    slugs: (fila.slugs ?? []).filter(s => activos.has(s)),
    vinculo: fila.vinculo,
  }
}

/**
 * El headline suele ser genérico (el nombre de la agencia, "Anuncio en estados"
 * en los clics desde estados de WhatsApp): no dice qué vende y confunde al
 * clasificador ("estados" → Estados Unidos, visto el 2026-09-26).
 */
function esTituloGenerico(titulo: string | null | undefined): boolean {
  const t = (titulo ?? '').trim()
  return !t || /^(travel world colombia|anuncio en estados)$/i.test(t)
}

/** Nombre corto para humanos: el que derivó el modelo, si no el título, si no el arranque del texto. */
export function nombreDe(fila: Pick<FilaAnuncio, 'ad_id' | 'nombre' | 'titulo' | 'texto'>): string {
  if (fila.nombre?.trim()) return fila.nombre.trim()
  if (!esTituloGenerico(fila.titulo)) return fila.titulo!.trim()
  const arranque = (fila.texto ?? '').replace(/\s+/g, ' ').trim()
  if (arranque) return arranque.length > 60 ? `${arranque.slice(0, 57).trimEnd()}…` : arranque
  return `Anuncio ${fila.ad_id}`
}

/**
 * Firma del catálogo activo: si cambia (se subió o se ocultó un programa), los
 * vínculos automáticos se re-evalúan con el siguiente lead. Así un anuncio que
 * quedó "sin producto" se vincula solo cuando el producto se sube al sitio.
 */
export function firmaCatalogo(destinos: Destino[]): string {
  const slugs = destinos.map(d => d.slug).sort().join('|')
  return createHash('sha1').update(slugs).digest('hex').slice(0, 16)
}

async function asegurarVinculo(fila: FilaAnuncio, destinos: Destino[]): Promise<FilaAnuncio> {
  if (fila.vinculo === 'manual') return fila
  const firma = firmaCatalogo(destinos)
  if (fila.vinculo !== 'pendiente' && fila.catalogo_firma === firma) return fila
  try {
    return await vincularConModelo(fila, destinos)
  } catch (err) {
    // Se reintenta con el siguiente lead; mientras tanto Sol usa el texto del anuncio.
    console.error('vincularConModelo falló:', (err as Error).message)
    return fila
  }
}

let cliente: Anthropic | null = null
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  cliente ??= new Anthropic()
  return cliente
}

/**
 * El modelo lee el anuncio y el índice del catálogo y decide el vínculo. Una
 * llamada corta (Sonnet 5, esfuerzo bajo) UNA vez por anuncio; el resultado
 * queda guardado con la firma del catálogo con que se decidió.
 */
async function vincularConModelo(fila: FilaAnuncio, destinos: Destino[]): Promise<FilaAnuncio> {
  const admin = createAdminClient()
  const firma = firmaCatalogo(destinos)

  // Sin el texto de la pieza no hay con qué clasificar: un título genérico solo
  // produce vínculos inventados. Queda 'pendiente' hasta que llegue el texto.
  const cuerpo = (fila.texto ?? '').trim()
  const textoAnuncio = [esTituloGenerico(fila.titulo) ? null : fila.titulo, cuerpo].filter(Boolean).join('\n').trim()
  let nombre = fila.nombre ?? null
  let slugs: string[] = []
  let motivo = 'el anuncio no trae texto'

  if (!cuerpo) {
    const cambios = { vinculo: 'pendiente' as EstadoVinculo, vinculo_motivo: 'el anuncio llegó sin texto (clic desde estados de WhatsApp); se vincula cuando llegue' }
    const { error } = await admin.from('agente_anuncios').update(cambios).eq('ad_id', fila.ad_id)
    if (error) throw new Error(error.message)
    return { ...fila, ...cambios }
  }

  if (destinos.length > 0) {
    const indice = destinos
      .map(d => {
        const lugar = [d.pais, d.region].filter(Boolean).join(', ')
        const precio = d.precio_desde ? `desde ${d.precio_desde}` : 'sin precio publicado'
        return `- slug: ${d.slug} · ${d.nombre}${d.nombre_local ? ` (${d.nombre_local})` : ''}${lugar ? ` · ${lugar}` : ''} · ${precio}${d.es_crucero ? ' · [crucero]' : ''}${d.duracion ? ` · ${d.duracion}` : ''}`
      })
      .join('\n')

    const respuesta = await anthropic().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      system: `Clasificas anuncios de una agencia de viajes colombiana contra su catálogo de programas.

Dado el texto de un anuncio y el índice del catálogo, decide a qué programas corresponde:
1. Si el anuncio promociona UN programa concreto (mismo destino, mismo tipo de viaje, mismas fechas o barco si las menciona), devuelve solo ese slug.
2. Si el anuncio es de una CATEGORÍA (p. ej. "cruceros" en general, "Europa" en general), devuelve los programas de esa categoría (máximo 6).
3. Si el producto del anuncio NO existe en el catálogo (otro destino, otro barco, otras fechas claramente distintas), devuelve la lista vacía. Mejor vacío que un programa parecido pero distinto: un vínculo equivocado hace que la asistente venda otra cosa.

Además, da un nombre corto (2 a 5 palabras, en español, sin comillas) que diga qué vende el anuncio, p. ej. "Crucero Disney Caribe" o "Crucero fin de año Cartagena".`,
      messages: [
        {
          role: 'user',
          content: `## Anuncio\n\n${textoAnuncio.slice(0, 2500)}\n\n## Catálogo\n\n${indice}`,
        },
      ],
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              nombre_corto: { type: 'string' },
              slugs: { type: 'array', items: { type: 'string', enum: destinos.map(d => d.slug) } },
              motivo: { type: 'string', description: 'Una frase: por qué ese vínculo (o por qué ninguno).' },
            },
            required: ['nombre_corto', 'slugs', 'motivo'],
            additionalProperties: false,
          } as never,
        },
      },
    })

    const texto = respuesta.content.find(b => b.type === 'text')
    if (respuesta.stop_reason !== 'refusal' && texto?.type === 'text') {
      const r = JSON.parse(texto.text) as { nombre_corto: string; slugs: string[]; motivo: string }
      const validos = new Set(destinos.map(d => d.slug))
      slugs = [...new Set(r.slugs.filter(s => validos.has(s)))].slice(0, 6)
      motivo = r.motivo?.trim() || motivo
      if (r.nombre_corto?.trim()) nombre = r.nombre_corto.trim().slice(0, 60)
    }
  } else {
    motivo = 'el catálogo está vacío'
  }

  const cambios = {
    nombre,
    slugs,
    vinculo: (slugs.length ? 'auto' : 'ninguno') as EstadoVinculo,
    vinculo_motivo: motivo,
    catalogo_firma: firma,
  }
  const { error } = await admin.from('agente_anuncios').update(cambios).eq('ad_id', fila.ad_id)
  if (error) throw new Error(error.message)
  return { ...fila, ...cambios }
}
