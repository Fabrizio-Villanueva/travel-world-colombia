import { createAdminClient } from '@/lib/supabase/admin'
import { atender, enHorario } from '@/lib/agente/conversacion'
import { HORARIO } from '@/lib/agente/config'
import { esFestivo } from '@/lib/agente/festivos'
import { enriquecerDesdeContacto } from '@/lib/agente/enriquecer'
import { anotarEvento, registrarEvento } from '@/lib/agente/eventos'
import { conversacionesRecientes, ultimosMensajes, type MensajeGhl } from '@/lib/agente/ghl'

/**
 * Red de seguridad: mensajes de clientes que NUNCA llegaron al webhook de Sol.
 *
 * El webhook depende de un workflow de GHL. A veces no dispara: 6 leads en 30
 * días (al 09-oct) escribieron y no quedó ni un evento en `agente_eventos`, así
 * que ni Sol, ni el vigilante, ni el SLA se enteraron (dos leads de Hawái
 * llevaban 4-5 días sin respuesta). El vigilante solo mira lo que ya está en
 * `agente_eventos`; esto mira GHL directamente.
 *
 * Cada corrida (con el cron del vigilante, cada 10 min):
 *  1. Conversaciones con movimiento en las últimas `VENTANA_MIN`.
 *  2. Se descartan sin llamar a la API las que tienen un evento posterior a su
 *     último movimiento (lo normal).
 *  3. Del resto se lee el chat: si el último mensaje real del cliente tiene más
 *     de `ESPERA_MIN` y no hay ningún evento desde su llegada, el webhook no
 *     llegó: se registra el evento (marcado RED DE SEGURIDAD) y se le pasa a Sol
 *     con el turno normal, que aplica todas sus compuertas (stop_bot,
 *     proveedores, pausa, humano en el chat…).
 *
 * Idempotente: el evento registrado hace que la corrida siguiente ya no lo vea.
 * `AGENTE_RED_SEGURIDAD=off` lo apaga.
 */

export const RED_SEGURIDAD_ACTIVA = process.env.AGENTE_RED_SEGURIDAD !== 'off'

/** Hacia atrás: cubre varias corridas fallidas seguidas sin despertar chats viejos. */
const VENTANA_MIN = 180
/** Margen para que el webhook normal (que puede tardar 15-20 s) llegue primero. */
const ESPERA_MIN = 5
/** Holgura entre la fecha del mensaje en GHL y la de nuestro evento. */
const HOLGURA_MS = 2 * 60_000
/** Chats leídos por corrida (una llamada a GHL cada uno). */
const MAX_LECTURAS = 40
/** Turnos de Sol por corrida (cada uno llama al modelo). */
const MAX_TURNOS = 4

/** Tipos de canal por los que Sol atiende (los que llegan por el webhook normal). */
const CANALES_SOL = ['TYPE_CUSTOM_SMS', 'TYPE_CUSTOM_PROVIDER_SMS', 'TYPE_WHATSAPP', 'TYPE_INSTAGRAM', 'TYPE_FACEBOOK']

/**
 * Chats perdidos ANTES de que existiera la red (fuera de su ventana de 3 h):
 * se recuperan una sola vez, en la primera corrida en horario hábil. El evento
 * que se registra al atenderlos evita que se repita. Los 2 leads de Hawái del
 * 4 y 5-oct (autorizado por el dueño el 09-oct). Se puede vaciar después.
 */
const RECUPERAR: { id: string; contactId: string }[] = [
  { id: '2pcYg1taiPayqXLTXP3W', contactId: 'z2zQEtGpmnBkStCXl19u' },
  { id: '8pDG1UneiQ6Ik2nHckcG', contactId: 'PqFW1y49XW9RpQkiekxi' },
]

function habil(fecha: Date): boolean {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(fecha)
  return enHorario(fecha) && !esFestivo(dia)
}

export interface ResumenRed {
  revisadas: number
  leidas: number
  perdidos: { contactId: string; conversationId: string; nota: string }[]
  /** Chats de proveedores o del equipo sin webhook (normal: el workflow los excluye). */
  noClientes: number
  errores: number
}

function esReal(m: MensajeGhl): boolean {
  return Boolean(m.messageType) && !m.messageType!.startsWith('TYPE_ACTIVITY')
}

