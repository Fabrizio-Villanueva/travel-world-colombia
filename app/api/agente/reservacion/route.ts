import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { secretoRecibido } from '@/lib/agente/secreto'
import {
  ETAPA_GANADA,
  PIPELINE,
  PIPELINE_RESERVACIONES,
} from '@/lib/agente/config'
import { moverOportunidad, oportunidadesDe } from '@/lib/agente/ghl'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Cuánto tiempo después del botón "Ganado" se acepta mudar la tarjeta. */
const VENTANA_GANADA_MS = 30 * 60 * 1000

/**
 * Mudanza de venta ganada → 🗂️ Reservaciones (misma oportunidad, nunca una
 * nueva). Lo llama el workflow "3.- Venta Ganada to Reservación" de GHL vía
 * webhook cuando la oportunidad entra a ✅ Ganada.
 *
 * Existe porque la acción nativa de GHL no puede mover una tarjeta entre
 * pipelines: crea un duplicado en el destino (verificado 2026-08-26), y un
 * duplicado sería una segunda reserva cuando el TMS sincronice.
 *
 * (Hasta 2026-10-02 también copiaba la fecha de salida al campo de contacto
 * "CPA-Fecha de Ida" para los recordatorios viejos; los V-01..V-07 actuales
 * leen la fecha de la oportunidad.)
 */

function autorizado(req: NextRequest): boolean {
  const esperado = process.env.AGENTE_WEBHOOK_SECRET
  const recibido = secretoRecibido(req)
  if (!esperado || !recibido) return false
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** El payload del workflow de GHL es contact-céntrico y anida lo custom en `customData`. */
function extraerContactId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const custom = (b.customData ?? {}) as Record<string, unknown>
  const candidato = custom.contact_id ?? custom.contactId ?? b.contact_id ?? b.contactId
  return typeof candidato === 'string' && candidato.length > 0 ? candidato : null
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => null)
  const contactId = extraerContactId(body)
  if (!contactId) {
    return Response.json({ ok: false, error: 'falta contact_id (Custom Data del webhook)' }, { status: 400 })
  }

  try {
    const oportunidades = await oportunidadesDe(contactId)
    const enLeads = oportunidades.filter(o => o.pipelineId === PIPELINE.id && o.status === 'open')
    // Marcada con el botón "Ganado" (status won sin pasar por la etapa): solo
    // cuenta si el cambio de estado es reciente, para no mudar nunca las
    // ganadas del historial que viven en Leads.
    const ganadaReciente = oportunidades
      .filter(
        o =>
          o.pipelineId === PIPELINE.id &&
          o.status === 'won' &&
          o.lastStatusChangeAt &&
          Date.now() - Date.parse(o.lastStatusChangeAt) < VENTANA_GANADA_MS
      )
      .sort((a, b) => Date.parse(b.lastStatusChangeAt!) - Date.parse(a.lastStatusChangeAt!))[0]
    // Prioridad: la Ganada abierta del pipeline de Leads → la recién marcada
    // con el botón "Ganado" → si no, la única abierta (reintento tras un fallo
    // a medias).
    const objetivo =
      enLeads.find(o => o.pipelineStageId === ETAPA_GANADA) ??
      ganadaReciente ??
      (enLeads.length === 1 ? enLeads[0] : undefined)

    if (!objetivo) {
      return Response.json({
        ok: false,
        error: 'sin oportunidad abierta en el pipeline de Leads para este contacto',
        contactId,
      })
    }

    await moverOportunidad(
      objetivo.id,
      PIPELINE_RESERVACIONES.id,
      PIPELINE_RESERVACIONES.etapas.reservaCreada,
      'won'
    )

    return Response.json({ ok: true, opportunityId: objetivo.id, movida: true })
  } catch (err) {
    console.error('reservacion error:', err)
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
