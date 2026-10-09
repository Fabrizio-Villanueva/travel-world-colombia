import { randomInt } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { GHL } from '@/lib/agente/config'
import { conversacionDe, crearNota, enviarMensaje, obtenerContacto, rutaDeRespuesta, ultimosMensajes } from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import { MAX_FALLOS_ENLACE, OTP_ESPERA_SEGUNDOS, OTP_INTENTOS_POR_CODIGO, OTP_MINUTOS } from '@/lib/documentos/config'
import { hashCodigoContrato } from './acceso'
import { anularContrato, contratoPorId, registrarEvento, type ContratoRow } from './registro'

/**
 * Código de acceso de un solo uso para ver y firmar el contrato. Mismas reglas
 * que el portal de documentos (lib/documentos/codigo.ts): 6 dígitos, 10 min,
 * un solo uso, 5 intentos por código, 1 envío/min y 5/hora (en SQL), y el
 * enlace se anula a los 10 fallos. Nunca se envía solo al abrir la página.
 * Además de dar acceso, el código verificado es parte de la evidencia de la
 * firma (prueba que quien firma tiene el WhatsApp o el correo del titular).
 */

export type CanalCodigo = 'whatsapp' | 'email'

const admin = () => createAdminClient()

function enmascararCorreo(email: string): string {
  const [usuario, dominio] = email.split('@')
  return dominio ? `${usuario.slice(0, 1)}•••@${dominio}` : '•••'
}

function textoWhatsApp(codigo: string, reserva: string | null): string {
  return (
    `🔒 Travel World Colombia\n\n` +
    `Tu código para ver y firmar el contrato${reserva ? ` de la reserva TW-${reserva}` : ''} es *${codigo.slice(0, 3)} ${codigo.slice(3)}*.\n` +
    `Vence en ${OTP_MINUTOS} minutos. No lo compartas con nadie.`
  )
}

function htmlCorreo(codigo: string, reserva: string | null): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0D1E3C">
<p style="font-size:12px;letter-spacing:3px;color:#2957A4;text-transform:uppercase;margin:0">Travel World Colombia</p>
<h2 style="margin:8px 0 4px">Tu código para firmar</h2>
<p style="color:#6B7A90;margin:0 0 20px">Contrato${reserva ? ` de la reserva TW-${reserva}` : ''}.</p>
<div style="font-size:34px;font-weight:bold;letter-spacing:10px;background:#F4F7FB;border-radius:14px;padding:18px;text-align:center">${codigo}</div>
<p style="color:#6B7A90;font-size:13px;margin-top:20px">Vence en ${OTP_MINUTOS} minutos. No lo compartas con nadie: nuestro equipo nunca te lo va a pedir.</p>
<p style="color:#94A3B8;font-size:11px">Si no pediste este código, ignora este mensaje.</p></div>`
}

export async function enviarCorreo(contactId: string, asunto: string, html: string): Promise<{ messageId?: string; conversationId?: string }> {
  const t = process.env.GHL_TWC_PIT
  if (!t) throw new Error('Falta GHL_TWC_PIT')
  const res = await fetch(`${GHL.api}/conversations/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, Version: GHL.version, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'Email', contactId, subject: asunto, html }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`GHL correo respondió ${res.status}`)
  return (await res.json()) as { messageId?: string; conversationId?: string }
}

export interface EnvioCodigo {
  canal: CanalCodigo
  destino: string
  esperar: number
}

