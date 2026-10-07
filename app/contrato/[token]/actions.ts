'use server'

import { cookies, headers } from 'next/headers'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { tokenValido } from '@/lib/documentos/token'
import { accesoContratoValido, firmarAccesoContrato, nombreCookieContrato } from '@/lib/contratos/acceso'
import { enviarCodigoContrato, verificarCodigoContrato, type CanalCodigo, type EnvioCodigo } from '@/lib/contratos/codigo'
import { contratoPorToken, estadoEnlaceContrato, firmarContrato, type ContratoRow } from '@/lib/contratos/registro'

/**
 * Acciones de la página pública /contrato/<token>. El token se resuelve por
 * hash contra la base; firmar exige además la cookie firmada que se entrega
 * al verificar el código. Los errores vuelven como dato (Next enmascara los
 * `throw` en producción).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string }

const MENSAJE: Record<string, string> = {
  'no-existe': 'Este enlace no existe o ya no está disponible.',
  vencido: 'Este enlace venció. Pídele a tu asesora uno nuevo.',
  anulado: 'Este contrato fue reemplazado o anulado. Pídele a tu asesora el enlace vigente.',
}

async function cliente(): Promise<{ ip: string; ua: string; host: string | null }> {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'desconocida',
    ua: h.get('user-agent') ?? 'desconocido',
    host: h.get('host'),
  }
}

/** Enlace utilizable (vigente o ya firmado, para volver a bajar el PDF). */
async function abrir(token: string): Promise<{ c: ContratoRow } | { error: string }> {
  if (!tokenValido(token)) return { error: MENSAJE['no-existe'] }
  const c = await contratoPorToken(token)
  const estado = estadoEnlaceContrato(c)
  if (!c || (estado !== 'ok' && estado !== 'firmado')) return { error: MENSAJE[estado] ?? MENSAJE['no-existe'] }
  return { c }
}

function fallo<T>(e: unknown): Resultado<T> {
  return { ok: false, error: e instanceof Error ? e.message : 'Algo salió mal. Intenta de nuevo.' }
}

export async function pedirCodigo(token: string, canal: CanalCodigo): Promise<Resultado<EnvioCodigo>> {
  const { ip } = await cliente()
  const rl = await checkRateLimit(`ct-codigo:${ip}`, { limit: 10, windowMs: 60 * 60_000 })
  if (!rl.success) return { ok: false, error: 'Pediste muchos códigos. Espera un rato e intenta de nuevo.' }
  const r = await abrir(token)
  if ('error' in r) return { ok: false, error: r.error }
  try {
    return { ok: true, datos: await enviarCodigoContrato(r.c, canal === 'email' ? 'email' : 'whatsapp', ip) }
  } catch (e) {
    return fallo(e)
  }
}

export async function verificar(token: string, codigo: string): Promise<Resultado<null>> {
  const { ip, ua } = await cliente()
  const rl = await checkRateLimit(`ct-verificar:${ip}`, { limit: 30, windowMs: 60 * 60_000 })
  if (!rl.success) return { ok: false, error: 'Demasiados intentos. Espera un rato e intenta de nuevo.' }
  const r = await abrir(token)
  if ('error' in r) return { ok: false, error: r.error }
  const v = await verificarCodigoContrato(r.c, codigo, ip, ua)
  if (!v.ok) return { ok: false, error: v.error }
  const { valor, vence } = firmarAccesoContrato(r.c.id)
  ;(await cookies()).set(nombreCookieContrato(r.c.token_hash), valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/contrato/${token}`,
    expires: vence,
  })
  return { ok: true, datos: null }
}

export async function firmar(
  token: string,
  entrada: { firmaPng: string; nombre: string; documento: string; acepto: boolean }
): Promise<Resultado<null>> {
  const { ip, ua, host } = await cliente()
  const rl = await checkRateLimit(`ct-firmar:${ip}`, { limit: 10, windowMs: 60 * 60_000 })
  if (!rl.success) return { ok: false, error: 'Demasiados intentos. Espera un rato e intenta de nuevo.' }
  const r = await abrir(token)
  if ('error' in r) return { ok: false, error: r.error }
  const cookie = (await cookies()).get(nombreCookieContrato(r.c.token_hash))?.value
  if (!accesoContratoValido(cookie, r.c.id)) {
    return { ok: false, error: 'Tu acceso venció. Recarga la página y vuelve a pedir el código.' }
  }
  if (!entrada.acepto) return { ok: false, error: 'Marca la casilla para aceptar el contrato.' }
  try {
    await firmarContrato(r.c, { ...entrada, ip, ua }, host)
    return { ok: true, datos: null }
  } catch (e) {
    return fallo(e)
  }
}
