import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { correrEvaluador } from '@/lib/agente/evaluador'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** ~25 leads por corrida, 5 en paralelo, ~10-20 s cada uno con el modelo. */
export const maxDuration = 300

/**
 * Runner del evaluador de calidad de leads (ver `lib/agente/evaluador.ts`).
 * Lo dispara el cron de Vercel cada hora (ver `vercel.json`) o una llamada
 * manual con `Authorization: Bearer $CRON_SECRET`. `?limite=N` (máx. 60) para
 * ponerse al día con el histórico.
 */

function autorizado(req: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!esperado || !bearer) return false
  const a = Buffer.from(bearer)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ ok: false }, { status: 401 })
  const pedido = Number(req.nextUrl.searchParams.get('limite'))
  const limite = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 60) : 25
  try {
    const r = await correrEvaluador(limite)
    if (r.fallos.length) console.error('evaluador fallos:', r.fallos)
    return Response.json({ ok: true, ...r })
  } catch (err) {
    console.error('evaluador error:', (err as Error).message)
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
