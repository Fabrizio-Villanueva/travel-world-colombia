import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { revisarCatalogo, textoAlerta } from '@/lib/catalogo/salud'
import { enviarAlertaInterna } from '@/lib/agente/alertas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Aviso semanal de "Salud del catálogo" por WhatsApp a Fabrizio y Ginna
 * (`ALERTAS_INTERNAS`). Lo dispara el cron de Vercel los lunes (ver
 * `vercel.json`). `?dry=1` devuelve el diagnóstico y el texto sin enviar nada.
 * Si no hay problemas, no se manda nada.
 */
function autorizado(req: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!esperado || !recibido) return false
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ ok: false }, { status: 401 })

  try {
    const salud = await revisarCatalogo()
    const texto = textoAlerta(salud)
    const dry = req.nextUrl.searchParams.get('dry') === '1'
    const envios = texto && !dry ? await enviarAlertaInterna(texto) : []
    return Response.json({ ok: true, dry, activos: salud.activos, enSol: salud.enSol, graves: salud.graves, problemas: salud.problemas.length, texto, envios })
  } catch (err) {
    console.error('salud del catálogo error:', err)
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
