import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { correrVigilancia } from '@/lib/agente/vigilante'
import { revisarSlaHumano, type ResumenSla } from '@/lib/agente/sla-humano'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cada candidata implica 2 llamadas a GHL (contacto + mensajes). Con el tope por
 * corrida (80) el peor caso ronda el par de minutos, más hasta 8 turnos de Sol
 * de respaldo (5-20 s cada uno). 300 s de margen.
 */
export const maxDuration = 300

/**
 * Runner del VIGILANTE de Sol: marca los leads que llevan más del SLA sin que
 * nadie responda (dentro del horario de atención) para que un workflow de GHL
 * avise al usuario asignado, a toda hora activa a Sol de respaldo en los
 * chats de asesora que se quedaron sin respuesta, y revisa el SLA de respuesta
 * humana a los leads que Sol calificó o escaló (avisos a los 60 min y 3 h hábiles).
 *
 * Lo dispara el cron de Vercel (ver `vercel.json`) o una llamada manual con el
 * secreto. GET a propósito: es lo que envía el cron. Idempotente: una segunda
 * llamada seguida no vuelve a marcar lo ya marcado.
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
    // `?dry=1` calcula y reporta qué haría, SIN escribir tags. Para probar seguro.
    const dry = req.nextUrl.searchParams.get('dry') === '1'
    // `?solo=<contactId>` (pruebas): solo ese contacto y sin esperar los
    // minutos del respaldo — Sol lo cubre en el acto si toca.
    const soloContacto = req.nextUrl.searchParams.get('solo') || undefined
    const resumen = await correrVigilancia({ dry, soloContacto })

    // SLA de respuesta HUMANA a los leads que Sol pasó al equipo (calificados
    // o escalados): ver lib/agente/sla-humano.ts. Va aparte del vigilante
    // porque su reloj es otro (desde el traspaso, no desde el último mensaje
    // del cliente) y un fallo suyo no debe frenar al respaldo ni a las marcas.
    let slaHumano: ResumenSla | { error: string } | undefined
    if (!soloContacto) {
      try {
        slaHumano = await revisarSlaHumano({ dry })
      } catch (err) {
        console.error('revisarSlaHumano error:', err)
        slaHumano = { error: 'error interno (ver logs)' }
      }
    }
    return Response.json({ ok: true, ...resumen, slaHumano })
  } catch (err) {
    console.error('correrVigilancia error:', err)
    return Response.json({ ok: false, error: 'error interno (ver logs)' }, { status: 500 })
  }
}
