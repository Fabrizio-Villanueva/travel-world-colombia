import { GHL } from '@/lib/agente/config'

/**
 * Cliente de la API de GoHighLevel.
 *
 * Existe porque el webhook de GHL manda MUY poco: solo `{id, name, email,
 * phone}` del contacto — ni el texto del mensaje, ni la conversación, ni la
 * dirección (verificado con tráfico real el 2026-08-03). Así que el webhook
 * funciona como "campanazo" y los datos de verdad se piden por aquí.
 *
 * Además es más confiable que configurar merge fields en la acción del
 * webhook: por API llegan también el `userId` y los registros de actividad
 * (`CONVERSATIONS_AI`) que necesitamos para saber quién escribió.
 */

function token(): string {
  const t = process.env.GHL_TWC_PIT
  if (!t) throw new Error('Falta GHL_TWC_PIT')
  return t
}

/**
 * Codifica un id antes de interpolarlo en la ruta. Los ids vienen de payloads
 * externos (webhooks, el panel): uno con `/` o `?` cambiaría la ruta que se
 * llama con el PIT.
 */
const id = encodeURIComponent

async function pedir<T>(ruta: string): Promise<T> {
  const res = await fetch(`${GHL.api}${ruta}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Version: GHL.version,
      Accept: 'application/json',
    },
    // Datos vivos: nunca cachear respuestas del CRM.
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`GHL ${ruta} respondió ${res.status}`)
  return res.json() as Promise<T>
}

export interface ContactoGhl {
  id: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  tags?: string[]
  /** Usuario (asesora) dueño del contacto. */
  assignedTo?: string
  customFields?: { id: string; value?: unknown }[]
}

export interface MensajeGhl {
  id: string
  direction?: string
  body?: string
  messageType?: string
  userId?: string
  dateAdded?: string
  attachments?: string[]
  /** Quién lo originó: 'api', 'app', 'workflow'… (los de workflow no los escribe una persona). */
  source?: string
  /** Presente cuando el canal es una app del marketplace (custom provider). */
  conversationProviderId?: string
}

export interface ConversacionGhl {
  id: string
  contactId?: string
  lastMessageDirection?: string
  unreadCount?: number
}

async function mandar<T>(metodo: 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(`${GHL.api}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token()}`,
      Version: GHL.version,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    throw new Error(`GHL ${ruta} respondió ${res.status}: ${detalle.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

/** Por dónde sale la respuesta: tipo de la API y, si aplica, el proveedor. */
export interface RutaMensaje {
  tipo: string
  conversationProviderId?: string
}

/**
 * Deriva la ruta de respuesta del último mensaje ENTRANTE de la conversación:
 * se responde por donde el cliente escribió. Crítico para los canales de
 * marketplace (TYPE_CUSTOM_SMS, p. ej. la app "Whatsapp, iMessage and SMS" que
 * usa la cuenta): un envío con `type: 'WhatsApp'` ahí queda `failed` en
 * silencio — GHL lo acepta pero no hay canal nativo que lo entregue
 * (verificado el 2026-08-04 con la primera respuesta en vivo de Sol).
 */
export function rutaDeRespuesta(mensajes: MensajeGhl[]): RutaMensaje {
  const entrante = mensajes.find(m => m.direction === 'inbound' && m.messageType)
  switch (entrante?.messageType) {
    case 'TYPE_CUSTOM_SMS':
      return { tipo: 'SMS', conversationProviderId: entrante.conversationProviderId }
    // App de marketplace "Whatsapp, iMessage and SMS" (WhatsApp por QR): el
    // contacto NO tiene teléfono en GHL, así que un envío con `type: 'SMS'` o
    // `type: 'WhatsApp'` devuelve 422 CONVERSATIONS_MSG_NO_PHONE. Hay que salir
    // como `Custom` por el mismo proveedor (verificado el 2026-09-02).
    case 'TYPE_CUSTOM_PROVIDER_SMS':
      return { tipo: 'Custom', conversationProviderId: entrante.conversationProviderId }
    case 'TYPE_SMS':
      return { tipo: 'SMS' }
    case 'TYPE_INSTAGRAM':
      return { tipo: 'IG' }
    case 'TYPE_FACEBOOK':
      return { tipo: 'FB' }
    case 'TYPE_LIVE_CHAT':
      return { tipo: 'Live_Chat' }
    default:
      return { tipo: 'WhatsApp' }
  }
}

/**
 * Envía un mensaje al cliente y devuelve el messageId que asigna GHL.
 *
 * Ese id se guarda en `agente_mensajes_enviados`: es la primera capa del
 * anti-bucle, porque el mismo mensaje vuelve por el webhook como saliente y hay
 * que reconocerlo como propio.
 */
export async function enviarMensaje(
  contactId: string,
  texto: string,
  ruta: RutaMensaje = { tipo: 'WhatsApp' },
  attachments?: string[]
): Promise<{ messageId?: string; conversationId?: string }> {
  const r = await mandar<{ messageId?: string; conversationId?: string }>(
    'POST',
    '/conversations/messages',
    {
      type: ruta.tipo,
      contactId,
      message: texto,
      ...(attachments?.length ? { attachments } : {}),
      ...(ruta.conversationProviderId
        ? { conversationProviderId: ruta.conversationProviderId }
        : {}),
    }
  )
  return { messageId: r.messageId, conversationId: r.conversationId }
}

/** Agrega tags al contacto (escalada, estado, fuera de alcance). */
export async function agregarTags(contactId: string, tags: string[]): Promise<void> {
  await mandar('POST', `/contacts/${id(contactId)}/tags`, { tags })
}

/** Quita tags del contacto (p. ej. re-armar el vigilante cuando ya respondieron). */
export async function quitarTags(contactId: string, tags: string[]): Promise<void> {
  await mandar('DELETE', `/contacts/${id(contactId)}/tags`, { tags })
}

/**
 * Escribe campos personalizados del contacto. GHL hace merge: solo pisa los
 * campos que van en el arreglo, el resto del contacto queda igual.
 */
export async function actualizarCampos(
  contactId: string,
  campos: { id: string; field_value: string | number | string[] }[]
): Promise<void> {
  await mandar('PUT', `/contacts/${id(contactId)}`, { customFields: campos })
}

/**
 * Actualiza el contacto con un cuerpo arbitrario: campos estándar
 * (firstName, email, phone…) y/o `customFields` en un solo PUT.
 */
export async function actualizarContacto(
  contactId: string,
  cuerpo: Record<string, unknown>
): Promise<void> {
  await mandar('PUT', `/contacts/${id(contactId)}`, cuerpo)
}

/** Nota interna en el timeline del contacto (la ven las asesoras, no el cliente). */
export async function crearNota(contactId: string, texto: string): Promise<void> {
  await mandar('POST', `/contacts/${id(contactId)}/notes`, { body: texto })
}

export interface CampoPersonalizadoGhl {
  id: string
  fieldKey?: string
  name?: string
  dataType?: string
  model?: string
  picklistOptions?: string[]
}

/** Todos los campos personalizados de la subcuenta (~150, modelo contacto). */
export async function listarCamposPersonalizados(): Promise<CampoPersonalizadoGhl[]> {
  const r = await pedir<{ customFields?: CampoPersonalizadoGhl[] }>(
    `/locations/${GHL.locationId}/customFields`
  )
  return r.customFields ?? []
}

/** Campos personalizados de contacto Y oportunidad (model=all trae ambos). */
export async function listarCamposTodosLosModelos(): Promise<CampoPersonalizadoGhl[]> {
  const r = await pedir<{ customFields?: CampoPersonalizadoGhl[] }>(
    `/locations/${GHL.locationId}/customFields?model=all`
  )
  return r.customFields ?? []
}

/** Búsqueda de contactos por texto libre (nombre, teléfono o correo). */
export async function buscarContactos(query: string, limite = 10): Promise<ContactoGhl[]> {
  const q = encodeURIComponent(query.trim())
  const r = await pedir<{ contacts?: ContactoGhl[] }>(
    `/contacts/?locationId=${GHL.locationId}&query=${q}&limit=${limite}`
  )
  return r.contacts ?? []
}

export interface PipelineGhl {
  id: string
  name?: string
  stages?: { id: string; name?: string }[]
}

/** Pipelines de la subcuenta con sus etapas (para mostrar nombres, no IDs). */
export async function listarPipelines(): Promise<PipelineGhl[]> {
  const r = await pedir<{ pipelines?: PipelineGhl[] }>(
    `/opportunities/pipelines?locationId=${GHL.locationId}`
  )
  return r.pipelines ?? []
}

/**
 * Escribe campos personalizados de la OPORTUNIDAD. Igual que en contacto,
 * GHL hace merge: solo pisa los campos del arreglo.
 */
export async function actualizarCamposOportunidad(
  opportunityId: string,
  campos: { id: string; field_value: string | number | string[] }[]
): Promise<void> {
  await mandar('PUT', `/opportunities/${id(opportunityId)}`, { customFields: campos })
}

export interface OportunidadGhl {
  id: string
  name?: string
  pipelineId?: string
  pipelineStageId?: string
  status?: string
  lastStatusChangeAt?: string
  monetaryValue?: number
}

/** Oportunidades de un contacto (para saber en qué etapa del pipeline va). */
export async function oportunidadesDe(contactId: string): Promise<OportunidadGhl[]> {
  const r = await pedir<{ opportunities?: OportunidadGhl[] }>(
    `/opportunities/search?location_id=${GHL.locationId}&contact_id=${id(contactId)}`
  )
  return r.opportunities ?? []
}

/**
 * Mueve una oportunidad de etapa (y opcionalmente de pipeline y estado).
 * La API sí permite cruzar pipelines con la MISMA tarjeta — a diferencia de la
 * acción de workflow de GHL, que crea un duplicado en el pipeline destino.
 */
export async function moverOportunidad(
  opportunityId: string,
  pipelineId: string,
  pipelineStageId: string,
  status?: 'open' | 'won' | 'lost' | 'abandoned'
): Promise<void> {
  await mandar('PUT', `/opportunities/${id(opportunityId)}`, {
    pipelineId,
    pipelineStageId,
    ...(status ? { status } : {}),
  })
}

/** Mueve de etapa y, si se indica, asigna la oportunidad en un solo PUT. */
export async function moverYAsignarOportunidad(
  opportunityId: string,
  pipelineId: string,
  pipelineStageId: string,
  assignedTo?: string
): Promise<void> {
  await mandar('PUT', `/opportunities/${id(opportunityId)}`, {
    pipelineId,
    pipelineStageId,
    ...(assignedTo ? { assignedTo } : {}),
  })
}

export interface OportunidadEnEtapaGhl extends OportunidadGhl {
  contactId?: string
  assignedTo?: string | null
  contact?: { tags?: string[] }
}

/** Oportunidades abiertas de una etapa (paginado; la API da 100 por página). */
export async function oportunidadesEnEtapa(
  pipelineId: string,
  pipelineStageId: string
): Promise<OportunidadEnEtapaGhl[]> {
  const todas: OportunidadEnEtapaGhl[] = []
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await pedir<{ opportunities?: OportunidadEnEtapaGhl[] }>(
      `/opportunities/search?location_id=${GHL.locationId}&pipeline_id=${id(pipelineId)}` +
        `&pipeline_stage_id=${id(pipelineStageId)}&status=open&limit=100&page=${pagina}`
    )
    const lote = r.opportunities ?? []
    todas.push(...lote)
    if (lote.length < 100) break
  }
  return todas
}

/** Cambia el nombre visible de una oportunidad (la tarjeta del tablero). */
export async function renombrarOportunidad(opportunityId: string, nombre: string): Promise<void> {
  await mandar('PUT', `/opportunities/${id(opportunityId)}`, { name: nombre })
}

/** Fija el valor (monetaryValue) de una oportunidad: es lo que suma el tablero. */
export async function fijarValorOportunidad(opportunityId: string, valor: number): Promise<void> {
  await mandar('PUT', `/opportunities/${id(opportunityId)}`, { monetaryValue: valor })
}

export interface OportunidadDetalleGhl extends OportunidadGhl {
  /**
   * OJO: el GET por id devuelve los custom fields en un formato distinto al
   * search (`fieldValue` vs `fieldValueString`/`fieldValueDate`, fechas a veces
   * en epoch ms). Tratar el valor como unknown y normalizar al usarlo.
   */
  customFields?: {
    id: string
    fieldValue?: unknown
    field_value?: unknown
    fieldValueString?: string
    fieldValueNumber?: number
    fieldValueDate?: string | number
  }[]
}

/** Una oportunidad con sus campos personalizados (GET por id). */
export async function obtenerOportunidad(
  opportunityId: string
): Promise<OportunidadDetalleGhl | null> {
  const r = await pedir<{ opportunity?: OportunidadDetalleGhl }>(
    `/opportunities/${id(opportunityId)}`
  )
  return r.opportunity ?? null
}

export async function obtenerContacto(contactId: string): Promise<ContactoGhl | null> {
  const r = await pedir<{ contact?: ContactoGhl }>(`/contacts/${id(contactId)}`)
  return r.contact ?? null
}

/** Nombre de un usuario de la cuenta (p. ej. la asesora asignada). */
export async function nombreUsuario(userId: string): Promise<string | null> {
  const r = await pedir<{ name?: string; firstName?: string; lastName?: string }>(`/users/${id(userId)}`)
  return r.name?.trim() || [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || null
}

/** Conversación más reciente de un contacto. */
export async function conversacionDe(contactId: string): Promise<ConversacionGhl | null> {
  const r = await pedir<{ conversations?: ConversacionGhl[] }>(
    `/conversations/search?locationId=${GHL.locationId}&contactId=${id(contactId)}&limit=1`
  )
  return r.conversations?.[0] ?? null
}

/**
 * Conversaciones con movimiento (entrante o saliente) desde `desde`, de la más
 * reciente a la más antigua. `tope` evita recorrer de más si hubo avalancha.
 */
export async function conversacionesRecientes(
  desde: Date,
  tope = 500
): Promise<{ id: string; contactId: string }[]> {
  const salida: { id: string; contactId: string }[] = []
  let despuesDe: number | null = null
  while (salida.length < tope) {
    const r: { conversations?: { id: string; contactId?: string; lastMessageDate?: number; sort?: number[] }[] } =
      await pedir(
        `/conversations/search?locationId=${GHL.locationId}&limit=100&sort=desc&sortBy=last_message_date` +
          (despuesDe ? `&startAfterDate=${despuesDe}` : '')
      )
    const lote = r.conversations ?? []
    for (const c of lote) {
      if ((c.lastMessageDate ?? 0) < desde.getTime()) return salida
      if (c.contactId) salida.push({ id: c.id, contactId: c.contactId })
    }
    if (lote.length < 100) break
    despuesDe = lote[lote.length - 1].sort?.[0] ?? lote[lote.length - 1].lastMessageDate ?? null
    if (!despuesDe) break
  }
  return salida
}

/** Últimos mensajes de una conversación, del más reciente al más antiguo. */
export async function ultimosMensajes(conversationId: string, limite = 10): Promise<MensajeGhl[]> {
  const r = await pedir<{ messages?: { messages?: MensajeGhl[] } }>(
    `/conversations/${id(conversationId)}/messages?limit=${limite}`
  )
  return r.messages?.messages ?? []
}
