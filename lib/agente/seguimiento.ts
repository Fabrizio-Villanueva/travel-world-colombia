import { createAdminClient } from '@/lib/supabase/admin'
import { decidir, type Decision } from '@/lib/agente/claude'
import {
  actualizarCamposOportunidad,
  agregarTags,
  enviarMensaje,
  obtenerContacto,
  oportunidadesDe,
  rutaDeRespuesta,
  ultimosMensajes,
  type MensajeGhl,
} from '@/lib/agente/ghl'
import { enHorario, humanoTomoElChat, marcarFuenteAnuncio, registrarEnvio } from '@/lib/agente/conversacion'
import { anuncioParaConversacion } from '@/lib/agente/anuncios'
import { fechaBogota, fechaHabilEnDias, horaBogota, sincronizarCrm } from '@/lib/agente/crm'
import { extraerFotos } from '@/lib/agente/conocimiento'
import { registrarEvento } from '@/lib/agente/eventos'
import { esFestivo } from '@/lib/agente/festivos'
import { costoUsd, decidirV2 } from '@/lib/agente/v2/decidir'
import { enviarRespuestaV2, estadoPrevioV2, registrarTurnoAB, versionPara } from '@/lib/agente/v2/ab'
import { productoDeInteres } from '@/lib/agente/v2/ficha'
import {
  CAMPO_IA_NOMBRE,
  CAMPOS_SOL_OPP,
  HORARIO,
  MAX_INTENTOS_SEGUIMIENTO,
  PIPELINE,
  PIPELINES_POSTVENTA,
  TAGS,
  TAG_PRUEBAS,
} from '@/lib/agente/config'

/**
 * Fase 4: el seguimiento dinámico (§5 del diseño).
 *
 * Un cron llama a `correrSeguimientos()` cada hora dentro de la ventana legal.
 * La cola vive en `agente_seguimientos` (una fila por contacto, la escribe
 * `sincronizarCrm` en cada turno). Revisar la cola no gasta IA: el modelo solo
 * se llama cuando un seguimiento vence Y pasó todas las compuertas (los tags y
 * la conversación pueden haber cambiado desde que se programó).
 *
 * Solo se persigue a leads que Sol todavía no ha pasado al equipo: si ya fue a
 * L-01 (sol_calificado / "Calificado por Bot"), se escaló, o un humano escribió
 * o movió la tarjeta, la fila se cierra.
 *
 * Sol v2: el intento 3 es una despedida fija con la ficha del producto (sin
 * IA); los intentos 1 y 2 los redacta el modelo.
 */

interface FilaSeguimiento {
  contact_id: string
  conversation_id: string
  canal: string | null
  programado_para: string
  intentos: number
  nota: string | null
  hora: number | null
  fallos: number
}

export interface ResumenSeguimientos {
  revisados: number
  enviados: number
  notas: string[]
}

/** Hora por defecto si no se sabe a qué hora escribe el cliente. */
const HORA_POR_DEFECTO = 10
/** Un seguimiento vencido hace más de esto ya no tiene sentido: se cierra. */
const MAX_DIAS_VENCIDO = 5
/** Envíos fallidos antes de cerrar la fila (antes un fallo la dejaba atascada para siempre). */
const MAX_FALLOS = 2
/**
 * Instagram/Facebook: Meta solo deja escribir un tiempo después del último
 * mensaje del cliente (GHL lo extiende con la etiqueta de agente humano). Más
 * allá, el envío falla: se cierra ANTES de llamar a la IA. En agosto-octubre
 * seis filas de Instagram gastaron una llamada al modelo dos veces al día para
 * luego fallar al enviar.
 */
const VENTANA_META_DIAS = 7

