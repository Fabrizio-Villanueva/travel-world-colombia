import { createAdminClient } from '@/lib/supabase/admin'
import type { Autor } from '@/lib/agente/autor'

interface RegistroEvento {
  tipo?: string
  conversationId?: string
  contactId?: string
  messageId?: string
  direccion?: string
  autor: Autor
  canal?: string
  cuerpo?: string
  payload: unknown
  nota?: string
}

/** El cuerpo se recorta: la bitácora es para leer a ojo, el crudo va en `payload`. */
const MAX_CUERPO = 2000

/**
 * Guarda un evento del webhook. Nunca lanza: un fallo registrando no puede
 * tumbar la respuesta al webhook (GHL reintentaría y duplicaría el evento).
 */
export async function registrarEvento(
  e: RegistroEvento
): Promise<{ id: string; recibidoEn: string } | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('agente_eventos')
      .insert({
        tipo: e.tipo ?? null,
        conversation_id: e.conversationId ?? null,
        contact_id: e.contactId ?? null,
        message_id: e.messageId ?? null,
        direccion: e.direccion ?? null,
        autor: e.autor,
        canal: e.canal ?? null,
        cuerpo: e.cuerpo ? e.cuerpo.slice(0, MAX_CUERPO) : null,
        payload: e.payload as never,
        nota: e.nota ?? null,
      })
      .select('id, recibido_en')
      .single()

    if (error) {
      console.error('registrarEvento error:', error.message)
      return null
    }
    return { id: data.id as string, recibidoEn: data.recibido_en as string }
  } catch (err) {
    console.error('registrarEvento excepción:', (err as Error).message)
    return null
  }
}

/** Agrega el resultado del turno a un evento ya registrado. */
export async function anotarEvento(id: string, extra: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('agente_eventos').select('nota').eq('id', id).maybeSingle()
    const nota = [data?.nota, extra].filter(Boolean).join(' · ')
    const { error } = await admin.from('agente_eventos').update({ nota }).eq('id', id)
    if (error) console.error('anotarEvento error:', error.message)
  } catch (err) {
    console.error('anotarEvento excepción:', (err as Error).message)
  }
}

/** Texto del mensaje tal como lo trae el webhook de GHL (`message.body`). */
export function cuerpoDelWebhook(crudo: unknown): string | undefined {
  const m = (crudo as { message?: { body?: unknown } } | null)?.message
  return typeof m?.body === 'string' ? m.body : undefined
}

/**
 * ¿GHL ya nos entregó ESTE mismo mensaje? A veces el workflow reenvía el
 * webhook segundos o minutos después (68 casos en 30 días al 09-oct); si el
 * reenvío llega fuera de la ventana de ráfaga abre un segundo turno y Sol
 * contesta dos veces lo mismo.
 *
 * El webhook no trae el id del mensaje: `messageId` es el del último mensaje
 * del chat según la API, y dos mensajes seguidos del cliente pueden compartirlo.
 * Por eso se exige además el mismo `message.body` del webhook (en dos mensajes
 * distintos difiere). Ante un fallo de lectura responde false: peor que
 * contestar dos veces es no contestar.
 */
export async function esWebhookDuplicado(messageId: string | undefined, crudo: unknown): Promise<boolean> {
  const cuerpo = cuerpoDelWebhook(crudo)
  // Sin texto (foto, audio) no hay con qué distinguir dos mensajes seguidos: no se filtra.
  if (!messageId || !cuerpo?.trim()) return false
  try {
    const { data, error } = await createAdminClient()
      .from('agente_eventos')
      .select('payload')
      .eq('message_id', messageId)
      .eq('autor', 'cliente')
      .gt('recibido_en', new Date(Date.now() - 86_400_000).toISOString())
      .limit(5)
    if (error) return false
    return (data ?? []).some(f => cuerpoDelWebhook((f.payload as { webhook?: unknown } | null)?.webhook) === cuerpo)
  } catch {
    return false
  }
}
