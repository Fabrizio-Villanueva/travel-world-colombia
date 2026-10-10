import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { avanzarEtapas } from '@/lib/agente/etapas'
import { corregirFuentes, sincronizarValores } from '@/lib/agente/mantenimiento-opp'
import { MANTENIMIENTO_OPP } from '@/lib/agente/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Pocas llamadas a GHL por corrida (3 búsquedas de etapa, los chats recientes y
 * los mensajes de los chats que coinciden) más el mantenimiento de fuente y
 * valor (~12 páginas de búsqueda y los PUT de lo que falte). 120 s es margen.
 */
export const maxDuration = 120

/**
 * Runner del avance automático del pipeline 🎯 Leads (ver `lib/agente/etapas.ts`):
 * mensaje de la asesora → Contactado; asesor asignado → Asignado a Agente.
 * Después, el mantenimiento de la tarjeta (ver `lib/agente/mantenimiento-opp.ts`):
 * fuente real del lead y valor de la venta. Cada parte va en su propio
 * try/catch: un fallo de una no frena a las otras.
 *
 * `?fuenteDias=N` (manual) amplía la ventana de la fuente para el histórico.
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
    const parcial = async <T,>(nombre: string, fn: () => Promise<T>): Promise<T | { error: string }> => {
      try {
        return await fn()
      } catch (err) {
        console.error(`${nombre} error:`, err)
        return { error: 'error interno (ver logs)' }
      }
    }
    const resumen = await parcial('avanzarEtapas', () => avanzarEtapas({ dry }))
    const diasPedidos = Number(req.nextUrl.searchParams.get('fuenteDias'))
    const dias = Number.isFinite(diasPedidos) && diasPedidos > 0 ? Math.min(diasPedidos, 730) : undefined
    const fuentes = MANTENIMIENTO_OPP.fuente
      ? await parcial('corregirFuentes', () => corregirFuentes({ dry, dias }))
      : { apagado: 'AGENTE_FUENTE=off' }
    const valores = MANTENIMIENTO_OPP.valor
      ? await parcial('sincronizarValores', () => sincronizarValores({ dry }))
      : { apagado: 'AGENTE_VALOR_VENTA=off' }

    return Response.json({ ok: true, dry, ...resumen, fuentes, valores })
  } catch (err) {
    console.error('avanzarEtapas error:', err)
    return Response.json({ ok: false, error: 'error interno (ver logs)' }, { status: 500 })
  }
}