export async function correrSeguimientos(limite = 8): Promise<ResumenSeguimientos> {
  // Ley 2300 de 2023: solo L-V 8-19 y sábados 8-15, nunca domingos ni
  // festivos. La fila no se pierde: la recoge una corrida siguiente.
  if (!horaDeSeguimiento()) {
    return {
      revisados: 0,
      enviados: 0,
      notas: ['fuera de la ventana de seguimiento (L-V 8-19, sáb 8-15 Bogotá; domingos y festivos no)'],
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_seguimientos')
    .select('contact_id, conversation_id, canal, programado_para, intentos, nota, hora, fallos')
    .eq('estado', 'pendiente')
    .lte('programado_para', fechaBogota())
    .order('programado_para', { ascending: true })
    .limit(100)

  if (error) throw new Error(`leyendo la cola: ${error.message}`)

  // Solo los que ya llegaron a su hora (sin IA: es comparar números).
  const filas = ((data ?? []) as FilaSeguimiento[]).filter(f => yaEsSuHora(f)).slice(0, limite)
  const resumen: ResumenSeguimientos = { revisados: filas.length, enviados: 0, notas: [] }

  // Secuencial a propósito: cada contacto implica una llamada al modelo y
  // varias a GHL; en paralelo se pisarían los PUT y dispararíamos rate limits.
  for (const fila of filas) {
    try {
      const nota = await atenderSeguimiento(fila)
      if (nota.startsWith('enviado')) resumen.enviados++
      resumen.notas.push(`${fila.contact_id}: ${nota}`)
    } catch (err) {
      // Un fallo ya no atasca la cola: se reintenta otro día y, si insiste, se cierra.
      const nota = await registrarFallo(fila, (err as Error).message).catch(e => `falló y no se pudo registrar: ${(e as Error).message}`)
      resumen.notas.push(`${fila.contact_id}: ${nota}`)
    }
  }

  return resumen
}

/**
 * ¿Ya toca? Días anteriores, sí. El día programado, desde la hora a la que el
 * cliente solía escribir, acotada a la ventana (un mensaje de las 11 p. m. se
 * sigue a las 6 p. m.; uno de las 3 a. m., a las 8 a. m.).
 */
function yaEsSuHora(f: FilaSeguimiento): boolean {
  if (f.programado_para < fechaBogota()) return true
  const esSabado = new Date(`${f.programado_para}T12:00:00Z`).getUTCDay() === 6
  const ultima = esSabado ? 14 : 18
  const hora = Math.min(Math.max(f.hora ?? HORA_POR_DEFECTO, 8), ultima)
  return horaBogota() >= hora
}

async function atenderSeguimiento(fila: FilaSeguimiento): Promise<string> {
  const diasVencido = (Date.parse(fechaBogota()) - Date.parse(fila.programado_para)) / 86_400_000
  if (diasVencido > MAX_DIAS_VENCIDO) return cerrar(fila, `vencido hace ${diasVencido} días; ya no tiene sentido escribir`)

  // 404 = el contacto se borró; 400 = el id no es válido (GHL responde 400,
  // no 404, ante ids malformados — verificado). En ambos casos la fila se
  // cierra. Cualquier otro error de GHL es transitorio y se relanza.
  const contacto = await obtenerContacto(fila.contact_id).catch(err => {
    if (/respondió 40[04]/.test(String((err as Error).message))) return null
    throw err
  })
  if (!contacto) return cerrar(fila, 'el contacto ya no existe en GHL')

  const tags = contacto.tags ?? []
  const nombreConfirmado =
    (contacto.customFields?.find(f => f.id === CAMPO_IA_NOMBRE)?.value as string | undefined)?.trim() ||
    undefined
  if (TAG_PRUEBAS && !tags.includes(TAG_PRUEBAS)) {
    return `saltado: modo prueba (falta el tag ${TAG_PRUEBAS})`
  }
  if (tags.includes(TAGS.stopBot)) return cerrar(fila, 'el contacto tiene stop_bot')
  if (tags.some(t => (TAGS.noCliente as readonly string[]).includes(t))) {
    return cerrar(fila, 'proveedor/mayorista')
  }
  // Ya pasó al equipo: L-01 (sol_calificado) o escalada. De ahí en adelante es de una persona.
  if (tags.includes(TAGS.calificado)) return cerrar(fila, 'ya pasó a L-01 (sol_calificado)')
  if (tags.includes(TAGS.transferenciaHumano)) return cerrar(fila, 'ya se escaló al equipo')

  // Si un humano ya movió la oportunidad (o es post-venta), el lead es suyo.
  const oportunidades = await oportunidadesDe(fila.contact_id)
  const enManosHumanas = oportunidades.some(
    o =>
      o.status === 'open' &&
      ((PIPELINES_POSTVENTA as readonly string[]).includes(o.pipelineId ?? '') ||
        (o.pipelineId === PIPELINE.id &&
          ((PIPELINE.etapasVedadas as readonly string[]).includes(o.pipelineStageId ?? '') ||
            o.pipelineStageId === PIPELINE.etapas.calificadoPorBot)))
  )
  if (enManosHumanas) return cerrar(fila, 'la oportunidad ya está con el equipo (L-01 o más allá)')

  const mensajes = await ultimosMensajes(fila.conversation_id, 20)
  if (await humanoTomoElChat(mensajes)) {
    // Un humano tomó el chat (cualquier saliente que no es de Sol en la ventana,
    // no solo el último): se apaga a Sol y se cierra la fila. El humano gana.
    await agregarTags(fila.contact_id, [TAGS.stopBot])
    return cerrar(fila, 'un humano escribió en el chat; el lead es suyo')
  }

  const fueraDeVentana = fueraDeVentanaMeta(mensajes)
  if (fueraDeVentana) return cerrar(fila, fueraDeVentana)

  const intento = fila.intentos + 1
  const anuncio = await anuncioParaConversacion(fila.conversation_id)
  // Prueba A/B: el grupo ya quedó fijado en el primer mensaje (no se asigna aquí).
  const version = await versionPara(fila.contact_id, tags, false)

  if (version === 'v2') {
    const salientes = mensajes.filter(m => m.direction !== 'inbound').map(m => m.body ?? '')
    const producto = await productoDeInteres(salientes, anuncio?.slugs ?? [])
    if (intento >= MAX_INTENTOS_SEGUIMIENTO) {
      return despedidaFija(fila, { mensajes, nombreConfirmado, producto, intento })
    }
    return seguimientoConIa(fila, { mensajes, tags, contacto, nombreConfirmado, anuncio, version, intento, producto })
  }
  return seguimientoConIa(fila, { mensajes, tags, contacto, nombreConfirmado, anuncio, version, intento })
}

/**
 * Instagram/Facebook: si el último mensaje del cliente es más viejo que la
 * ventana, el envío fallaría. Devuelve el motivo para cerrar, o null.
 */
function fueraDeVentanaMeta(mensajes: MensajeGhl[]): string | null {
  const ultimoDelCliente = mensajes.find(m => m.direction === 'inbound')
  const tipo = ultimoDelCliente?.messageType ?? ''
  if (!/INSTAGRAM|FACEBOOK/.test(tipo) || !ultimoDelCliente?.dateAdded) return null
  const dias = (Date.now() - Date.parse(ultimoDelCliente.dateAdded)) / 86_400_000
  if (dias <= VENTANA_META_DIAS) return null
  const red = tipo.includes('INSTAGRAM') ? 'Instagram' : 'Facebook'
  return `${red}: el cliente escribió hace ${Math.floor(dias)} días, fuera de la ventana de Meta (${VENTANA_META_DIAS} días)`
}

async function seguimientoConIa(
  fila: FilaSeguimiento,
  c: {
    mensajes: MensajeGhl[]
    tags: string[]
    contacto: { firstName?: string; lastName?: string }
    nombreConfirmado?: string
    anuncio: Awaited<ReturnType<typeof anuncioParaConversacion>>
    version: 'v1' | 'v2'
    intento: number
    producto?: { slug: string; nombre: string } | null
  }
): Promise<string> {
  const { mensajes, tags, nombreConfirmado, anuncio, version, intento } = c
  const nombreWhatsapp = [c.contacto.firstName, c.contacto.lastName].filter(Boolean).join(' ') || undefined
  const seguimiento = {
    intento,
    maximo: MAX_INTENTOS_SEGUIMIENTO,
    angulo: fila.nota ?? undefined,
    ...(c.producto ? { producto: c.producto } : {}),
  }
  let costoV2: number | undefined
  let decision: Decision
  if (version === 'v2') {
    const r = await decidirV2(mensajes, {
      nombre: nombreWhatsapp,
      nombreConfirmado,
      canal: fila.canal ?? undefined,
      seguimiento,
      anuncio,
      estadoPrevio: await estadoPrevioV2(fila.contact_id),
    })
    decision = r.decision
    costoV2 = costoUsd(r.uso)
  } else {
    decision = await decidir(mensajes, {
      nombre: nombreWhatsapp,
      nombreConfirmado,
      canal: fila.canal ?? undefined,
      enHorario: enHorario(),
      seguimiento,
      anuncio,
    })
  }
  marcarFuenteAnuncio(decision, anuncio)

  const habla = decision.accion !== 'callar' && decision.mensaje.trim() !== ''
  let tarjetasEnviadas: { titulo: string; boton: string }[] | undefined

  if (habla) {
    // Por el mismo canal por el que escribió el cliente (custom provider incluido).
    const ruta = rutaDeRespuesta(mensajes)
    if (version === 'v2') {
      tarjetasEnviadas = (await enviarRespuestaV2(decision, { contactId: fila.contact_id, conversationId: fila.conversation_id, ruta })).tarjetas
    } else {
      const { texto, imagenes } = await extraerFotos(decision.mensaje.trim())
      const envio = await enviarMensaje(fila.contact_id, texto, ruta, imagenes)
      await registrarEnvio(envio, fila.conversation_id, fila.contact_id, texto, (imagenes?.length ?? 0) > 0)
    }
  }

  await registrarTurnoAB({
    contactId: fila.contact_id,
    conversationId: fila.conversation_id,
    version,
    origen: 'seguimiento',
    mensaje: habla ? decision.mensaje.trim() : undefined,
    tarjetas: tarjetasEnviadas,
    decision,
    costoUsd: costoV2,
  })

  // Escalar avisa al equipo pero no apaga a Sol (espera caliente); el stop_bot
  // lo pone la intervención humana. Consistente con el webhook.
  if (decision.accion === 'escalar') {
    await agregarTags(fila.contact_id, [TAGS.transferenciaHumano])
  }

  // v1: si el modelo escribió pero olvidó programar el siguiente intento, la
  // cadena de decaimiento no se corta. (v2 la agenda siempre el código.)
  if (version === 'v1' && habla && intento < MAX_INTENTOS_SEGUIMIENTO && !decision.seguimiento) {
    decision.seguimiento = {
      proximo_contacto: fechaHabilEnDias(3 * intento),
      angulo: fila.nota ?? 'retomar con algo nuevo del catálogo',
    }
  }

  const notasCrm = await sincronizarCrm({
    contactId: fila.contact_id,
    conversationId: fila.conversation_id,
    canal: fila.canal ?? undefined,
    decision,
    tags, // snapshot del turno: hace idempotente el handoff (tag/nota una sola vez)
    nombreConfirmado, // evita re-escribir ia__nombre si no cambió
    // Un intento solo cuenta si de verdad escribimos; callar y reprogramar no gasta.
    intentos: habla ? intento : fila.intentos,
    origen: 'seguimiento',
  })

  const nota = [
    habla ? `enviado (intento ${intento}): ${decision.motivo}` : `calló: ${decision.motivo}`,
    ...notasCrm,
  ].join(' · ')

  await registrarEvento({
    tipo: 'seguimiento',
    conversationId: fila.conversation_id,
    contactId: fila.contact_id,
    direccion: habla ? 'outbound' : undefined,
    autor: 'sol',
    canal: fila.canal ?? undefined,
    cuerpo: habla ? decision.mensaje.trim() : undefined,
    payload: { seguimiento: { intento, programado_para: fila.programado_para, decision } },
    nota: `SEGUIMIENTO → ${nota}`,
  })

  return nota
}

/**
 * Sol v2, último intento: despedida fija (0 tokens) con la tarjeta del producto
 * que le interesó, si lo hay. Después el lead queda dormido.
 */
async function despedidaFija(
  fila: FilaSeguimiento,
  c: { mensajes: MensajeGhl[]; nombreConfirmado?: string; producto: { slug: string; nombre: string } | null; intento: number }
): Promise<string> {
  const nombre = c.nombreConfirmado?.split(/\s+/)[0]
  const saludo = nombre ? `¡Hola, ${nombre}! 😊` : '¡Hola! 😊'
  const mensaje = c.producto
    ? `${saludo} Te dejo por aquí la info del plan por si quieres revisarla con calma. Cuando quieras retomamos tu viaje: me escribes y con gusto te ayudo. [ficha:${c.producto.slug}|Para que lo revises con calma]`
    : `${saludo} No quiero llenarte de mensajes, así que te dejo por aquí: cuando quieras retomar tu viaje, me escribes y con gusto te ayudo.`

  const decision: Decision = {
    accion: 'responder',
    motivo: `despedida fija del intento ${c.intento} (sin IA)`,
    mensaje,
    temperatura: 'no_aplica',
    datos: {},
  }
  const ruta = rutaDeRespuesta(c.mensajes)
  const enviado = await enviarRespuestaV2(decision, { contactId: fila.contact_id, conversationId: fila.conversation_id, ruta })

  const admin = createAdminClient()
  const { error } = await admin
    .from('agente_seguimientos')
    .update({
      estado: 'dormido',
      programado_para: null,
      intentos: c.intento,
      fallos: 0,
      nota: `sin respuesta tras ${c.intento} seguimientos`,
      actualizado_en: new Date().toISOString(),
    })
    .eq('contact_id', fila.contact_id)
  if (error) throw new Error(`durmiendo la fila: ${error.message}`)

  // Espejo en la tarjeta de Leads (sin pisar el resto de campos de Sol).
  const abierta = (await oportunidadesDe(fila.contact_id)).find(o => o.pipelineId === PIPELINE.id && o.status === 'open')
  if (abierta) {
    await actualizarCamposOportunidad(abierta.id, [
      { id: CAMPOS_SOL_OPP.estadoComercial, field_value: 'dormido' },
      { id: CAMPOS_SOL_OPP.intentosSeguimiento, field_value: c.intento },
    ]).catch(err => console.error('campos de Sol (dormido):', (err as Error).message))
  }

  await registrarTurnoAB({
    contactId: fila.contact_id,
    conversationId: fila.conversation_id,
    version: 'v2',
    origen: 'seguimiento',
    mensaje: enviado.texto,
    tarjetas: enviado.tarjetas,
    decision,
    costoUsd: 0,
  })

  const nota = `enviado (intento ${c.intento}): despedida fija${c.producto ? ` con la ficha de ${c.producto.nombre}` : ''} · queda dormido`
  await registrarEvento({
    tipo: 'seguimiento',
    conversationId: fila.conversation_id,
    contactId: fila.contact_id,
    direccion: 'outbound',
    autor: 'sol',
    canal: fila.canal ?? undefined,
    cuerpo: mensaje,
    payload: { seguimiento: { intento: c.intento, programado_para: fila.programado_para, decision } },
    nota: `SEGUIMIENTO → ${nota}`,
  })
  return nota
}

/** Cierra la fila sin gastar modelo, dejando el motivo a la vista. */
async function cerrar(fila: FilaSeguimiento, motivo: string): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('agente_seguimientos')
    .update({ estado: 'cerrado', nota: motivo, actualizado_en: new Date().toISOString() })
    .eq('contact_id', fila.contact_id)
  if (error) throw new Error(`cerrando la fila: ${error.message}`)
  return `cerrado: ${motivo}`
}

/**
 * Un seguimiento que falló se reintenta el siguiente día hábil (sin bloquear a
 * los demás); al llegar a MAX_FALLOS se cierra. Queda en la bitácora.
 */
async function registrarFallo(fila: FilaSeguimiento, motivo: string): Promise<string> {
  const fallos = (fila.fallos ?? 0) + 1
  const cierra = fallos >= MAX_FALLOS
  const admin = createAdminClient()
  const { error } = await admin
    .from('agente_seguimientos')
    .update(
      cierra
        ? { estado: 'cerrado', fallos, nota: `falló ${fallos} veces: ${motivo.slice(0, 200)}`, actualizado_en: new Date().toISOString() }
        : { fallos, programado_para: fechaHabilEnDias(1), actualizado_en: new Date().toISOString() }
    )
    .eq('contact_id', fila.contact_id)
  if (error) throw new Error(error.message)

  const nota = cierra ? `cerrado tras ${fallos} fallos — ${motivo}` : `falló (${fallos}/${MAX_FALLOS}), reintenta mañana — ${motivo}`
  await registrarEvento({
    tipo: 'seguimiento',
    conversationId: fila.conversation_id,
    contactId: fila.contact_id,
    autor: 'sol',
    canal: fila.canal ?? undefined,
    payload: { seguimiento: { intento: fila.intentos + 1, programado_para: fila.programado_para, fallos, error: motivo } },
    nota: `SEGUIMIENTO → ${nota}`,
  })
  return nota
}

/**
 * Ventana de contacto comercial de la Ley 2300 de 2023 ("Dejen de fregar"):
 * L-V 7:00-19:00 y sábados 8:00-15:00, nunca domingos ni festivos. Aquí se usa
 * L-V desde las 8 (un margen), en hora de Colombia.
 */
function horaDeSeguimiento(ahora = new Date()): boolean {
  const dia = new Intl.DateTimeFormat('en-US', { timeZone: HORARIO.zona, weekday: 'short' }).format(ahora)
  const hora = horaBogota(ahora)
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(ahora)
  if (dia === 'Sun' || esFestivo(fecha)) return false
  if (dia === 'Sat') return hora >= 8 && hora < 15
  return hora >= 8 && hora < 19
}
