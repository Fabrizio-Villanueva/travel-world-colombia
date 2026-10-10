import { createAdminClient } from '@/lib/supabase/admin'
import { agregarTags, crearNota, enviarMensaje, rutaDeRespuesta, ultimosMensajes } from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import { REACTIVACION, TAGS } from '@/lib/agente/config'

/**
 * Lo que el webhook hace con la reactivación cuando escribe un cliente:
 * marcar que respondió (métrica del A/B) y atender la baja ("SALIR").
 * Ninguna de las dos lanza: no pueden tumbar el turno del webhook.
 */

/**
 * El cliente escribió: si tenía una reactivación enviada en los últimos 30
 * días sin respuesta, se marca `respondio_en`. Se hace aquí (y no calculado en
 * el panel) porque el webhook es el único lugar que ve CADA mensaje entrante
 * al instante, y deja la métrica lista para una consulta simple.
 */
export async function marcarRespuestaReactivacion(contactId: string): Promise<void> {
  try {
    const desde = new Date(Date.now() - REACTIVACION.diasEntreReactivaciones * 86_400_000).toISOString()
    const { error } = await createAdminClient()
      .from('agente_reactivacion')
      .update({ respondio_en: new Date().toISOString() })
      .eq('contact_id', contactId)
      .eq('decision', 'enviado')
      .is('respondio_en', null)
      .gte('enviado_en', desde)
    if (error) console.error('marcarRespuestaReactivacion:', error.message)
  } catch (err) {
    console.error('marcarRespuestaReactivacion excepción:', (err as Error).message)
  }
}

/**
 * Baja: tag `no_contactar`, UNA respuesta fija de confirmación (registrada como
 * envío de Sol, para que el anti-bucle no la tome por un humano), el
 * seguimiento de Sol se cierra y queda una nota para la asesora. Si el
 * contacto ya tenía el tag, no se le vuelve a responder.
 *
 * Devuelve la nota para la bitácora del evento.
 */
export async function procesarBaja(c: { contactId: string; conversationId: string; tags: string[] }): Promise<string> {
  if (c.tags.includes(TAGS.noContactar)) return `BAJA: ya tenía ${TAGS.noContactar}; no se responde de nuevo`
  const notas: string[] = []
  try {
    await agregarTags(c.contactId, [TAGS.noContactar])
    notas.push(`tag ${TAGS.noContactar}`)
  } catch (err) {
    // Sin el tag no hay forma de respetar la baja después: no se confirma algo que no quedó.
    return `BAJA: no se pudo poner ${TAGS.noContactar}: ${(err as Error).message}`
  }

  try {
    const ruta = rutaDeRespuesta(await ultimosMensajes(c.conversationId, 10))
    const envio = await enviarMensaje(c.contactId, REACTIVACION.confirmacionBaja, ruta)
    if (envio.messageId) await registrarEnviado(envio.messageId, c.conversationId, c.contactId)
    notas.push('confirmación enviada')
  } catch (err) {
    notas.push(`confirmación falló: ${(err as Error).message}`)
  }

  const admin = createAdminClient()
  const ahora = new Date().toISOString()
  const { error: errSeg } = await admin
    .from('agente_seguimientos')
    .update({ estado: 'cerrado', programado_para: null, nota: 'pidió no recibir novedades (SALIR)', actualizado_en: ahora })
    .eq('contact_id', c.contactId)
  if (errSeg) notas.push(`cerrar seguimiento falló: ${errSeg.message}`)

  const { error: errReac } = await admin
    .from('agente_reactivacion')
    .update({ baja_en: ahora })
    .eq('contact_id', c.contactId)
    .eq('decision', 'enviado')
    .is('baja_en', null)
  if (errReac) console.error('baja en agente_reactivacion:', errReac.message)

  await crearNota(
    c.contactId,
    `🚫 El cliente pidió no recibir más novedades (escribió "SALIR" o similar). Se le puso la etiqueta "${TAGS.noContactar}": ni Sol ni las reactivaciones le vuelven a escribir por iniciativa propia. Si vuelve a escribir para planear un viaje, atiéndelo normal.`
  ).catch(err => notas.push(`nota falló: ${(err as Error).message}`))

  return `BAJA: ${notas.join(' · ')}`
}
