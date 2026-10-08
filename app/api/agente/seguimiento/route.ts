import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { correrSeguimientos } from '@/lib/agente/seguimiento'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cada contacto de la corrida implica una llamada al modelo (4-17 s medidos)
 * más varias a GHL; con el lote por defecto (8) el peor caso ronda los 3
 * minutos. 300 s es el margen, no la expectativa.
 */
export const maxDuration = 300

/**
 * Runner del seguimiento dinámico de Sol (§5 del diseño).
 *
 * Lo dispara el cron de Vercel (ver `vercel.json`) o una llamada manual con el
 * secreto. GET a propósito: es lo que envía el cron. La corrida es idempotente
 * en la práctica — cada fila cobrada se reprograma o se cierra al procesarla,
 * así que una segunda llamada inmediata encuentra la cola vacía.
 */

function autorizado(req: NextRequest): boolean {
  const igual = (recibido: string, esperado?: string) => {
    if (!esperado || !recibido) return false
    const a = Buffer.from(recibido)
    const b = Buffer.from(esperado)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  // El cron de Vercel manda `Authorization: Bearer ${CRON_SECRET}` si la
  // variable existe en el proyecto.
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
    const resumen = await correrSeguimientos()
    return Response.json({ ok: true, ...resumen })
  } catch (err) {
    console.error('correrSeguimientos error:', err)
    return Response.json({ ok: false, error: 'error interno (ver logs)' }, { status: 500 })
  }
}
