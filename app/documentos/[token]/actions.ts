'use server'

import { cookies, headers } from 'next/headers'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { type TipoDocumento } from '@/lib/documentos/config'
import {
  accesoFirmadoValido,
  firmarAcceso,
  nombreCookieAcceso,
  tokenValido,
} from '@/lib/documentos/token'
import {
  archivoDe,
  confirmarArchivo,
  eliminarArchivo,
  estadoEnlace,
  portalDatos,
  prepararSubida as prepararSubidaDb,
  procesarArchivo,
  registrarConsentimiento,
  solicitudPorToken,
  verificarDigitos,
  type SolicitudRow,
  type SubidaPreparada,
} from '@/lib/documentos/solicitudes'
import type { ArchivoPublico, PortalDatos, Progreso } from '@/lib/documentos/tipos'

/**
 * Acciones del portal público /documentos/<token>. Todas reciben el token del
 * enlace y lo resuelven contra la base (por hash); las que tocan datos exigen
 * además la cookie firmada que se entrega al verificar los 4 dígitos.
 * Los errores vuelven como dato (Next enmascara los `throw` en producción).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string }

const MENSAJE_ENLACE: Record<string, string> = {
  'no-existe': 'Este enlace no existe o ya no está disponible.',
  vencido: 'Este enlace venció. Pídele a tu asesora uno nuevo.',
  revocado: 'Este enlace fue desactivado. Pídele a tu asesora uno nuevo.',
}

async function ipCliente(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
}

async function abrir(token: string): Promise<{ s: SolicitudRow } | { error: string }> {
  if (!tokenValido(token)) return { error: MENSAJE_ENLACE['no-existe'] }
  const s = await solicitudPorToken(token)
  const estado = estadoEnlace(s)
  if (!s || estado === 'no-existe' || estado === 'vencido' || estado === 'revocado') {
    return { error: MENSAJE_ENLACE[estado] ?? MENSAJE_ENLACE['no-existe'] }
  }
  return { s }
}

/** Enlace vigente + cookie de acceso válida. */
async function conAcceso(token: string): Promise<{ s: SolicitudRow } | { error: string }> {
  const r = await abrir(token)
  if ('error' in r) return r
  const cookie = (await cookies()).get(nombreCookieAcceso(r.s.token_hash))?.value
  if (!accesoFirmadoValido(cookie, r.s.id)) {
    return { error: 'Tu acceso venció. Recarga la página y vuelve a escribir los 4 dígitos.' }
  }
  return r
}

function fallo<T>(e: unknown): Resultado<T> {
  return { ok: false, error: e instanceof Error ? e.message : 'Algo salió mal. Intenta de nuevo.' }
}

/** Paso 1: los últimos 4 dígitos del celular. Si cuadran, deja la cookie firmada. */
export async function verificar(token: string, digitos: string): Promise<Resultado<PortalDatos>> {
  const ip = await ipCliente()
  const rl = await checkRateLimit(`doc-verif:${ip}`, { limit: 15, windowMs: 10 * 60_000 })
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.retryAfter / 60) || 1} minutos.` }

  const r = await abrir(token)
  if ('error' in r) return { ok: false, error: r.error }

  const v = await verificarDigitos(r.s, String(digitos ?? ''))
  if (!v.ok) {
    return {
      ok: false,
      error:
        v.motivo === 'bloqueado'
          ? `Por seguridad el enlace quedó bloqueado ${v.minutos} minutos. Inténtalo después o escríbele a tu asesora.`
          : `Los dígitos no coinciden. Te quedan ${v.restantes} intento${v.restantes === 1 ? '' : 's'}.`,
    }
  }

  const { valor, vence } = firmarAcceso(r.s.id)
  ;(await cookies()).set(nombreCookieAcceso(r.s.token_hash), valor, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: `/documentos/${token}`,
    expires: vence,
  })
  return { ok: true, datos: await portalDatos(r.s) }
}

export async function cargarPortal(token: string): Promise<Resultado<PortalDatos>> {
  const r = await conAcceso(token)
  if ('error' in r) return { ok: false, error: r.error }
  return { ok: true, datos: await portalDatos(r.s) }
}

/** Casilla obligatoria (Ley 1581) antes de subir cualquier documento. Queda fecha, IP y navegador. */
export async function aceptarConsentimiento(token: string): Promise<Resultado<true>> {
  const r = await conAcceso(token)
  if ('error' in r) return { ok: false, error: r.error }
  const h = await headers()
  await registrarConsentimiento(r.s.id, await ipCliente(), h.get('user-agent') ?? '')
  return { ok: true, datos: true }
}

function exigirConsentimiento(s: SolicitudRow): string | null {
  if (!s.consentimiento_en) return 'Primero acepta el tratamiento de tus datos.'
  if (s.estado === 'revocada') return MENSAJE_ENLACE.revocado
  return null
}

/** Reserva la casilla y devuelve la URL de subida firmada (el navegador sube directo al bucket). */
export async function prepararSubida(
  token: string,
  viajero: number,
  tipo: TipoDocumento,
  mime: string,
  bytes: number
): Promise<Resultado<SubidaPreparada>> {
  const r = await conAcceso(token)
  if ('error' in r) return { ok: false, error: r.error }
  const falta = exigirConsentimiento(r.s)
  if (falta) return { ok: false, error: falta }
  const ip = await ipCliente()
  const rl = await checkRateLimit(`doc-subida:${ip}`, { limit: 80, windowMs: 60 * 60_000 })
  if (!rl.success) return { ok: false, error: 'Demasiadas subidas seguidas. Espera unos minutos.' }
  try {
    return { ok: true, datos: await prepararSubidaDb(r.s, Number(viajero), tipo, String(mime), Number(bytes), ip) }
  } catch (e) {
    return fallo(e)
  }
}

/** Lee el documento recién subido (MRZ / visión) y devuelve los datos para confirmar. */
export async function procesar(token: string, archivoId: string): Promise<Resultado<ArchivoPublico>> {
  const r = await conAcceso(token)
  if ('error' in r) return { ok: false, error: r.error }
  try {
    return { ok: true, datos: await procesarArchivo(r.s, String(archivoId)) }
  } catch (e) {
    return fallo(e)
  }
}

/** El cliente confirma o corrige: se guarda y se escribe en la tarjeta del viaje. */
export async function confirmar(
  token: string,
  archivoId: string,
  datos: unknown
): Promise<Resultado<{ archivo: ArchivoPublico; progreso: Progreso }>> {
  const r = await conAcceso(token)
  if ('error' in r) return { ok: false, error: r.error }
  try {
    return { ok: true, datos: await confirmarArchivo(r.s, String(archivoId), datos) }
  } catch (e) {
    return fallo(e)
  }
}

/** "Cambiar foto": borra el documento de esa casilla. */
export async function repetir(token: string, archivoId: string): Promise<Resultado<true>> {
  const r = await conAcceso(token)
  if ('error' in r) return { ok: false, error: r.error }
  try {
    const a = await archivoDe(r.s, String(archivoId))
    if (a) await eliminarArchivo(r.s, a.id)
    return { ok: true, datos: true }
  } catch (e) {
    return fallo(e)
  }
}