export async function correrRedSeguridad(
  opciones: {
    dry?: boolean
    ahora?: Date
    /** Solo para revisar a mano (con dry): mirar más atrás que la ventana normal. */
    ventanaMin?: number
    maxLecturas?: number
    maxConversaciones?: number
  } = {}
): Promise<ResumenRed> {
  const ahora = opciones.ahora ?? new Date()
  const dry = opciones.dry ?? false
  const ventanaMin = opciones.ventanaMin ?? VENTANA_MIN
  const maxLecturas = opciones.maxLecturas ?? MAX_LECTURAS
  const resumen: ResumenRed = { revisadas: 0, leidas: 0, perdidos: [], noClientes: 0, errores: 0 }
  if (!RED_SEGURIDAD_ACTIVA) return resumen

  const limiteEspera = ahora.getTime() - ESPERA_MIN * 60_000
  const recientes = (await conversacionesRecientes(new Date(ahora.getTime() - ventanaMin * 60_000), opciones.maxConversaciones ?? 200)).filter(
    c => (c.lastMessageDate ?? 0) <= limiteEspera
  )
  // Los viejos por recuperar entran solo en horario hábil (atender no mira el horario).
  if (habil(ahora)) {
    for (const r of RECUPERAR) {
      if (!recientes.some(c => c.id === r.id)) recientes.unshift({ ...r, lastMessageDate: Number.MAX_SAFE_INTEGER })
    }
  }
  resumen.revisadas = recientes.length
  if (recientes.length === 0) return resumen

  // Último evento registrado por conversación (cualquier autor).
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_eventos')
    .select('conversation_id, recibido_en')
    .in('conversation_id', recientes.map(c => c.id))
    .gte('recibido_en', new Date(ahora.getTime() - (ventanaMin + 60) * 60_000).toISOString())
    .order('recibido_en', { ascending: false })
    .limit(2000)
  if (error) throw new Error(`red de seguridad: no se pudo leer agente_eventos: ${error.message}`)
  const ultimoEvento = new Map<string, number>()
  for (const f of data ?? []) {
    if (!ultimoEvento.has(f.conversation_id as string)) {
      ultimoEvento.set(f.conversation_id as string, Date.parse(f.recibido_en as string))
    }
  }

  for (const c of recientes) {
    if (resumen.leidas >= maxLecturas || (!dry && resumen.perdidos.length >= MAX_TURNOS)) break
    const evento = ultimoEvento.get(c.id)
    // Hay un evento posterior al último movimiento del chat: el webhook llegó.
    if (evento !== undefined && evento >= (c.lastMessageDate ?? 0) - HOLGURA_MS) continue

    try {
      resumen.leidas++
      const mensajes = await ultimosMensajes(c.id, 10)
      const entrante = mensajes.find(m => esReal(m))
      // El último mensaje real no es del cliente (alguien ya respondió) o no es de un canal de Sol.
      if (!entrante || entrante.direction !== 'inbound' || !CANALES_SOL.includes(entrante.messageType ?? '')) continue
      const llegada = entrante.dateAdded ? Date.parse(entrante.dateAdded) : NaN
      if (Number.isNaN(llegada) || llegada > limiteEspera) continue
      if (evento !== undefined && evento >= llegada - HOLGURA_MS) continue
      // Confirmación exacta (el mapa de arriba es un filtro barato con tope de filas).
      const { count, error: errEv } = await admin
        .from('agente_eventos')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .gte('recibido_en', new Date(llegada - HOLGURA_MS).toISOString())
      if (errEv || (count ?? 0) > 0) continue

      const extra = await enriquecerDesdeContacto(c.contactId)
      // Proveedores y equipo: el workflow de GHL los excluye a propósito. Se
      // deja el evento (para no releerlo cada 10 min), sin turno de Sol.
      if (extra.esNoCliente) {
        if (!dry) {
          await registrarEvento({
            tipo: 'InboundMessage',
            conversationId: c.id,
            contactId: c.contactId,
            messageId: entrante.id,
            direccion: 'inbound',
            canal: entrante.messageType,
            cuerpo: entrante.body,
            autor: 'cliente',
            payload: { webhook: null, mensaje: entrante, tags: extra.tagsContacto },
            nota: 'RED DE SEGURIDAD · NO CLIENTE (proveedor/equipo) · sin turno',
          })
        }
        resumen.noClientes++
        continue
      }
      if (dry) {
        resumen.perdidos.push({ contactId: c.contactId, conversationId: c.id, nota: 'DRY: Sol atendería este mensaje' })
        continue
      }

      const registrado = await registrarEvento({
        tipo: 'InboundMessage',
        conversationId: c.id,
        contactId: c.contactId,
        messageId: entrante.id,
        direccion: 'inbound',
        canal: entrante.messageType,
        cuerpo: entrante.body,
        autor: 'cliente',
        payload: { webhook: null, mensaje: entrante, tags: extra.tagsContacto },
        nota: 'RED DE SEGURIDAD: el webhook de GHL no llegó; lo recupera el vigilante',
      })
      const turno = await atender({
        contactId: c.contactId,
        conversationId: c.id,
        nombreConfirmado: extra.nombreConfirmado,
        canal: entrante.messageType,
        tags: extra.tagsContacto,
        fechaMensaje: new Date(llegada),
        recibidoEn: registrado?.recibidoEn,
      })
      if (registrado) await anotarEvento(registrado.id, `SOL → ${turno.nota}`)
      resumen.perdidos.push({ contactId: c.contactId, conversationId: c.id, nota: turno.nota })
    } catch (err) {
      resumen.errores++
      console.error(`red de seguridad ${c.id}:`, (err as Error).message)
    }
  }
  return resumen
}
