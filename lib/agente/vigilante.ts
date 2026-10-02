import { createAdminClient } from '@/lib/supabase/admin'
import { anotarEvento } from '@/lib/agente/eventos'
import { atenderRespaldo, enHorario } from '@/lib/agente/conversacion'
import { obtenerContacto, ultimosMensajes, agregarTags, quitarTags, type MensajeGhl } from '@/lib/agente/ghl'
import { HORARIO, RESPALDO, TAGS } from '@/lib/agente/config'
import { esFestivo } from '@/lib/agente/festivos'

/**
 * Vigilante silencioso de Sol.
 *
 * Sol ya "ve" cada mensaje entrante (queda en `agente_eventos`) y sabe leer una
 * conversación. Esta corrida periódica cierra el hueco que GHL no cubre: detectar
 * un lead que lleva rato SIN que nadie responda y marcarlo para que un workflow
 * de GHL avise al usuario asignado.
 *
 * Por qué aquí y no en un trigger de GHL: el WhatsApp de la cuenta entra por un
 * proveedor custom, y los activadores de "mensaje saliente" de GHL no lo cubren.
 * Sol lee la conversación por API, así que funciona con cualquier canal.
 *
 * Reglas:
 *  - Solo MARCA dentro del horario de atención (si no hay asesoras, nadie va a
 *    contestar: marcar sería ruido). Reusa `enHorario`.
 *  - "Respondido" = hay CUALQUIER saliente real (Sol o humano) más nuevo que el
 *    último mensaje del cliente.
 *  - Idempotente: si ya está marcado, no re-marca; si ya respondieron, quita la
 *    marca (re-arma para una próxima vez).
 *
 * Además, a TODA hora, activa a "Sol de respaldo" (ver `RESPALDO` en config):
 * en un chat con `stop_bot` cuyo último mensaje del cliente lleva más de
 * `minEnHorario` / `minFueraHorario` sin respuesta, Sol lo cubre. Si el chat
 * tiene `sol_respaldo` y la asesora volvió a escribir, quita la marca.
 */

/** Minutos sin respuesta antes de marcar el lead. */
const SLA_MIN = 60
/** Cuánto hacia atrás se buscan conversaciones con actividad del cliente (cubre el cierre nocturno hasta la reapertura). */
const VENTANA_HORAS = 16
/** Tope de conversaciones por corrida, por si hay una avalancha. */
const MAX_POR_CORRIDA = 80
/**
 * Turnos de respaldo por corrida (cada uno llama al modelo, 5-20 s). No es un
 * tope por cliente: lo que no alcance se cubre en la corrida siguiente (el cron
 * pasa cada 10 min). Solo evita que la función se quede sin tiempo.
 */
const MAX_RESPALDOS_POR_CORRIDA = 8
/** Se anota en el evento del cliente cuando el vigilante ya le pasó ese mensaje a Sol de respaldo. */
const MARCA_EVALUADO = 'RESPALDO (vigilante)'

export interface ResumenVigilancia {
  corrio: boolean
  motivo?: string
  candidatos: number
  marcados: number
  limpiados: number
  /** Turnos de Sol de respaldo iniciados en esta corrida, con su resultado. */
  respaldos: { contactId: string; nota: string }[]
  /** Chats a los que se les quitó `sol_respaldo` porque la asesora volvió. */
  respaldosCerrados: number
  errores: number
}

/** ¿Horario hábil de la agencia? (`enHorario` no conoce los festivos). */
function habil(fecha: Date): boolean {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(fecha)
  return enHorario(fecha) && !esFestivo(dia)
}

/**
 * Minutos que se espera antes de que Sol cubra: el plazo largo solo si el
 * mensaje llegó en horario Y seguimos en horario; si no, nadie va a contestar.
 */
function esperaRespaldoMin(llegada: Date, ahora: Date): number {
  return habil(llegada) && habil(ahora) ? RESPALDO.minEnHorario : RESPALDO.minFueraHorario
}

/**
 * ¿El mensaje es una despedida de cortesía ("gracias", "ok", "vale listo")?
 *
 * Marca por dirección y tiempo alertaba también cuando el cliente cerraba con
 * un "gracias" tras la respuesta del asesor (ruido real: 6 de los 13 marcados
 * el 2026-09-28 eran de este tipo). Reglas, deliberadamente conservadoras —
 * ante la duda, se marca y que el equipo decida:
 *  - Debe contener un ANCLA de cortesía (gracias, ok, vale, listo…).
 *  - Corto: máximo 5 palabras ya normalizado.
 *  - Sin señales de pregunta o petición (¿?, precio, cotizar, cuándo…).
 *  - Un adjunto (audio/foto/video) NUNCA es cortesía: siempre se atiende.
 *  - Solo emojis (🙏, 👍) también cuenta como cortesía.
 */
