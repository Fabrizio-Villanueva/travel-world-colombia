import { createAdminClient } from '@/lib/supabase/admin'
import { ETAPA_GANADA, MANTENIMIENTO_OPP, PIPELINE, PIPELINE_RESERVACIONES, TAGS } from '@/lib/agente/config'
import {
  buscarOportunidades,
  fijarFuenteOportunidad,
  fijarValorOportunidad,
  type OportunidadBusquedaGhl,
} from '@/lib/agente/ghl'
import { nombreDe } from '@/lib/agente/anuncios'
import {
  CAMPO_FUENTE_LEAD,
  fuenteDelLead,
  fuenteSobrescribible,
  textoCampo,
  valorDudoso,
  valorPendiente,
} from '@/lib/agente/opp-reglas'

/**
 * Mantenimiento de dos datos de la oportunidad que los reportes de GHL
 * necesitan y que nadie llena a mano. Corre con el cron de etapas (cada 10 min).
 * No mueve etapas ni asigna: el avance de etapas sigue teniendo un solo
 * responsable (lib/agente/etapas.ts y, en post-venta, automatizarReserva).
 *
 * 1. FUENTE (auditoría 09-oct-2026): el `source` nativo dice "lead" (lo fija el
 *    workflow E-01) o está vacío, así que el reporte de fuentes de GHL no sirve.
 *    Aquí se escribe la fuente real (anuncio de origen → tag de anuncio → canal)
 *    en las tarjetas abiertas de 🎯 Leads cuyo source está vacío o es "lead", y
 *    en "Fuente del lead" si está vacío. Una tarjeta sin conversación conocida
 *    (creada a mano) no se toca.
 *
 * 2. VALOR: solo el 32 % de las ventas de octubre tenía valor en la tarjeta.
 *    `automatizarReserva` lo copia al guardar en el Generador, pero no cubre
 *    las ventas que nunca pasan por él (marcadas Ganada a mano, o editadas
 *    mientras la tarjeta aún estaba en Leads: ahí `automatizarReserva` no
 *    actúa porque solo mira 🗂️ Reservaciones). Aquí, para toda tarjeta de
 *    🗂️ Reservaciones o de ✅ Ganada (no perdida/abandonada) SIN valor y con
 *    "Total Pasajeros - Valor Total" ≥ 100.000 → se fija el valor. Las que ya
 *    tienen un valor distinto o un total absurdo solo se reportan.
 */

export interface ResumenFuentes {
  revisadas: number
  candidatas: number
  escritas: { id: string; fuente: string; nativa: boolean }[]
  sinDatos: number
  /** false si GHL rechazó o ignoró `source` en el PUT: desde ahí solo se llena "Fuente del lead". */
  sourceNativoAceptado: boolean | null
  errores: number
}

export interface ResumenValores {
  revisadas: number
  fijadas: { id: string; antes: number; valor: number }[]
  /** "Valor Total" absurdo (< 100.000 COP): no se copia, para revisar a mano. */
  dudosas: { id: string; valor: number; total: number }[]
  /** La tarjeta ya tiene un valor (puesto a mano) distinto del campo: no se pisa, para revisar. */
  distintas: { id: string; valor: number; total: number }[]
  errores: number
}

/**
 * ¿GHL guarda `source` en el PUT? null = aún no se sabe en esta instancia. Si
 * lo rechaza o lo ignora, no se insiste (si no, cada corrida reescribiría las
 * mismas tarjetas sin efecto).
 */
let sourceNativoAceptado: boolean | null = null

const DIA_MS = 86_400_000

async function enLotes<T, R>(items: T[], tam: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = []
  for (let i = 0; i < items.length; i += tam) salida.push(...(await Promise.all(items.slice(i, i + tam).map(fn))))
  return salida
}

