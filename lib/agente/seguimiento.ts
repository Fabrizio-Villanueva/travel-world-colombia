import { createAdminClient } from '@/lib/supabase/admin'
import { decidir } from '@/lib/agente/claude'
import {
  agregarTags,
  enviarMensaje,
  obtenerContacto,
  oportunidadesDe,
  rutaDeRespuesta,
  ultimosMensajes,
} from '@/lib/agente/ghl'
import { enHorario, humanoTomoElChat, marcarFuenteAnuncio, registrarEnvio } from '@/lib/agente/conversacion'
import { anuncioParaConversacion } from '@/lib/agente/anuncios'
import { fechaBogota, sincronizarCrm } from '@/lib/agente/crm'
import { extraerFotos } from '@/lib/agente/conocimiento'
import { registrarEvento } from '@/lib/agente/eventos'
import { esFestivo } from '@/lib/agente/festivos'
import {
  CAMPO_IA_NOMBRE,
  HORARIO,
  MAX_INTENTOS_SEGUIMIENTO,
  PIPELINE,
  PIPELINE_LEGACY,
  PIPELINES_POSTVENTA,
  TAGS,
  TAG_PRUEBAS,
} from '@/lib/agente/config'

/**
 * Fase 4: el seguimiento dinámico (§5 del diseño).
 *
 * Un cron llama a `correrSeguimientos()` un par de veces al día. La cola vive
 * en `agente_seguimientos` (una fila por contacto, la escribe `sincronizarCrm`
 * con lo que el modelo decidió en cada turno). Aquí solo se cobra lo vencido:
 * se re-verifica cada compuerta (los tags y la conversación pueden haber
 * cambiado desde que se programó), se compone el mensaje con el modelo y se
 * envía. El modelo puede decidir callar — releyendo, la conversación pudo
 * quedar cerrada — y también reprograma el siguiente intento (decaimiento).
 */

interface FilaSeguimiento {
  contact_id: string
  conversation_id: string
  canal: string | null
  programado_para: string
  intentos: number
  nota: string | null
}

export interface ResumenSeguimientos {
  revisados: number
  enviados: number
  notas: string[]
}

export async function correrSeguimientos(limite = 8): Promise<ResumenSeguimientos> {
  // Ley 2300 de 2023: solo L-V 8-19 y sábados 8-15, nunca domingos ni
  // festivos. La fila no se pierde: `programado_para <= hoy` la recoge en la
  // corrida siguiente.
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
    .select('contact_id, conversation_id, canal, programado_para, intentos, nota')
    .eq('estado', 'pendiente')
    .lte('programado_para', fechaBogota())
    .order('programado_para', { ascending: true })
    .limit(limite)

  if (error) throw new Error(`leyendo la cola: ${error.message}`)

  const filas = (data ?? []) as FilaSeguimiento[]
  const resumen: ResumenSeguimientos = { revisados: filas.length, enviados: 0, notas: [] }

  // Secuencial a propósito: cada contacto implica una llamada al modelo y
  // varias a GHL; en paralelo se pisarían los PUT y dispararíamos rate limits.
  for (const fila of filas) {
    try {
      const nota = await atenderSeguimiento(fila)
      if (nota.startsWith('enviado')) resumen.enviados++
      resumen.notas.push(`${fila.contact_id}: ${nota}`)
    } catch (err) {
      resumen.notas.push(`${fila.contact_id}: falló — ${(err as Error).message}`)
    }
  }

  return resumen
}

