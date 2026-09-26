import { createAdminClient } from '@/lib/supabase/admin'
import { decidir, type Decision } from '@/lib/agente/claude'
import { agregarTags, enviarMensaje, rutaDeRespuesta, ultimosMensajes, type MensajeGhl } from '@/lib/agente/ghl'
import { sincronizarCrm } from '@/lib/agente/crm'
import { extraerFotos } from '@/lib/agente/conocimiento'
import { anuncioParaConversacion, type AnuncioContexto } from '@/lib/agente/anuncios'
import { ACTIVO_DESDE, AVISO_DATOS, HORARIO, RAFAGA_MS, TAGS, TAG_PRUEBAS } from '@/lib/agente/config'
import { checkRateLimit } from '@/lib/security/rateLimit'

/**
 * Tope de turnos de Sol por contacto por hora. Generoso para una conversación
 * real (la ráfaga agrupa los mensajes seguidos en un solo turno) y suficiente
 * para frenar a quien intente quemar créditos del modelo a punta de spam.
 */
const RL_SOL = { limit: 20, windowMs: 3_600_000 }

/** ¿Estamos dentro del horario de atención de la agencia (hora de Colombia)? */
export function enHorario(ahora = new Date()): boolean {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: HORARIO.zona,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(ahora)

  const dia = f.find(p => p.type === 'weekday')?.value ?? ''
  const hora = Number(f.find(p => p.type === 'hour')?.value ?? -1)

  if (dia === 'Sun') return false
  if (dia === 'Sat') return hora >= HORARIO.sabado.desde && hora < HORARIO.sabado.hasta
  return hora >= HORARIO.semana.desde && hora < HORARIO.semana.hasta
}

/**
 * Espera la ventana de ráfaga y decide si a este mensaje le toca responder.
 *
 * La ventana es DESLIZANTE: si mientras esperamos llega otro mensaje del
 * cliente, cedemos el turno a ese (que a su vez esperará su propia ventana y
 * verá toda la conversación acumulada). Así una ráfaga de cuatro mensajes
 * separados por 8 segundos se agrupa entera aunque dure medio minuto.
 *
 * Se apoya en `agente_eventos`, donde el evento ya quedó registrado antes de
 * llamar aquí: basta con preguntar si existe uno más nuevo del cliente en la
 * misma conversación.
 *
 * @returns true si soy el último mensaje y debo atender; false si cedo el turno.
 */
export async function meTocaResponder(
  conversationId: string,
  recibidoEn: string
): Promise<boolean> {
  if (RAFAGA_MS <= 0) return true

  await new Promise(r => setTimeout(r, RAFAGA_MS))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_eventos')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('autor', 'cliente')
    .gt('recibido_en', recibidoEn)
    .limit(1)

  // Ante un fallo de lectura preferimos atender: peor que responder de más es
  // que el cliente se quede sin respuesta.
  if (error) {
    console.error('meTocaResponder error:', error.message)
    return true
  }
  return (data?.length ?? 0) === 0
}

export interface ResultadoTurno {
  actuo: boolean
  decision?: Decision
  nota: string
}

interface Entrada {
  contactId: string
  conversationId: string
  /** Nombre de WhatsApp (puede no ser el real). */
  nombre?: string
  /** Nombre real ya capturado antes (ia__nombre): si existe, Sol no lo repregunta. */
  nombreConfirmado?: string
  canal?: string
  tags: string[]
  /** Fecha del mensaje que disparó el turno. */
  fechaMensaje?: Date
}

/**
 * Orquesta un turno de Sol: decide si debe intervenir, consulta al modelo,
 * envía la respuesta y registra el mensaje enviado.
 *
 * Las compuertas van ANTES del modelo — cada una que se cierra temprano es una
 * llamada que no se paga.
 */
