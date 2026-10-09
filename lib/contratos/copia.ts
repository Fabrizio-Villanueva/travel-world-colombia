import { conversacionDe, enviarMensaje, obtenerContacto, obtenerOportunidad, rutaDeRespuesta, ultimosMensajes } from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import { CAMPOS_CONTRATO } from './config'
import { enviarCorreo } from './codigo'
import { contratoDeOportunidad, registrarEvento } from './registro'

/**
 * Reenvío del enlace de un contrato YA FIRMADO para que el cliente baje su
 * copia en PDF (el mismo enlace lleva a "¡Contrato firmado!" + descarga tras
 * el código). Lo manda el sistema directo por WhatsApp y correo, no el
 * workflow C-02, porque el texto de ese ("listo para firmar") no aplica.
 */

function textoWhatsApp(nombre: string | null, reserva: string | null, url: string): string {
  return (
    `✅ Travel World Colombia\n\n` +
    `Hola${nombre ? ` ${nombre}` : ''}, aquí tienes tu contrato firmado${reserva ? ` de la reserva TW-${reserva}` : ''}.\n\n` +
    `Para descargar tu copia en PDF abre este enlace y pide tu código de acceso:\n${url}`
  )
}

function htmlCorreo(nombre: string | null, reserva: string | null, url: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0D1E3C">
<p style="font-size:12px;letter-spacing:3px;color:#2957A4;text-transform:uppercase;margin:0">Travel World Colombia</p>
<h2 style="margin:8px 0 4px">Tu contrato firmado ✅</h2>
<p style="color:#33415C;margin:0 0 20px">Hola${nombre ? ` ${nombre}` : ''}, aquí tienes tu contrato firmado${reserva ? ` de la reserva TW-${reserva}` : ''}. Abre el enlace, pide tu código de acceso y descarga tu copia en PDF.</p>
<p style="text-align:center;margin:0 0 20px"><a href="${url}" target="_blank" style="display:inline-block;background:#2957A4;color:#fff;font-weight:bold;text-decoration:none;padding:14px 30px;border-radius:12px">Descargar mi contrato</a></p>
<p style="color:#94A3B8;font-size:11px;word-break:break-all">¿El botón no funciona? Copia este enlace: ${url}</p></div>`
}

export async function enviarCopiaFirmada(opportunityId: string): Promise<{ canales: string[] }> {
  const c = await contratoDeOportunidad(opportunityId)
  if (!c || c.estado !== 'firmado') throw new Error('Esta reserva no tiene un contrato firmado.')
  if (!c.contact_id) throw new Error('El contrato no tiene contacto asociado en GHL.')

  const [oportunidad, contacto] = await Promise.all([obtenerOportunidad(opportunityId), obtenerContacto(c.contact_id)])
  const cf = oportunidad?.customFields?.find(f => f.id === CAMPOS_CONTRATO.link)
  const url = String(cf?.fieldValue ?? cf?.field_value ?? cf?.fieldValueString ?? '').trim()
  if (!url.startsWith('http')) throw new Error('No encontramos el enlace del contrato en GHL (campo "Link del contrato").')

  const nombre = contacto?.firstName?.trim() || null
  const canales: string[] = []

  if (c.telefono_ultimos4) {
    try {
      const conv = await conversacionDe(c.contact_id)
      const mensajes = conv ? await ultimosMensajes(conv.id, 15) : []
      const r = await enviarMensaje(c.contact_id, textoWhatsApp(nombre, c.reserva, url), rutaDeRespuesta(mensajes))
      // Registrado como envío del sistema: Sol no lo toma como mensaje de la asesora.
      if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? conv?.id ?? '', c.contact_id)
      canales.push('WhatsApp')
    } catch (e) {
      console.error('[contratos] copia firmada por WhatsApp:', e)
    }
  }
  if (contacto?.email) {
    try {
      const r = await enviarCorreo(
        c.contact_id,
        `Tu contrato firmado${c.reserva ? ` · Reserva TW-${c.reserva}` : ''}`,
        htmlCorreo(nombre, c.reserva, url)
      )
      if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? '', c.contact_id)
      canales.push('correo')
    } catch (e) {
      console.error('[contratos] copia firmada por correo:', e)
    }
  }

  if (!canales.length) throw new Error('No se pudo enviar ni por WhatsApp ni por correo. Revisa los datos del contacto en GHL.')
  await registrarEvento(c.id, { tipo: 'copia_reenviada', detalle: `Copia firmada reenviada por ${canales.join(' y ')}` })
  return { canales }
}
