import { z } from 'zod'

/**
 * Payload del webhook de GHL.
 *
 * ⚠️ FORMA REAL (verificada con tráfico de producción el 2026-08-03): la acción
 * "Webhook personalizado" de GHL manda ÚNICAMENTE los datos del contacto —
 *
 *     { "id": "<contactId>", "name": "Nombre ✨", "email": "", "phone": "300 0000000" }
 *
 * — sin el texto del mensaje, sin conversación y sin dirección. El `id` es el
 * del CONTACTO. Por eso el webhook se trata como un "campanazo" y el contenido
 * se pide por API (`lib/agente/ghl.ts`).
 *
 * El esquema sigue siendo PERMISIVO (`passthrough`, casi todo opcional) porque
 * GHL puede enriquecer el payload si algún día se configuran datos
 * personalizados en la acción, y no queremos rechazar eventos por eso.
 */
export const eventoGhlSchema = z
  .object({
    type: z.string().optional(),
    locationId: z.string().optional(),

    // Identificadores (GHL varía entre camelCase y snake_case según el evento).
    conversationId: z.string().optional(),
    conversation_id: z.string().optional(),
    contactId: z.string().optional(),
    contact_id: z.string().optional(),
    messageId: z.string().optional(),
    message_id: z.string().optional(),
    id: z.string().optional(),

    // Contenido.
    body: z.string().optional(),
    message: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    direction: z.string().optional(),
    messageType: z.string().optional(),
    type_: z.string().optional(),

    // Autoría.
    userId: z.string().optional(),
    user_id: z.string().optional(),

    // Forma real observada: datos del contacto.
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),

    // Acción "Webhook" (gratuita): manda el registro completo del contacto.
    // `tags` viene como cadena separada por comas, no como arreglo.
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    full_name: z.string().optional(),
    workflow: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export type EventoGhl = z.infer<typeof eventoGhlSchema>

/**
 * Normaliza los alias de GHL a un solo shape.
 *
 * Ojo con `id`: en el payload real es el id del CONTACTO, no del mensaje. Solo
 * se toma como `messageId` cuando el evento trae explícitamente datos de
 * mensaje; si no, se usa como `contactId`.
 */
export function normalizar(e: EventoGhl) {
  const mensaje = typeof e.message === 'object' && e.message !== null ? (e.message as Record<string, unknown>) : null
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

  const messageId = e.messageId ?? e.message_id ?? str(mensaje?.id)
  const contactId = e.contactId ?? e.contact_id ?? str(mensaje?.contactId) ?? e.id

  // La acción gratuita manda los tags como "a,b,c"; la premium no los manda.
  const tags = Array.isArray(e.tags)
    ? e.tags
    : typeof e.tags === 'string'
      ? e.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

  return {
    tipo: e.type ?? str(mensaje?.type),
    conversationId: e.conversationId ?? e.conversation_id ?? str(mensaje?.conversationId),
    contactId,
    messageId,
    direccion: e.direction ?? str(mensaje?.direction),
    canal: e.messageType ?? str(mensaje?.messageType),
    cuerpo: e.body ?? (typeof e.message === 'string' ? e.message : str(mensaje?.body)),
    userId: e.userId ?? e.user_id ?? str(mensaje?.userId),
    nombreContacto: e.name ?? e.full_name,
    tags,
  }
}
