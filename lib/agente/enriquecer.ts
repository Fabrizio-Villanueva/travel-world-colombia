import { conversacionDe, obtenerContacto, ultimosMensajes, type MensajeGhl } from '@/lib/agente/ghl'
import { CAMPO_IA_NOMBRE, TAGS } from '@/lib/agente/config'

export interface EventoEnriquecido {
  conversationId?: string
  messageId?: string
  direccion?: string
  canal?: string
  cuerpo?: string
  userId?: string
  /** Payload crudo del mensaje real: de ahí sale la huella del bot actual. */
  mensajeCrudo?: MensajeGhl
  tagsContacto: string[]
  esNoCliente: boolean
  /** Nombre REAL ya capturado antes (campo ia__nombre). Si existe, Sol no lo repregunta. */
  nombreConfirmado?: string
  nota: string[]
}

/**
 * El webhook solo trae el contacto, así que aquí se pide a la API lo que hace
 * falta: la conversación, el último mensaje y los tags del contacto.
 *
 * Nunca lanza: si la API falla, se registra igual el evento con lo poco que
 * haya. Perder un dato es aceptable; perder el evento entero, no.
 */
export async function enriquecerDesdeContacto(contactId: string): Promise<EventoEnriquecido> {
  const nota: string[] = []
  const salida: EventoEnriquecido = { tagsContacto: [], esNoCliente: false, nota }

  // Tags del contacto: la compuerta barata para proveedores y mayoristas.
  try {
    const contacto = await obtenerContacto(contactId)
    salida.tagsContacto = contacto?.tags ?? []
    salida.esNoCliente = salida.tagsContacto.some(t =>
      (TAGS.noCliente as readonly string[]).includes(t)
    )
    if (salida.esNoCliente) nota.push('contacto etiquetado como proveedor/mayorista')

    // Nombre real ya capturado (ia__nombre): si está, Sol no lo vuelve a pedir.
    const iaNombre = contacto?.customFields?.find(f => f.id === CAMPO_IA_NOMBRE)?.value
    if (typeof iaNombre === 'string' && iaNombre.trim()) {
      salida.nombreConfirmado = iaNombre.trim()
    }
  } catch (err) {
    nota.push(`no se pudo leer el contacto: ${(err as Error).message}`)
  }

  // Conversación y último mensaje.
  try {
    // Los leads de PRIMER CONTACTO llegan por webhook casi en el mismo instante
    // en que se crea el contacto, ANTES de que GHL indexe la conversación nueva:
    // la búsqueda devuelve vacío por una condición de carrera. Sin conversación,
    // Sol no puede identificar al autor ni responder, y el lead se pierde en
    // silencio (era una fuga real de leads nuevos). Reintentamos con espera
    // creciente: el 2026-09-28 un lead de anuncio (Enrique) tardó MÁS de los
    // ~6 s que daban los 3 reintentos de 2 s en aparecer en la búsqueda, y se
    // perdió. Total ~30 s de margen; cabe en el maxDuration de 90 s del webhook.
    const esperas = [2000, 3000, 5000, 8000, 12000]
    let conv = await conversacionDe(contactId)
    for (const espera of esperas) {
      if (conv) break
      await new Promise(r => setTimeout(r, espera))
      conv = await conversacionDe(contactId)
    }
    if (!conv) {
      nota.push('el contacto no tiene conversación (tras reintentos)')
      return salida
    }
    salida.conversationId = conv.id

    // GHL mete en la conversación mensajes de actividad (TYPE_ACTIVITY_*:
    // oportunidad creada, citas…) como SALIENTES. En el primer contacto, la
    // automatización crea la oportunidad ~1 s después del mensaje del lead, así
    // que "el último mensaje" puede ser la actividad y no lo que escribió el
    // cliente: Sol lo leía como "un humano tomó la conversación" y se callaba
    // (lead perdido en silencio, visto el 2026-08-26). Se saltan.
    const mensajes = await ultimosMensajes(conv.id, 5)
    const ultimo = mensajes.find(m => !m.messageType?.startsWith('TYPE_ACTIVITY'))
    if (!ultimo) {
      nota.push(
        mensajes.length ? 'conversación solo con mensajes de actividad' : 'conversación sin mensajes'
      )
      return salida
    }

    salida.messageId = ultimo.id
    salida.direccion = ultimo.direction
    salida.canal = ultimo.messageType
    salida.cuerpo = ultimo.body
    salida.userId = ultimo.userId
    salida.mensajeCrudo = ultimo
    nota.push('enriquecido por API')
  } catch (err) {
    nota.push(`no se pudo leer la conversación: ${(err as Error).message}`)
  }

  return salida
}
