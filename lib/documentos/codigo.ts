import { randomInt } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { GHL } from '@/lib/agente/config'
import {
  conversacionDe,
  crearNota,
  enviarMensaje,
  obtenerContacto,
  rutaDeRespuesta,
  ultimosMensajes,
} from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import {
  MAX_FALLOS_ENLACE,
  OTP_ESPERA_SEGUNDOS,
  OTP_INTENTOS_POR_CODIGO,
  OTP_MINUTOS,
} from '@/lib/documentos/config'
import { hashCodigo } from '@/lib/documentos/token'
import { revocarSolicitud, solicitudPorId, type SolicitudRow } from '@/lib/documentos/solicitudes'

/**
 * Código de acceso de un solo uso para el portal de documentos (migración 027,
 * auditoría 2026-10-03 #2). Reemplaza a "últimos 4 dígitos del celular":
 * prueba que la persona tiene el WhatsApp (o el correo) del cliente.
 *
 * - 6 dígitos aleatorios (crypto); en la base solo su HMAC.
 * - Vence en 10 min, un solo uso, 5 intentos por código.
 * - Máx. 1 envío por minuto y 5 por hora (aplicado en SQL, atómico).
 * - 10 fallos en la vida del enlace → enlace desactivado + nota a la asesora.
 * - Nunca se envía solo al abrir la página (las vistas previas de WhatsApp
 *   abren los enlaces): el cliente lo pide con un botón.
 */

export type CanalCodigo = 'whatsapp' | 'email'

const admin = () => createAdminClient()

function enmascararCorreo(email: string): string {
  const [usuario, dominio] = email.split('@')
  if (!dominio) return '•••'
  return `${usuario.slice(0, 1)}•••@${dominio}`
}

function textoWhatsApp(codigo: string): string {
  const legible = `${codigo.slice(0, 3)} ${codigo.slice(3)}`
  return (
    `🔒 Travel World Colombia\n\n` +
    `Tu código para ver los documentos de tu viaje es *${legible}*.\n` +
    `Vence en ${OTP_MINUTOS} minutos. No lo compartas con nadie.`
  )
}

function htmlCorreo(codigo: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0D1E3C">
<p style="font-size:12px;letter-spacing:3px;color:#2957A4;text-transform:uppercase;margin:0">Travel World Colombia</p>
<h2 style="margin:8px 0 4px">Tu código de acceso</h2>
<p style="color:#6B7A90;margin:0 0 20px">Para ver los documentos de tu viaje.</p>
<div style="font-size:34px;font-weight:bold;letter-spacing:10px;background:#F4F7FB;border-radius:14px;padding:18px;text-align:center">${codigo}</div>
<p style="color:#6B7A90;font-size:13px;margin-top:20px">Vence en ${OTP_MINUTOS} minutos. No lo compartas con nadie: nuestro equipo nunca te lo va a pedir.</p>
<p style="color:#94A3B8;font-size:11px">Si no pediste este código, ignora este mensaje.</p></div>`
}

/** Envía por correo con la API de conversaciones de GHL (deja rastro en la conversación). */
async function enviarCorreo(contactId: string, asunto: string, html: string): Promise<{ messageId?: string; conversationId?: string }> {
  const t = process.env.GHL_TWC_PIT
  if (!t) throw new Error('Falta GHL_TWC_PIT')
  const res = await fetch(`${GHL.api}/conversations/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      Version: GHL.version,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'Email', contactId, subject: asunto, html }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`GHL correo respondió ${res.status}`)
  return (await res.json()) as { messageId?: string; conversationId?: string }
}

/** Libera la reserva si el envío falló (para que pueda probar el otro canal sin esperar). */
async function liberarReserva(id: string): Promise<void> {
  await admin().from('doc_solicitudes').update({ otp_hash: null, otp_vence: null, otp_ultimo_envio_en: null }).eq('id', id)
}

export interface EnvioCodigo {
  canal: CanalCodigo
  /** Destino enmascarado para mostrar ("••• 9447" o "e•••@hotmail.com"). */
  destino: string
  /** Segundos hasta poder pedir otro. */
  esperar: number
}

