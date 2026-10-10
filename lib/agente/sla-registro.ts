import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Registro del TRASPASO de un lead al equipo, para el SLA de respuesta humana
 * (lib/agente/sla-humano.ts, migración 041).
 *
 * Va en un archivo aparte (solo Supabase) porque lo llaman conversacion.ts y
 * crm.ts en el turno de Sol, y el revisor del SLA a su vez usa
 * conversacion.ts: así no hay importaciones circulares.
 */

export type MotivoTraspaso = 'calificado' | 'escalado' | 'escalado_respaldo'

/**
 * Abre un episodio de SLA para el contacto si no tiene uno abierto. Una
 * segunda escalada del mismo episodio NO reinicia el reloj (el índice único
 * parcial rechaza la fila y se ignora). Nunca lanza: un fallo aquí no le
 * puede quitar la respuesta a un cliente.
 */
export async function registrarTraspaso(
  contactId: string,
  conversationId: string | undefined,
  motivo: MotivoTraspaso
): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('agente_sla_humano')
      .insert({ contact_id: contactId, conversation_id: conversationId ?? null, motivo })
    if (error) {
      if (error.code === '23505') return null // ya hay un episodio abierto: el reloj sigue
      console.error('registrarTraspaso error:', error.message)
      return `SLA humano: no se pudo registrar el traspaso (${error.message})`
    }
    return `SLA humano: reloj de respuesta del equipo en marcha (${motivo})`
  } catch (err) {
    console.error('registrarTraspaso excepción:', (err as Error).message)
    return null
  }
}
