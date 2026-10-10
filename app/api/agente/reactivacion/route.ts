import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { REACTIVACION } from '@/lib/agente/config'
import { correrReactivacion } from '@/lib/agente/reactivacion/correr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Por contacto: ~4 lecturas a GHL, a veces una llamada al modelo (5-15 s) y,
 * al enviar, 3 mensajes con 2 s entre ellos. Con el lote de 20 el peor caso
 * ronda los 4 minutos; 300 s es el techo del plan.
 */
export const maxDuration = 300

/**
 * Runner de la reactivación de leads (A/B IA vs. plantilla), ver
 * lib/agente/reactivacion/correr.ts.
 *
 * Lo dispara el cron de Vercel (ver `vercel.json`, L-S 15:00 UTC = 10:00
 * Bogotá) o una llamada manual con el secreto del cron.
 *  - `?dry=1`: genera los mensajes y los registra como `dry_run`, sin enviar
 *    nada; devuelve el JSON completo para revisarlos.
 *  - `?limite=N`: tamaño del lote (por defecto `REACTIVACION.loteDiario`).
 * Mientras `REACTIVACION.activo` sea false, solo se acepta el dry-run (el cron
 * recibe un 200 con la nota, para no ensuciar los logs con errores).
 */

function autorizado(req: NextRequest): boolean {
  const igual = (recibido: string, esperado?: string) => {
    if (!esperado || !recibido) return false
    const a = Buffer.from(recibido)
    const b = Buffer.from(esperado)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  // Solo el secreto del cron (auditoría 2026-10-08), como los demás runners.
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return igual(bearer, process.env.CRON_SECRET)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ ok: false }, { status: 401 })

  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const limiteTexto = req.nextUrl.searchParams.get('limite')
  const limite = limiteTexto && /^\d{1,3}$/.test(limiteTexto) ? Number(limiteTexto) : undefined

  if (!dry && !REACTIVACION.activo) {
    return Response.json({ ok: true, dry, corrio: false, nota: 'reactivación apagada (REACTIVACION.activo = false): solo se acepta ?dry=1' })
  }

  try {
    const resumen = await correrReactivacion({ dry, limite })
    return Response.json({ ok: true, ...resumen })
  } catch (err) {
    console.error('correrReactivacion error:', err)
    return Response.json({ ok: false, error: 'error interno (ver logs)' }, { status: 500 })
  }
}