/** Genera un código nuevo y lo envía por el canal pedido. Lanza con un mensaje para el cliente. */
export async function enviarCodigo(s: SolicitudRow, canal: CanalCodigo): Promise<EnvioCodigo> {
  if (!s.contact_id) throw new Error('No encontramos tus datos de contacto. Escríbele a tu asesora.')
  if (s.fallos_totales >= MAX_FALLOS_ENLACE) throw new Error('Este enlace fue desactivado por seguridad. Pídele a tu asesora uno nuevo.')

  // Para el correo hay que saber antes si existe (no gastar la reserva en vano).
  let email: string | null = null
  if (canal === 'email') {
    const contacto = await obtenerContacto(s.contact_id)
    email = contacto?.email ?? null
    if (!email) throw new Error('No tenemos un correo registrado para ti. Pide el código por WhatsApp o escríbele a tu asesora.')
  }

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const vence = new Date(Date.now() + OTP_MINUTOS * 60_000).toISOString()
  const { data: reservado, error } = await admin().rpc('doc_reservar_envio_otp', {
    p_id: s.id,
    p_hash: hashCodigo(s.id, codigo),
    p_vence: vence,
  })
  if (error) throw new Error('No pudimos generar el código. Intenta de nuevo.')
  if (!reservado) {
    const fresca = await solicitudPorId(s.id)
    const ultimo = fresca?.otp_ultimo_envio_en ? new Date(fresca.otp_ultimo_envio_en).getTime() : 0
    const faltan = Math.ceil((ultimo + OTP_ESPERA_SEGUNDOS * 1000 - Date.now()) / 1000)
    if (faltan > 0) throw new Error(`Espera ${faltan} segundos antes de pedir otro código.`)
    throw new Error('Pediste varios códigos seguidos. Espera una hora o escríbele a tu asesora.')
  }

  try {
    if (canal === 'whatsapp') {
      // Misma vía por la que responde Sol: el canal del último mensaje entrante.
      const conv = await conversacionDe(s.contact_id)
      const mensajes = conv ? await ultimosMensajes(conv.id, 15) : []
      const r = await enviarMensaje(s.contact_id, textoWhatsApp(codigo), rutaDeRespuesta(mensajes))
      // Registrado como envío "del sistema": Sol no lo toma como mensaje de la asesora.
      if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? conv?.id ?? '', s.contact_id)
      return { canal, destino: `••• ${s.telefono_ultimos4}`, esperar: OTP_ESPERA_SEGUNDOS }
    }
    const r = await enviarCorreo(s.contact_id, `Tu código de acceso: ${codigo}`, htmlCorreo(codigo))
    if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? '', s.contact_id)
    return { canal, destino: enmascararCorreo(email!), esperar: OTP_ESPERA_SEGUNDOS }
  } catch (e) {
    console.error('[documentos] envío del código falló:', e)
    await liberarReserva(s.id)
    throw new Error(
      canal === 'whatsapp'
        ? 'No pudimos enviarlo por WhatsApp. Prueba por correo o escríbele a tu asesora.'
        : 'No pudimos enviarlo por correo. Prueba por WhatsApp o escríbele a tu asesora.'
    )
  }
}

export type ResultadoCodigo = { ok: true } | { ok: false; error: string; desactivado?: boolean }

/** Verifica el código. Un solo uso; cuenta fallos y desactiva el enlace al llegar al tope. */
export async function verificarCodigo(s: SolicitudRow, entrada: string): Promise<ResultadoCodigo> {
  if (s.fallos_totales >= MAX_FALLOS_ENLACE || s.estado === 'revocada') {
    return { ok: false, error: 'Este enlace fue desactivado por seguridad. Pídele a tu asesora uno nuevo.', desactivado: true }
  }
  const codigo = String(entrada ?? '').replace(/\D/g, '')
  if (codigo.length !== 6) return { ok: false, error: 'Escribe los 6 dígitos del código.' }

  const ahora = new Date().toISOString()
  // Consumo atómico: solo una petición puede usar el código, y solo si sigue vigente.
  const { data: usado } = await admin()
    .from('doc_solicitudes')
    .update({ otp_hash: null, otp_vence: null, otp_intentos: 0, ultimo_acceso_en: ahora })
    .eq('id', s.id)
    .eq('otp_hash', hashCodigo(s.id, codigo))
    .gt('otp_vence', ahora)
    .lt('otp_intentos', OTP_INTENTOS_POR_CODIGO)
    .neq('estado', 'revocada')
    .select('id')
  if (usado && usado.length > 0) return { ok: true }

  const fresca = (await solicitudPorId(s.id)) ?? s
  if (!fresca.otp_hash || !fresca.otp_vence || new Date(fresca.otp_vence).getTime() <= Date.now()) {
    return { ok: false, error: 'El código venció o ya se usó. Pide uno nuevo.' }
  }
  if (fresca.otp_intentos >= OTP_INTENTOS_POR_CODIGO) {
    return { ok: false, error: 'Demasiados intentos con este código. Pide uno nuevo.' }
  }

  const { data: fallo } = await admin().rpc('doc_fallo_otp', { p_id: s.id })
  const fila = (Array.isArray(fallo) ? fallo[0] : fallo) as { intentos: number; totales: number } | null
  const intentos = fila?.intentos ?? fresca.otp_intentos + 1
  const totales = fila?.totales ?? fresca.fallos_totales + 1

  if (totales >= MAX_FALLOS_ENLACE) {
    await revocarSolicitud(s.id)
    if (s.contact_id) {
      crearNota(
        s.contact_id,
        `🔒 Enlace de documentos del viaje "${s.nombre_viaje ?? s.opportunity_id}" DESACTIVADO por seguridad: ` +
          `${MAX_FALLOS_ENLACE} códigos de acceso incorrectos. Si fue el cliente, genera uno nuevo desde el ` +
          `Generador de Contratos → Documentos. Si no, revisa con él quién tenía el enlace.`
      ).catch(e => console.error('[documentos] nota de bloqueo:', e))
    }
    return { ok: false, error: 'Por seguridad este enlace se desactivó. Tu asesora te enviará uno nuevo.', desactivado: true }
  }

  const restantes = Math.max(0, OTP_INTENTOS_POR_CODIGO - intentos)
  return {
    ok: false,
    error: restantes > 0
      ? `Código incorrecto. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'} con este código.`
      : 'Código incorrecto. Pide uno nuevo.',
  }
}
