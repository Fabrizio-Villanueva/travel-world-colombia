import { SITE } from '@/lib/site'
import { conversacionDe, enviarMensaje, rutaDeRespuesta, ultimosMensajes } from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import type { ContratoDatos } from './tipos'

/**
 * Paso a paso de la asistencia TRAVELKIT (23-oct-2026): al firmar un contrato
 * INTERNACIONAL se le envía al cliente la guía "¿Cómo contactar a TRAVELKIT?"
 * por el mismo canal de su conversación. En nacionales no aplica y no sale.
 * JPG y no WebP: WhatsApp no muestra WebP como foto.
 */
export const RUTA_GUIA_TRAVELKIT = '/img/asistencia/travelkit-paso-a-paso.jpg'

export function aplicaAsistencia(d: ContratoDatos): boolean {
  return d.alcance === 'Internacional'
}

export function textoGuiaAsistencia(nombre: string | null, reserva: string | null): string {
  return (
    `🛟 Travel World Colombia · Asistencia en viaje\n\n` +
    `Hola${nombre ? ` ${nombre}` : ''}, gracias por firmar tu contrato${reserva ? ` TW-${reserva}` : ''}. ` +
    `Tu viaje internacional cuenta con asistencia *TRAVELKIT*.\n\n` +
    `Guarda esta imagen: si tienes una *emergencia en destino* o necesitas una *cancelación por multicausa*, ` +
    `escribe al *+1 (863) 204-2766*, elige la opción de tu caso y ten a la mano el número de tu voucher de asistencia.`
  )
}

/** Envía la guía con la imagen. Devuelve el messageId de GHL (si lo dio). */
export async function enviarGuiaAsistencia(
  contactId: string,
  nombre: string | null,
  reserva: string | null
): Promise<string | null> {
  const conv = await conversacionDe(contactId)
  const mensajes = conv ? await ultimosMensajes(conv.id, 40) : []
  const imagen = `${SITE.url.replace(/\/$/, '')}${RUTA_GUIA_TRAVELKIT}`
  const r = await enviarMensaje(contactId, textoGuiaAsistencia(nombre, reserva), rutaDeRespuesta(mensajes), [imagen])
  // Envío del sistema: Sol no lo toma como mensaje de una asesora.
  if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? conv?.id ?? '', contactId)
  return r.messageId ?? null
}
