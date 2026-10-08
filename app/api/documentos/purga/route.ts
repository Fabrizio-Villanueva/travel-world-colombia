import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { purgarDocumentosVencidos } from '@/lib/documentos/purga'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Purga diaria de los documentos de viajeros (ver lib/documentos/purga.ts):
 * borra las fotos 30 días después del regreso. Lo dispara el cron de Vercel
 * (vercel.json) con `Authorization: Bearer ${CRON_SECRET}`; una llamada manual
 * usa ese mismo Bearer. `?dry=1` solo cuenta, no borra.
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
    const resumen = await purgarDocumentosVencidos(dry)
    return Response.json({ ok: true, dry, ...resumen })
  } catch (err) {
    console.error('purgarDocumentosVencidos error:', err)
    return Response.json({ ok: false, error: 'error interno (ver logs)' }, { status: 500 })
  }
}
