'use server'

import { headers } from 'next/headers'
import { cotizacionSchema } from '@/lib/validations/cotizacion'
import { registrarLeadWeb } from '@/lib/ghl/lead-web'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { checkBotId } from 'botid/server'

/**
 * `registrado` distingue un lead real del honeypot: a un bot se le responde
 * `ok` igual (para que no reintente), pero no debe disparar el evento `Lead`
 * del píxel — antes lo hacía y ~150 envíos de bots al mes ensuciaban la señal.
 */
export type ActionResult =
  | { ok: true; registrado: boolean }
  | { ok: false; message: string }

export async function submitCotizacion(raw: unknown): Promise<ActionResult> {
  // Rate limit por IP — máx. 5 envíos por minuto.
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  const rl = await checkRateLimit(ip, { limit: 5, windowMs: 60_000 })
  if (!rl.success) {
    return {
      ok: false,
      message: `Demasiados envíos. Espera ${rl.retryAfter}s e intenta de nuevo, o escríbenos por WhatsApp.`,
    }
  }

  // Vercel BotID (ver instrumentation-client.ts). A un bot se le responde
  // como si hubiera salido bien, pero no llega al CRM ni al píxel. En local
  // checkBotId() siempre dice humano.
  const { isBot } = await checkBotId()
  if (isBot) return { ok: true, registrado: false }

  const parsed = cotizacionSchema.safeParse(raw)

  if (!parsed.success) {
    return { ok: false, message: 'Revisa los campos del formulario.' }
  }

  // Honeypot
  if (parsed.data.website) {
    return { ok: true, registrado: false } // silencioso para bots
  }

  const d = parsed.data
  const fecha_viaje = [d.fecha_mes, d.fecha_año].filter(Boolean).join(' ') || undefined

  try {
    const ok = await registrarLeadWeb({
      nombre:           d.nombre,
      telefono:         `+57${d.whatsapp}`,
      destino_interes:  d.destino_interes,
      num_viajeros:     d.num_viajeros,
      fecha_viaje,
      presupuesto:      d.presupuesto,
      mensaje:          d.mensaje?.trim() || undefined,
    })

    if (!ok) return { ok: false, message: 'No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.' }
    return { ok: true, registrado: true }
  } catch {
    return { ok: false, message: 'Ocurrió un error inesperado. Escríbenos directamente por WhatsApp.' }
  }
}
