import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { HORAS_ACCESO } from '@/lib/documentos/config'

/**
 * Tokens del portal y firma del acceso verificado.
 *
 * - El token del enlace es aleatorio (192 bits, base64url) y en la base solo
 *   se guarda su hash SHA-256: una fuga de la base no abre ningún enlace.
 * - Tras verificar los 4 dígitos, el navegador recibe una cookie firmada
 *   (HMAC) ligada a la solicitud y con vencimiento: así el cliente no vuelve a
 *   escribirlos en cada paso, y la cookie no sirve para otra solicitud.
 *
 * La clave de firma se deriva de la service-role key (ya secreta y presente en
 * Vercel) para no exigir una variable de entorno nueva al desplegar.
 */

export function nuevoToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** ¿Tiene pinta de token nuestro? (filtra basura antes de ir a la base). */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token)
}

function claveFirma(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return createHash('sha256').update(`portal-documentos:${base}`).digest()
}

/** Nombre de la cookie de acceso, distinto por solicitud. */
export function nombreCookieAcceso(tokenHash: string): string {
  return `twc_doc_${tokenHash.slice(0, 16)}`
}

/** Valor firmado: `<solicitudId>.<vence epoch s>.<hmac>`. */
export function firmarAcceso(solicitudId: string): { valor: string; vence: Date } {
  const vence = new Date(Date.now() + HORAS_ACCESO * 3600_000)
  const exp = Math.floor(vence.getTime() / 1000)
  const cuerpo = `${solicitudId}.${exp}`
  const mac = createHmac('sha256', claveFirma()).update(cuerpo).digest('base64url')
  return { valor: `${cuerpo}.${mac}`, vence }
}

/** ¿La cookie es nuestra, de esta solicitud y aún no venció? */
export function accesoFirmadoValido(valor: string | undefined, solicitudId: string): boolean {
  if (!valor) return false
  const partes = valor.split('.')
  if (partes.length !== 3) return false
  const [id, exp, mac] = partes
  if (id !== solicitudId) return false
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false
  const esperado = createHmac('sha256', claveFirma()).update(`${id}.${exp}`).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}