export async function enviarCodigoContrato(c: ContratoRow, canal: CanalCodigo, ip: string): Promise<EnvioCodigo> {
  if (!c.contact_id) throw new Error('No encontramos tus datos de contacto. Escríbele a tu asesora.')
  if (c.estado === 'anulado' || c.fallos_totales >= MAX_FALLOS_ENLACE) {
    throw new Error('Este enlace fue desactivado. Pídele a tu asesora uno nuevo.')
  }

  let email: string | null = null
  if (canal === 'email') {
    email = (await obtenerContacto(c.contact_id))?.email ?? null
    if (!email) throw new Error('No tenemos un correo registrado para ti. Pide el código por WhatsApp o escríbele a tu asesora.')
  } else if (!c.telefono_ultimos4) {
    throw new Error('No tenemos un celular registrado para ti. Pide el código por correo o escríbele a tu asesora.')
  }

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const { data: reservado, error } = await admin().rpc('ct_reservar_envio_otp', {
    p_id: c.id,
    p_hash: hashCodigoContrato(c.id, codigo),
    p_vence: new Date(Date.now() + OTP_MINUTOS * 60_000).toISOString(),
  })
  if (error) throw new Error('No pudimos generar el código. Intenta de nuevo.')
  if (!reservado) {
    const fresco = await contratoPorId(c.id)
    const ultimo = fresco?.otp_ultimo_envio_en ? new Date(fresco.otp_ultimo_envio_en).getTime() : 0
    const faltan = Math.ceil((ultimo + OTP_ESPERA_SEGUNDOS * 1000 - Date.now()) / 1000)
    if (faltan > 0) throw new Error(`Espera ${faltan} segundos antes de pedir otro código.`)
    throw new Error('Pediste varios códigos seguidos. Espera una hora o escríbele a tu asesora.')
  }

  try {
    let destino: string
    if (canal === 'whatsapp') {
      const conv = await conversacionDe(c.contact_id)
      const mensajes = conv ? await ultimosMensajes(conv.id, 15) : []
      const r = await enviarMensaje(c.contact_id, textoWhatsApp(codigo, c.reserva), rutaDeRespuesta(mensajes))
      // Registrado como envío del sistema: Sol no lo toma como mensaje de la asesora.
      if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? conv?.id ?? '', c.contact_id)
      destino = `WhatsApp ••• ${c.telefono_ultimos4}`
    } else {
      const r = await enviarCorreo(c.contact_id, `Tu código para firmar: ${codigo}`, htmlCorreo(codigo, c.reserva))
      if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? '', c.contact_id)
      destino = `correo ${enmascararCorreo(email!)}`
    }
    await registrarEvento(c.id, { tipo: 'codigo_enviado', ip, detalle: destino })
    return { canal, destino, esperar: OTP_ESPERA_SEGUNDOS }
  } catch (e) {
    console.error('[contratos] envío del código falló:', e)
    await admin().from('contratos').update({ otp_hash: null, otp_vence: null, otp_ultimo_envio_en: null }).eq('id', c.id)
    throw new Error(
      canal === 'whatsapp'
        ? 'No pudimos enviarlo por WhatsApp. Prueba por correo o escríbele a tu asesora.'
        : 'No pudimos enviarlo por correo. Prueba por WhatsApp o escríbele a tu asesora.'
    )
  }
}

export type ResultadoCodigo = { ok: true } | { ok: false; error: string; desactivado?: boolean }

export async function verificarCodigoContrato(c: ContratoRow, entrada: string, ip: string, ua: string): Promise<ResultadoCodigo> {
  if (c.estado === 'anulado' || c.fallos_totales >= MAX_FALLOS_ENLACE) {
    return { ok: false, error: 'Este enlace fue desactivado. Pídele a tu asesora uno nuevo.', desactivado: true }
  }
  const codigo = String(entrada ?? '').replace(/\D/g, '')
  if (codigo.length !== 6) return { ok: false, error: 'Escribe los 6 dígitos del código.' }

  const ahora = new Date().toISOString()
  const { data: usado } = await admin()
    .from('contratos')
    .update({ otp_hash: null, otp_vence: null, otp_intentos: 0 })
    .eq('id', c.id)
    .eq('otp_hash', hashCodigoContrato(c.id, codigo))
    .gt('otp_vence', ahora)
    .lt('otp_intentos', OTP_INTENTOS_POR_CODIGO)
    .neq('estado', 'anulado')
    .select('id')
  if (usado && usado.length > 0) {
    await registrarEvento(c.id, { tipo: 'verificado', ip, ua: ua.slice(0, 400) })
    return { ok: true }
  }

  const fresco = (await contratoPorId(c.id)) ?? c
  if (!fresco.otp_hash || !fresco.otp_vence || new Date(fresco.otp_vence).getTime() <= Date.now()) {
    return { ok: false, error: 'El código venció o ya se usó. Pide uno nuevo.' }
  }
  if (fresco.otp_intentos >= OTP_INTENTOS_POR_CODIGO) {
    return { ok: false, error: 'Demasiados intentos con este código. Pide uno nuevo.' }
  }

  const { data: fallo } = await admin().rpc('ct_fallo_otp', { p_id: c.id })
  const fila = (Array.isArray(fallo) ? fallo[0] : fallo) as { intentos: number; totales: number } | null
  const intentos = fila?.intentos ?? fresco.otp_intentos + 1
  const totales = fila?.totales ?? fresco.fallos_totales + 1

  if (totales >= MAX_FALLOS_ENLACE) {
    // Un contrato ya firmado no se anula: solo se bloquea el acceso a la descarga.
    if (c.estado === 'enviado') await anularContrato(c.id, `${MAX_FALLOS_ENLACE} códigos incorrectos`, 'sistema')
    if (c.contact_id) {
      crearNota(
        c.contact_id,
        `🔒 Enlace del contrato TW-${c.reserva} DESACTIVADO por seguridad: ${MAX_FALLOS_ENLACE} códigos de acceso ` +
          `incorrectos. Si fue el cliente, envía el contrato de nuevo desde el Generador de Contratos.`
      ).catch(e => console.error('[contratos] nota de bloqueo:', e))
    }
    return { ok: false, error: 'Por seguridad este enlace se desactivó. Tu asesora te enviará uno nuevo.', desactivado: true }
  }

  const restantes = Math.max(0, OTP_INTENTOS_POR_CODIGO - intentos)
  return {
    ok: false,
    error:
      restantes > 0
        ? `Código incorrecto. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'} con este código.`
        : 'Código incorrecto. Pide uno nuevo.',
  }
}