/** Anuncio de origen de cada contacto (el más reciente visto hasta un día después de crear la tarjeta). */
async function anunciosPorContacto(
  candidatas: OportunidadBusquedaGhl[]
): Promise<Map<string, string>> {
  const admin = createAdminClient()
  const ids = [...new Set(candidatas.map(o => o.contactId!).filter(Boolean))]
  const filas: { contact_id: string; visto_en: string; anuncio: unknown }[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await admin
      .from('agente_conversacion_anuncio')
      .select('contact_id, visto_en, anuncio:agente_anuncios(ad_id, nombre, titulo, texto)')
      .in('contact_id', ids.slice(i, i + 100))
    if (error) throw new Error(`no se pudo leer agente_conversacion_anuncio: ${error.message}`)
    filas.push(...((data ?? []) as typeof filas))
  }
  const creada = new Map(candidatas.map(o => [o.contactId!, Date.parse(o.createdAt ?? '') || Date.now()]))
  const elegido = new Map<string, { visto: number; nombre: string }>()
  for (const f of filas) {
    const bruto = f.anuncio as { ad_id: string; nombre: string | null; titulo: string | null; texto: string | null } | null
    const anuncio = Array.isArray(bruto) ? bruto[0] : bruto
    if (!anuncio) continue
    const visto = Date.parse(f.visto_en)
    // Un anuncio por el que llegó DESPUÉS de crear la tarjeta no es su origen.
    if (visto > (creada.get(f.contact_id) ?? Date.now()) + DIA_MS) continue
    const previo = elegido.get(f.contact_id)
    if (!previo || visto > previo.visto) elegido.set(f.contact_id, { visto, nombre: nombreDe(anuncio) })
  }
  return new Map([...elegido].map(([k, v]) => [k, v.nombre]))
}

/**
 * Canal (messageType) del primer mensaje del cliente alrededor de la creación
 * de la tarjeta (de 12 h antes a 2 días después; si no hay, el último antes).
 * Un mensaje muy posterior no dice por dónde llegó el lead: ahí, null.
 */
async function canalDe(contactId: string, creadaEn: string | undefined): Promise<string | null> {
  const admin = createAdminClient()
  const creada = Date.parse(creadaEn ?? '') || Date.now()
  const desde = new Date(creada - 12 * 3_600_000).toISOString()
  const hasta = new Date(creada + 2 * DIA_MS).toISOString()
  const base = () =>
    admin
      .from('agente_eventos')
      .select('canal')
      .eq('contact_id', contactId)
      .eq('autor', 'cliente')
      .not('canal', 'is', null)
  const { data } = await base()
    .gte('recibido_en', desde)
    .lte('recibido_en', hasta)
    .order('recibido_en', { ascending: true })
    .limit(1)
  if (data?.[0]?.canal) return data[0].canal as string
  const { data: antes } = await base().lt('recibido_en', desde).order('recibido_en', { ascending: false }).limit(1)
  return (antes?.[0]?.canal as string | undefined) ?? null
}

