import { PIPELINE, TAGS } from '@/lib/agente/config'
import { agregarTags, moverOportunidad, oportunidadesDe, ultimosMensajes, type MensajeGhl } from '@/lib/agente/ghl'
import { respuestasTrasPrimerSaliente } from '@/lib/agente/reactivacion/reglas'

/**
 * Etapa 🧊 No calificado del pipeline 🎯 Leads (creada el 09-oct-2026).
 *
 * Cuando Sol agota sus seguimientos sin calificar al lead (queda `dormido`) o
 * decide no insistir, la tarjeta sale de Lead Nuevo y pasa aquí, con un tag
 * que dice de qué tipo es (`no_calificado_rescate` si conversó,
 * `no_calificado_silencioso` si nunca contestó). Así Lead Nuevo deja de
 * mezclar leads frescos con leads enfriados y la reactivación tiene su
 * bandeja a la vista.
 *
 * Solo mueve desde Lead Nuevo: más allá (Calificado, Asignado, Contactado…) la
 * tarjeta ya es de una persona y la automatización nunca la regresa. Desde
 * aquí Sol la sube a Calificado por Bot (`moverSiCalificado`) y el cron de
 * etapas a Contactado, igual que desde Lead Nuevo.
 *
 * `AGENTE_NO_CALIFICADO=off` lo apaga.
 */
export const NO_CALIFICADO_ACTIVO = process.env.AGENTE_NO_CALIFICADO !== 'off'

/** Etapas desde las que Sol puede subir la tarjeta a Calificado por Bot. */
export const ETAPAS_PREVIAS_A_CALIFICADO: readonly string[] = [PIPELINE.etapas.leadNuevo, PIPELINE.etapas.noCalificado]

export async function moverANoCalificado(
  contactId: string,
  conversationId?: string | null,
  mensajes?: MensajeGhl[]
): Promise<string | null> {
  if (!NO_CALIFICADO_ACTIVO) return null

  const abierta = (await oportunidadesDe(contactId)).find(o => o.pipelineId === PIPELINE.id && o.status === 'open')
  if (!abierta || abierta.pipelineStageId !== PIPELINE.etapas.leadNuevo) return null

  const historial = mensajes ?? (conversationId ? await ultimosMensajes(conversationId, 30) : [])
  const rescate = respuestasTrasPrimerSaliente(historial) >= 1
  const tag = rescate ? TAGS.noCalificadoRescate : TAGS.noCalificadoSilencioso

  await moverOportunidad(abierta.id, PIPELINE.id, PIPELINE.etapas.noCalificado)
  await agregarTags(contactId, [tag])
  return `oportunidad movida a "No calificado" (${tag})`
}