export async function atender(e: Entrada): Promise<ResultadoTurno> {
  // 1. ¿Sol está encendido? (ACTIVO_DESDE por defecto está en 2099 = apagado)
  if (!e.fechaMensaje || e.fechaMensaje < ACTIVO_DESDE) {
    return { actuo: false, nota: 'anterior al encendido de Sol (o sin fecha)' }
  }

  // 2. Modo prueba: mientras convivimos con el bot actual, Sol solo habla con
  //    contactos etiquetados explícitamente.
  if (TAG_PRUEBAS && !e.tags.includes(TAG_PRUEBAS)) {
    return { actuo: false, nota: `modo prueba: falta el tag ${TAG_PRUEBAS}` }
  }

  // 3. Un humano tomó la conversación, o el contacto no es un cliente.
  if (e.tags.includes(TAGS.stopBot)) {
    return { actuo: false, nota: 'el contacto tiene stop_bot' }
  }
  if (e.tags.some(t => (TAGS.noCliente as readonly string[]).includes(t))) {
    return { actuo: false, nota: 'proveedor/mayorista' }
  }

  // 3b. Freno de abuso: nadie legítimo sostiene más de RL_TURNOS turnos de Sol
  //     por hora (la ráfaga ya agrupa los mensajes seguidos). Sin esto, un
  //     número anónimo puede quemar créditos del modelo a voluntad. Va ANTES
  //     de las llamadas a la API de GHL y al modelo: turno frenado = turno
  //     que no cuesta nada. Si el limitador falla, se atiende (fail-open:
  //     peor que responder de más es dejar a un cliente real sin respuesta).
  try {
    const rl = await checkRateLimit(`sol:${e.contactId}`, RL_SOL)
    if (!rl.success) {
      return {
        actuo: false,
        nota: `freno de abuso: más de ${RL_SOL.limit} turnos/hora de este contacto (reintenta en ${rl.retryAfter}s)`,
      }
    }
  } catch (err) {
    console.error('rate limit de Sol falló:', (err as Error).message)
  }

  // 4. Historial y re-verificación anti-choque: si el último mensaje es
  //    saliente y NO es nuestro, una persona del equipo tomó el chat (desde el
  //    celular o desde el CRM). Ahí sí se apaga a Sol de forma permanente: el
  //    humano siempre gana. Esta es la ÚNICA vía por la que Sol se pone stop_bot
  //    a sí mismo — escalar ya no lo hace (ver más abajo).
  const mensajes = await ultimosMensajes(e.conversationId, 20)
  if (await humanoTomoElChat(mensajes)) {
    await agregarTags(e.contactId, [TAGS.stopBot])
    return { actuo: false, nota: 'un humano escribió en el chat; Sol se apaga (stop_bot)' }
  }

  // Primer contacto = conversación genuinamente nueva: nunca se le envió el aviso
  // Y NADIE ha respondido antes (ni Sol, ni el bot viejo, ni un humano). Si la
  // conversación ya venía en curso, Sol la continúa sin re-enviar el aviso ni
  // re-saludar — clave para no interrumpir chats ya iniciados con contactos
  // antiguos que no traen el tag.
  const conversacionYaIniciada = mensajes.some(m => m.direction === 'outbound')
  const primerContacto = !e.tags.includes(TAGS.avisoDatos) && !conversacionYaIniciada

  // ¿Llegó desde un anuncio de Meta? Sol sabe qué vio y qué programa es.
  const anuncio = await anuncioParaConversacion(e.conversationId)

  const decision = await decidir(mensajes, {
    nombre: e.nombre,
    nombreConfirmado: e.nombreConfirmado,
    canal: e.canal,
    enHorario: enHorario(),
    primerContacto,
    anuncio,
  })
  marcarFuenteAnuncio(decision, anuncio)

  // Primero la voz, después la mano: el mensaje al cliente sale de inmediato y
  // la escritura en el CRM va al final, donde un fallo ya no le quita respuesta
  // a nadie (sincronizarCrm nunca lanza: reporta cada tropiezo como nota).
  const habla = decision.accion !== 'callar' && decision.mensaje.trim() !== ''

  if (habla) {
    // Por el mismo canal por el que escribió el cliente (custom provider incluido).
    const ruta = rutaDeRespuesta(mensajes)

    // Aviso de tratamiento de datos (Ley 1581): una sola vez, como mensaje
    // aparte, ANTES de la primera respuesta real de Sol. Determinístico (texto
    // legal). Si falla, se reintenta el próximo turno (el tag no se pone) y no
    // se le quita la respuesta al cliente.
    if (primerContacto) {
      try {
        const aviso = await enviarMensaje(e.contactId, AVISO_DATOS, ruta)
        if (aviso.messageId) await registrarEnviado(aviso.messageId, e.conversationId, e.contactId)
        await agregarTags(e.contactId, [TAGS.avisoDatos])
      } catch (err) {
        console.error('aviso de datos falló:', (err as Error).message)
      }
    }

    // Si Sol puso un marcador [foto:slug], se convierte en imagen adjunta y se
    // limpia del texto (solo destinos del catálogo; máx. una foto).
    const { texto, imagenes } = await extraerFotos(decision.mensaje.trim())
    const envio = await enviarMensaje(e.contactId, texto, ruta, imagenes)
    await registrarEnvio(envio, e.conversationId, e.contactId, texto, (imagenes?.length ?? 0) > 0)
  }

  // Escalar avisa al equipo (dispara la notificación) pero NO apaga a Sol: queda
  // en "espera caliente" acompañando al cliente hasta que una persona tome el
  // chat. El stop_bot lo pone la detección de intervención humana (compuerta 4).
  if (decision.accion === 'escalar') {
    await agregarTags(e.contactId, [TAGS.transferenciaHumano])
  }

  const notasCrm = await sincronizarCrm({
    contactId: e.contactId,
    conversationId: e.conversationId,
    canal: e.canal,
    decision,
    tags: e.tags, // snapshot del turno: hace idempotente el handoff (tag/nota una sola vez)
    nombreConfirmado: e.nombreConfirmado, // evita re-escribir ia__nombre si no cambió
    intentos: 0, // el cliente escribió: el contador de seguimientos se reinicia
  })

  return {
    actuo: habla,
    decision,
    nota: [
      `${habla ? decision.accion : 'callar'}: ${decision.motivo}`,
      anuncio ? `anuncio: ${anuncio.nombre}${anuncio.slugs.length ? ` → ${anuncio.slugs.join(', ')}` : ' (sin producto en el catálogo)'}` : null,
      ...notasCrm,
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

/**
 * La fuente del lead en GHL se marca con el anuncio, de forma determinística
 * (el modelo no la deduce): sirve para medir qué campaña trae leads calificados.
 */
export function marcarFuenteAnuncio(decision: Decision, anuncio: AnuncioContexto | null): void {
  if (!anuncio) return
  if (!decision.datos.fuente_lead?.trim()) decision.datos.fuente_lead = `Meta Ads · ${anuncio.nombre}`
}

/**
 * ¿Un humano tomó el chat? True si en la ventana hay CUALQUIER mensaje saliente
 * real que NO sea de Sol — no solo el último. Antes solo se miraba `mensajes[0]`,
 * así que si el asesor escribía y LUEGO el cliente respondía, el último era del
 * cliente (inbound) y la intervención humana se colaba: Sol seguía compitiendo.
 *
 * Excluye los registros de actividad del sistema (TYPE_ACTIVITY_*, p. ej.
 * "Opportunity updated"), que son "salientes" pero no los escribe una persona.
 * Una sola consulta en lote a `agente_mensajes_enviados` (los envíos de Sol).
 */
export async function humanoTomoElChat(mensajes: MensajeGhl[]): Promise<boolean> {
  const salientes = mensajes.filter(
    (m): m is MensajeGhl & { id: string } =>
      m.direction === 'outbound' &&
      Boolean(m.id) &&
      Boolean(m.messageType) &&
      !m.messageType!.startsWith('TYPE_ACTIVITY')
  )
  if (salientes.length === 0) return false

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_mensajes_enviados')
    .select('message_id')
    .in('message_id', salientes.map(m => m.id))
  if (error) {
    console.error('humanoTomoElChat error:', error.message)
    return false // ante un fallo de lectura, no apagar a Sol por error
  }
  const nuestros = new Set((data ?? []).map(r => r.message_id))
  return salientes.some(m => !nuestros.has(m.id))
}

export async function esNuestro(messageId?: string): Promise<boolean> {
  if (!messageId) return false
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_mensajes_enviados')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle()
  if (error) console.error('esNuestro error:', error.message)
  return Boolean(data)
}

export async function registrarEnviado(messageId: string, conversationId: string, contactId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('agente_mensajes_enviados')
    .insert({ message_id: messageId, conversation_id: conversationId, contact_id: contactId })
  if (error) console.error('registrarEnviado error:', error.message)
}

/**
 * Registra un envío de Sol, incluyendo los ids "gemelos" de los envíos con
 * adjuntos.
 *
 * Cuando el mensaje lleva una foto, GHL (verificado en Instagram el 2026-08-27)
 * lo PARTE en dos mensajes con ids distintos: el texto queda bajo un id nuevo y
 * la API solo devuelve el del adjunto (cuerpo vacío). Si solo se registra el id
 * devuelto, el mensaje de texto queda como saliente "desconocido" y
 * `humanoTomoElChat` lo lee como intervención humana → falso stop_bot que deja
 * a Sol muda con ese contacto para siempre. Por eso, tras un envío con
 * adjuntos, se relee la conversación y se registra todo saliente RECIENTE cuyo
 * cuerpo sea exactamente el texto enviado o esté vacío (el gemelo del adjunto).
 * La ventana de 3 minutos evita tragarse un saliente viejo de una asesora.
 */
export async function registrarEnvio(
  envio: { messageId?: string },
  conversationId: string,
  contactId: string,
  texto: string,
  conAdjuntos: boolean
): Promise<void> {
  if (envio.messageId) await registrarEnviado(envio.messageId, conversationId, contactId)
  if (!conAdjuntos) return

  const cuerpoEnviado = texto.trim()
  const esGemelo = (m: MensajeGhl): m is MensajeGhl & { id: string } =>
    m.direction === 'outbound' &&
    Boolean(m.id) &&
    m.id !== envio.messageId &&
    Boolean(m.messageType) &&
    !m.messageType!.startsWith('TYPE_ACTIVITY') &&
    Boolean(m.dateAdded) &&
    Date.now() - Date.parse(m.dateAdded!) < 3 * 60_000 &&
    ((m.body ?? '').trim() === cuerpoEnviado || (m.body ?? '').trim() === '')

  try {
    // GHL puede tardar en indexar el mensaje recién creado: un reintento corto.
    for (let intento = 0; intento < 2; intento++) {
      const gemelos = (await ultimosMensajes(conversationId, 6)).filter(esGemelo)
      if (gemelos.length > 0) {
        for (const g of gemelos) await registrarEnviado(g.id, conversationId, contactId)
        return
      }
      if (intento === 0) await new Promise(r => setTimeout(r, 2000))
    }
  } catch (err) {
    // No es fatal: en el peor caso queda el hueco de siempre y se ve en logs.
    console.error('registrarEnvio (gemelos) falló:', (err as Error).message)
  }
}
