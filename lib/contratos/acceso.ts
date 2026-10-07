import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { HORAS_ACCESO_CONTRATO } from './config'

/**
 * Firmas HMAC del contrato (mismo esquema que el portal de documentos, con
 * otra clave derivada para que una cookie de un portal no sirva en el otro):
 *  - cookie de acceso tras verificar el código;
 *  - huella del código de un solo uso;
 *  - enlace interno de impresión (lo abre el Chromium del servidor).
 * El token del enlace (aleatorio, solo su hash en la base) se reutiliza de
 * lib/documentos/token.ts.
 */

function clave(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return createHash('sha256').update(`contratos:${base}`).digest()
}

const mac = (texto: string) => createHmac('sha256', clave()).update(texto).digest('base64url')

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function nombreCookieContrato(tokenHash: string): string {
  return `twc_ct_${tokenHash.slice(0, 16)}`
}

/** Valor firmado: `<contratoId>.<vence epoch s>.<hmac>`. */
export function firmarAccesoContrato(contratoId: string): { valor: string; vence: Date } {
  const vence = new Date(Date.now() + HORAS_ACCESO_CONTRATO * 3600_000)
  const cuerpo = `${contratoId}.${Math.floor(vence.getTime() / 1000)}`
  return { valor: `${cuerpo}.${mac(`acceso:${cuerpo}`)}`, vence }
}

export function accesoContratoValido(valor: string | undefined, contratoId: string): boolean {
  const partes = valor?.split('.') ?? []
  if (partes.length !== 3) return false
  const [id, exp, firma] = partes
  if (id !== contratoId || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false
  return igual(firma, mac(`acceso:${id}.${exp}`))
}

export function hashCodigoContrato(contratoId: string, codigo: string): string {
  return createHmac('sha256', clave()).update(`otp:${contratoId}:${codigo}`).digest('hex')
}

/** Parámetros de la URL interna de impresión: válida 5 minutos. */
export function firmaImpresion(contratoId: string): { e: string; k: string } {
  const e = String(Math.floor(Date.now() / 1000) + 300)
  return { e, k: mac(`imprimir:${contratoId}.${e}`) }
}

export function impresionValida(contratoId: string, e?: string, k?: string): boolean {
  if (!e || !k || !/^\d+$/.test(e) || Number(e) * 1000 < Date.now()) return false
  return igual(k, mac(`imprimir:${contratoId}.${e}`))
}