async function atenderSeguimiento(fila: FilaSeguimiento): Promise<string> {
  // 404 = el contacto se borró; 400 = el id no es válido (GHL responde 400,
  // no 404, ante ids malformados — verificado). En ambos casos la fila se
  // cierra. Cualquier otro error de GHL es transitorio y se relanza — la fila
  // queda pendiente y la corrida siguiente lo reintenta.
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

  // Si un humano ya movió la oportunidad (o es post-venta), el lead es suyo.
  const oportunidades = await oportunidadesDe(fila.contact_id)
  const enManosHumanas = oportunidades.some(
    o =>
      o.status === 'open' &&
      ((PIPELINES_POSTVENTA as readonly string[]).includes(o.pipelineId ?? '') ||
        (o.pipelineId === PIPELINE.id &&
          (PIPELINE.etapasVedadas as readonly string[]).includes(o.pipelineStageId ?? '')) ||
        (o.pipelineId === PIPELINE_LEGACY.id &&
          (PIPELINE_LEGACY.etapasVedadas as readonly string[]).includes(o.pipelineStageId ?? '')))
  )
  if (enManosHumanas) return cerrar(fila, 'la oportunidad está en territorio humano')

  const mensajes = await ultimosMensajes(fila.conversation_id, 20)
  if (await humanoTomoElChat(mensajes)) {
    // Un humano tomó el chat (cualquier saliente que no es de Sol en la ventana,
    // no solo el último): se apaga a Sol y se cierra la fila. El humano gana.
    await agregarTags(fila.contact_id, [TAGS.stopBot])
    return cerrar(fila, 'un humano escribió en el chat; el lead es suyo')
  }

  const intento = fila.intentos + 1
  const anuncio = await anuncioParaConversacion(fila.conversation_id)
  const decision = await decidir(mensajes, {
    nombre: [contacto.firstName, contacto.lastName].filter(Boolean).join(' ') || undefined,
    nombreConfirmado,
    canal: fila.canal ?? undefined,
    enHorario: enHorario(),
    seguimiento: { intento, maximo: MAX_INTENTOS_SEGUIMIENTO, angulo: fila.nota ?? undefined },
    anuncio,
  })
  marcarFuenteAnuncio(decision, anuncio)

  const habla = decision.accion !== 'callar' && decision.mensaje.trim() !== ''

  if (habla) {
    // Por el mismo canal por el que escribió el cliente (custom provider incluido).
    const { texto, imagenes } = await extraerFotos(decision.mensaje.trim())
    const envio = await enviarMensaje(fila.contact_id, texto, rutaDeRespuesta(mensajes), imagenes)
    await registrarEnvio(envio, fila.conversation_id, fila.contact_id, texto, (imagenes?.length ?? 0) > 0)
  }

  // Escalar avisa al equipo pero no apaga a Sol (espera caliente); el stop_bot
  // lo pone la intervención humana. Consistente con el webhook.
  if (decision.accion === 'escalar') {
    await agregarTags(fila.contact_id, [TAGS.transferenciaHumano])
  }

  // Si el modelo escribió pero olvidó programar el siguiente intento, la
  // cadena de decaimiento no se corta: 3 días por intento, esquivando domingos y festivos.
  if (habla && intento < MAX_INTENTOS_SEGUIMIENTO && !decision.seguimiento) {
    decision.seguimiento = {
      proximo_contacto: fechaEnDias(3 * intento),
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
 * Ventana de contacto comercial de la Ley 2300 de 2023 ("Dejen de fregar"):
 * L-V 7:00-19:00 y sábados 8:00-15:00, nunca domingos ni festivos. Aquí se usa
 * L-V desde las 8 (un margen), en hora de Colombia.
 */
function horaDeSeguimiento(ahora = new Date()): boolean {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: HORARIO.zona,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(ahora)

  const dia = f.find(p => p.type === 'weekday')?.value ?? ''
  const hora = Number(f.find(p => p.type === 'hour')?.value ?? -1)
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(ahora)
  if (dia === 'Sun' || esFestivo(fecha)) return false
  if (dia === 'Sat') return hora >= 8 && hora < 15
  return hora >= 8 && hora < 19
}

/** Fecha de Bogotá + n días en YYYY-MM-DD; si cae domingo o festivo, corre al siguiente día hábil. */
function fechaEnDias(dias: number): string {
  const base = new Date(`${fechaBogota()}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  while (base.getUTCDay() === 0 || esFestivo(base.toISOString().slice(0, 10))) {
    base.setUTCDate(base.getUTCDate() + 1)
  }
  return base.toISOString().slice(0, 10)
}
