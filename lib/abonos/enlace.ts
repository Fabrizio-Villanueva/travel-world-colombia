import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { SITE } from '@/lib/site'

/**
 * Enlace del estado de cuenta: /estado-de-cuenta/<oportunidad>.<firma>. La
 * firma (HMAC con clave propia derivada) impide adivinar el de otra reserva;
 * no se guarda nada en la base y el enlace es siempre el mismo para la
 * reserva, así que el del primer mensaje sigue sirviendo con cada abono nuevo.
 */

function clave(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return createHash('sha256').update(`estado-cuenta:${base}`).digest()
}

const firma = (opportunityId: string) =>
  createHmac('sha256', clave()).update(opportunityId).digest('base64url').slice(0, 24)

export function tokenEstadoCuenta(opportunityId: string): string {
  return `${opportunityId}.${firma(opportunityId)}`
}

export function urlEstadoCuenta(opportunityId: string, origen = SITE.url): string {
  return `${origen.replace(/\/$/, '')}/estado-de-cuenta/${tokenEstadoCuenta(opportunityId)}`
}

/** Oportunidad del token, o null si la firma no cuadra. */
export function oportunidadDelToken(token: string): string | null {
  const m = /^([A-Za-z0-9]{10,40})\.([A-Za-z0-9_-]{24})$/.exec(token)
  if (!m) return null
  const esperada = Buffer.from(firma(m[1]))
  const recibida = Buffer.from(m[2])
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida) ? m[1] : null
}