function esCortesiaDeCierre(m: MensajeGhl): boolean {
  const crudo = (m.body ?? '').trim()
  if (!crudo) return false
  if (/^>\s*(AUDIO|IMAGE|VIDEO|DOCUMENT|FILE)\s*</i.test(crudo)) return false

  // Sin tildes, sin emojis ni signos: solo letras/números y espacios.
  const plano = crudo
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9ñ\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // El texto era puro emoji/símbolo (p. ej. "🙏🏻" o "👍"): cierre de cortesía.
  if (!plano) return true

  const palabras = plano.split(' ')
  if (palabras.length > 5) return false

  const ancla =
    /\b(gracias|grasias|ok|okay|okey|vale|listo|dale|perfecto|entendido|recibido|de acuerdo|esta bien|buen dia|buenas tardes|buenas noches|feliz (dia|tarde|noche)|bendiciones|amen|igualmente|a la orden|con gusto|muy amable)\b/
  if (!ancla.test(plano)) return false

  const peticion =
    /\b(cuando|como|donde|cuanto|precio|tarifa|costo|cotiza\w*|informacion|info|quiero|necesito|ayuda|puede[ns]?|podria[ns]?|dime|cuentame|envia\w*|manda\w*|espero|esperamos|quedo|quedamos|atent[oa]s?|pendiente[s]?|pregunta|duda|reserva\w*|pago|numero|telefono)\b/
  if (peticion.test(plano)) return false

  return true
}

/**
 * ¿Hay un saliente REAL (no actividad del sistema) más nuevo que el último
 * entrante? También cuenta como "respondido" el cierre por cortesía: alguien
 * respondió y TODO lo que el cliente mandó después son despedidas de cortesía.
 */
function yaRespondieron(mensajes: MensajeGhl[]): {
  respondido: boolean
  edadEntranteMin: number | null
  llegada: Date | null
} {
  const idxEntrante = mensajes.findIndex(m => m.direction === 'inbound' && esReal(m))
  if (idxEntrante === -1) return { respondido: true, edadEntranteMin: null, llegada: null } // sin entrante real: no es candidato

  const entrante = mensajes[idxEntrante]
  const llegada = entrante.dateAdded ? new Date(entrante.dateAdded) : null
  const edadEntranteMin = llegada ? (Date.now() - llegada.getTime()) / 60000 : null

  // Cualquier saliente real por delante del último entrante = alguien respondió.
  const respondido = mensajes
    .slice(0, idxEntrante)
    .some(m => m.direction === 'outbound' && esReal(m))

  if (!respondido) {
    // Cierre por cortesía: hubo respuesta antes (hay un saliente real en la
    // ventana) y TODOS los entrantes posteriores a ese saliente son despedidas
    // de cortesía. Si nunca nadie respondió, la regla no aplica: se marca.
    const idxSaliente = mensajes.findIndex(m => m.direction === 'outbound' && esReal(m))
    if (idxSaliente !== -1) {
      const entrantesTrasRespuesta = mensajes
        .slice(0, idxSaliente)
        .filter(m => m.direction === 'inbound' && esReal(m))
      if (entrantesTrasRespuesta.length > 0 && entrantesTrasRespuesta.every(esCortesiaDeCierre)) {
        return { respondido: true, edadEntranteMin, llegada }
      }
    }
  }

  return { respondido, edadEntranteMin, llegada }
}

/** Mensaje escrito por alguien (no un registro de actividad del sistema). `ultimosMensajes` llega del más reciente al más antiguo. */
function esReal(m: MensajeGhl): boolean {
  return Boolean(m.messageType) && !m.messageType!.startsWith('TYPE_ACTIVITY')
}

/** ¿Este mensaje lo envió Sol? Ante un fallo de lectura responde que sí (no quita marcas a ciegas). */
async function esDeSol(messageId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_mensajes_enviados')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle()
  if (error) return true
  return Boolean(data)
}

