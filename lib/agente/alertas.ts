import { conversacionDe, enviarMensaje, rutaDeRespuesta, ultimosMensajes } from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import { ALERTAS_INTERNAS } from '@/lib/agente/config'

/**
 * Manda un aviso interno por WhatsApp a cada contacto de `ALERTAS_INTERNAS`.
 *
 * Sale por el proveedor del último mensaje entrante de ese contacto (igual que
 * Sol: con `type: 'WhatsApp'` el proveedor custom falla en silencio) y se
 * registra en `agente_mensajes_enviados`; si no, el vigilante lo leería como
 * un mensaje humano en ese chat. Un fallo con un destinatario no frena al otro.
 */
export async function enviarAlertaInterna(texto: string): Promise<string[]> {
  const notas: string[] = []
  for (const { nombre, contactId } of ALERTAS_INTERNAS) {
    try {
      const conversacion = await conversacionDe(contactId)
      if (!conversacion) {
        notas.push(`${nombre}: sin conversación en GHL`)
        continue
      }
      const ruta = rutaDeRespuesta(await ultimosMensajes(conversacion.id, 20))
      const envio = await enviarMensaje(contactId, texto, ruta)
      if (envio.messageId) await registrarEnviado(envio.messageId, conversacion.id, contactId)
      notas.push(`${nombre}: enviado`)
    } catch (err) {
      notas.push(`${nombre}: falló — ${(err as Error).message}`)
    }
  }
  return notas
}
