import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { avanzarEtapas } from '@/lib/agente/etapas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Pocas llamadas a GHL por corrida (3 búsquedas de etapa, los chats recientes y
 * los mensajes de los chats que coinciden). 120 s es margen de sobra.
 */
export const maxDuration = 120

/**
 * Runner del avance automático del pipeline 🎯 Leads (ver `lib/agente/etapas.ts`):
 * mensaje de la asesora → Contactado; asesor asignado → Asignado a Agente.
 *
 * Lo dispara el cron de Vercel (ver `vercel.json`) o una llamada manual con el
 * secreto. `?dry=1` calcula y reporta qué movería, sin tocar GHL.
 */

function autorizado(req: NextRequest): boolean {
  const igual = (recibido: string, esperado?: string) => {
    if (!esperado || !recibido) return false
    const a = Buffer.from(recibido)
    const b = Buffer.from(esperado)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (igual(bearer, process.env.CRON_SECRET)) return true

  // Solo el secreto del cron (auditoría 2026-10-08): el del webhook está
  // pegado en workflows de GHL y no debe poder disparar corridas. Para una
  // llamada manual: `Authorization: Bearer $CRON_SECRET`.
  return false
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ ok: false }, { status: 401 })

  try {
    const dry = req.nextUrl.searchParams.get('dry') === '1'
    const resumen = await avanzarEtapas({ dry })
    return Response.json({ ok: true, dry, ...resumen })
  } catch (err) {
    console.error('avanzarEtapas error:', err)
    return Response.json({ ok: false, error: 'error interno (ver logs)' }, { status: 500 })
  }
}