export async function correrVigilancia(
  opciones: {
    dry?: boolean
    ahora?: Date
    /** Prueba: solo este contacto y sin esperar los minutos del respaldo. */
    soloContacto?: string
  } = {}
): Promise<ResumenVigilancia> {
  const ahora = opciones.ahora ?? new Date()
  const dry = opciones.dry ?? false
  const prueba = opciones.soloContacto
  // El aviso a la asesora (lead_sin_respuesta) solo tiene sentido en horario;
  // el respaldo corre a toda hora.
  const marcar = enHorario(ahora)

  const resumen: ResumenVigilancia = {
    corrio: marcar || RESPALDO.activo,
    motivo:
      [
        dry ? 'DRY RUN (no escribe tags ni llama a Sol)' : null,
        marcar ? null : 'fuera de horario: no marca lead_sin_respuesta',
        RESPALDO.activo ? null : 'respaldo apagado (AGENTE_RESPALDO=off)',
        prueba ? `PRUEBA: solo ${prueba}, sin espera` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    candidatos: 0,
    marcados: 0,
    limpiados: 0,
    respaldos: [],
    respaldosCerrados: 0,
    errores: 0,
  }
  if (!resumen.corrio) return resumen

  const admin = createAdminClient()
  const desde = new Date(ahora.getTime() - VENTANA_HORAS * 3_600_000).toISOString()
  // La espera más corta define qué tan nuevo puede ser un candidato; cada
  // regla (aviso / respaldo) confirma su propio umbral más abajo.
  const esperaMin = prueba ? 0 : RESPALDO.activo ? Math.min(SLA_MIN, RESPALDO.minFueraHorario) : SLA_MIN
  const hasta = new Date(ahora.getTime() - esperaMin * 60_000).toISOString()

  // Conversaciones con al menos un mensaje del cliente lo bastante viejo. Es
  // solo la lista de CANDIDATAS: el estado real (último entrante + si
  // respondieron) se confirma con la API por conversación.
  let consulta = admin
    .from('agente_eventos')
    .select('id, conversation_id, contact_id, recibido_en, nota')
    .eq('autor', 'cliente')
    .not('conversation_id', 'is', null)
    .not('contact_id', 'is', null)
    .gte('recibido_en', desde)
    .lte('recibido_en', hasta)
    .order('recibido_en', { ascending: false })
    .limit(1000)
  if (prueba) consulta = consulta.eq('contact_id', prueba)
  const { data, error } = await consulta

  if (error) throw new Error(`vigilante: no se pudo leer agente_eventos: ${error.message}`)

  // Una entrada por conversación (la más reciente ya viene primera por el orden).
  const porConversacion = new Map<string, { contactId: string; eventoId: string; nota: string }>()
  for (const e of data ?? []) {
    if (e.conversation_id && e.contact_id && !porConversacion.has(e.conversation_id)) {
      porConversacion.set(e.conversation_id, { contactId: e.contact_id, eventoId: e.id, nota: e.nota ?? '' })
    }
  }

  const candidatas = [...porConversacion.entries()].slice(0, MAX_POR_CORRIDA)
  resumen.candidatos = candidatas.length

  for (const [conversationId, { contactId, eventoId, nota }] of candidatas) {
    try {
      const contacto = await obtenerContacto(contactId)
      const tags = contacto?.tags ?? []

      // Proveedores/mayoristas no son leads: nunca se marcan ni se cubren.
      if (tags.some(t => (TAGS.noCliente as readonly string[]).includes(t))) continue

      const yaMarcado = tags.includes(TAGS.sinRespuesta)
      const mensajes = await ultimosMensajes(conversationId, 15)
      const { respondido, edadEntranteMin, llegada } = yaRespondieron(mensajes)

      if (respondido) {
        // Ya contestaron (Sol o humano): limpiar la marca para re-armar.
        if (yaMarcado && marcar) {
          if (!dry) await quitarTags(contactId, [TAGS.sinRespuesta])
          resumen.limpiados++
        }
        // Sol estaba cubriendo y quien escribió último fue la asesora: Sol se
        // retira. (El webhook también lo detecta, pero solo cuando el cliente
        // vuelve a escribir; esto limpia la marca aunque no escriba.)
        if (tags.includes(TAGS.respaldo)) {
          const ultimoSaliente = mensajes.find(m => m.direction === 'outbound' && esReal(m))
          if (ultimoSaliente && !(await esDeSol(ultimoSaliente.id))) {
            if (!dry) await quitarTags(contactId, [TAGS.respaldo])
            resumen.respaldosCerrados++
          }
        }
        continue
      }
      if (edadEntranteMin === null || !llegada) continue

      // 1. Aviso a la asesora (solo en horario): pasó el SLA sin respuesta.
      //    El cliente pudo haber escrito de nuevo hace poco → aún no toca.
      if (marcar && edadEntranteMin >= SLA_MIN && !yaMarcado) {
        if (!dry) await agregarTags(contactId, [TAGS.sinRespuesta])
        resumen.marcados++
      }

      // 2. Sol de respaldo: el chat lo lleva una asesora (stop_bot) y nadie
      //    le contestó al cliente a tiempo. Si ya tenía `sol_respaldo` y aun
      //    así quedó sin respuesta (Sol calló o falló), se reintenta aquí.
      const tocaRespaldo =
        RESPALDO.activo &&
        tags.includes(TAGS.stopBot) &&
        (Boolean(prueba) || edadEntranteMin >= esperaRespaldoMin(llegada, ahora))
      if (!tocaRespaldo) continue
      // Sol ya evaluó este mensaje y decidió no contestar ("te confirmo el
      // sábado", "quedo atenta"): no se le vuelve a preguntar cada 10 minutos.
      // Si el cliente escribe algo nuevo, ese mensaje trae su propio evento.
      if (nota.includes(MARCA_EVALUADO)) continue
      if (resumen.respaldos.length >= MAX_RESPALDOS_POR_CORRIDA) continue

      if (dry) {
        resumen.respaldos.push({ contactId, nota: 'DRY: Sol cubriría este chat' })
        continue
      }
      const turno = await atenderRespaldo(
        {
          contactId,
          conversationId,
          nombre: [contacto?.firstName, contacto?.lastName].filter(Boolean).join(' ') || undefined,
          tags,
        },
        { inicio: true }
      )
      await anotarEvento(eventoId, `${MARCA_EVALUADO} → ${turno.nota}`)
      resumen.respaldos.push({ contactId, nota: turno.nota })
    } catch (err) {
      resumen.errores++
      console.error(`vigilante ${conversationId}:`, (err as Error).message)
    }
  }

  return resumen
}