export async function corregirFuentes(
  opciones: { dry?: boolean; ahora?: Date; dias?: number } = {}
): Promise<ResumenFuentes> {
  const ahora = opciones.ahora ?? new Date()
  const dry = opciones.dry ?? false
  const dias = opciones.dias ?? MANTENIMIENTO_OPP.fuenteDias
  const resumen: ResumenFuentes = {
    revisadas: 0,
    candidatas: 0,
    escritas: [],
    sinDatos: 0,
    sourceNativoAceptado,
    errores: 0,
  }

  const abiertas = await buscarOportunidades({ pipeline_id: PIPELINE.id, status: 'open' }, 15)
  resumen.revisadas = abiertas.length
  const desde = ahora.getTime() - dias * DIA_MS
  const candidatas = abiertas.filter(o => {
    if (!o.contactId || !fuenteSobrescribible(o.source)) return false
    if ((Date.parse(o.createdAt ?? '') || 0) < desde) return false
    if ((o.contact?.tags ?? []).some(t => (TAGS.noCliente as readonly string[]).includes(t))) return false
    // Si GHL no acepta `source`, solo quedan las que tienen "Fuente del lead" vacío.
    if (sourceNativoAceptado === false && textoCampo(o.customFields, CAMPO_FUENTE_LEAD)) return false
    return true
  })
  resumen.candidatas = candidatas.length
  if (candidatas.length === 0) return resumen

  const anuncios = await anunciosPorContacto(candidatas)
  const conFuente = await enLotes(candidatas, 8, async o => {
    const tags = o.contact?.tags ?? []
    const anuncioNombre = anuncios.get(o.contactId!) ?? null
    const sinAnuncio = !anuncioNombre && !tags.some(t => (TAGS.anuncioMeta as readonly string[]).includes(t))
    const canal = sinAnuncio ? await canalDe(o.contactId!, o.createdAt) : null
    return { o, fuente: fuenteDelLead({ anuncioNombre, tags, canal }) }
  })

  for (const { o, fuente } of conFuente) {
    if (!fuente) {
      resumen.sinDatos++
      continue
    }
    if (!dry && resumen.escritas.length >= MANTENIMIENTO_OPP.maxFuentesPorCorrida) break
    const campos = textoCampo(o.customFields, CAMPO_FUENTE_LEAD) ? [] : [{ id: CAMPO_FUENTE_LEAD, field_value: fuente }]
    const conNativa = sourceNativoAceptado !== false
    if (!conNativa && campos.length === 0) continue
    if (dry) {
      resumen.escritas.push({ id: o.id, fuente, nativa: conNativa })
      continue
    }
    try {
      let quedo: string | null
      try {
        quedo = await fijarFuenteOportunidad(o.id, conNativa ? fuente : null, campos)
      } catch (err) {
        // Validación estricta de GHL ("property source should not exist"):
        // se deja de mandar `source` y se reintenta solo con el campo.
        if (!conNativa || !/source/i.test((err as Error).message)) throw err
        sourceNativoAceptado = false
        console.error('GHL no acepta source en el PUT de oportunidad:', (err as Error).message)
        if (campos.length === 0) continue
        quedo = await fijarFuenteOportunidad(o.id, null, campos)
      }
      if (conNativa && sourceNativoAceptado !== false) {
        sourceNativoAceptado = quedo === fuente
        if (!sourceNativoAceptado) console.error(`GHL ignoró source en el PUT (devolvió ${JSON.stringify(quedo)})`)
      }
      resumen.escritas.push({ id: o.id, fuente, nativa: conNativa && sourceNativoAceptado === true })
    } catch (err) {
      resumen.errores++
      console.error(`corregirFuentes ${o.id}:`, (err as Error).message)
    }
  }
  resumen.sourceNativoAceptado = sourceNativoAceptado
  return resumen
}

export async function sincronizarValores(opciones: { dry?: boolean } = {}): Promise<ResumenValores> {
  const dry = opciones.dry ?? false
  const resumen: ResumenValores = { revisadas: 0, fijadas: [], dudosas: [], distintas: [], errores: 0 }

  const [reservaciones, ganadas] = await Promise.all([
    buscarOportunidades({ pipeline_id: PIPELINE_RESERVACIONES.id, status: 'all' }, 15),
    buscarOportunidades({ pipeline_id: PIPELINE.id, pipeline_stage_id: ETAPA_GANADA, status: 'all' }, 5),
  ])
  const porId = new Map([...reservaciones, ...ganadas].map(o => [o.id, o]))
  const vivas = [...porId.values()].filter(o => o.status !== 'lost' && o.status !== 'abandoned')
  resumen.revisadas = vivas.length

  for (const o of vivas) {
    const dudoso = valorDudoso(o)
    if (dudoso !== null) resumen.dudosas.push({ id: o.id, valor: o.monetaryValue ?? 0, total: dudoso })
    const valor = valorPendiente(o, { soloSiVacio: true })
    if (valor === null) {
      const distinto = valorPendiente(o)
      if (distinto !== null) resumen.distintas.push({ id: o.id, valor: o.monetaryValue ?? 0, total: distinto })
      continue
    }
    // En dry se cuenta todo (para medir); en vivo, con tope por corrida.
    if (!dry && resumen.fijadas.length >= MANTENIMIENTO_OPP.maxValoresPorCorrida) continue
    try {
      if (!dry) await fijarValorOportunidad(o.id, valor)
      resumen.fijadas.push({ id: o.id, antes: o.monetaryValue ?? 0, valor })
    } catch (err) {
      resumen.errores++
      console.error(`sincronizarValores ${o.id}:`, (err as Error).message)
    }
  }
  return resumen
}
