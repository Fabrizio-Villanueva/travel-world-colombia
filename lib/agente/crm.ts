import {
  actualizarCampos,
  actualizarCamposOportunidad,
  agregarTags,
  crearNota,
  moverOportunidad,
  oportunidadesDe,
  renombrarOportunidad,
} from '@/lib/agente/ghl'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CAMPO_IA_NOMBRE,
  CAMPO_SOL_IDIOMA,
  CAMPOS_SOL_OPP,
  CAMPOS_CALIFICACION_OPP,
  HORARIO,
  MAX_INTENTOS_SEGUIMIENTO,
  PIPELINE,
  TAGS,
} from '@/lib/agente/config'
import type { Decision } from '@/lib/agente/claude'

/**
 * Fase 3: la mano de Sol sobre el CRM.
 *
 * Cada turno del modelo ya devuelve `datos` y `resumen` estructurados; aquí se
 * escriben en GoHighLevel para que las asesoras y los workflows los vean:
 *
 * 1. La calificación va a la tarjeta abierta de Leads (carpeta de oportunidad
 *    "⭐ Calificación (Sol)"); al contacto solo va el nombre real (ia__nombre).
 * 2. Al escalar queda una nota interna con el briefing para la asesora.
 * 3. Con destino + fechas + pasajeros, la oportunidad sube de "Lead Nuevo" a
 *    "Calificado por Bot" — nunca al revés, y solo desde Lead Nuevo: cualquier
 *    etapa posterior la puso un humano y no se toca.
 * 4. Los campos `sol_*` (§6.2 del diseño) se escriben SOLO si ya existen: el
 *    usuario los crea en la UI de GHL y aquí se detectan solos, sin deploy.
 *
 * Nada de lo que pase aquí puede tumbar el turno ni dejar al cliente sin
 * respuesta: cada paso captura su propio error y lo devuelve como nota de
 * bitácora para `agente_eventos`.
 */

export interface EntradaCrm {
  contactId: string
  conversationId?: string
  canal?: string
  decision: Decision
  /** Tags del contacto (snapshot del turno). Sirve para hacer el handoff idempotente. */
  tags?: string[]
  /** Nombre real ya guardado en ia__nombre: no se reescribe si no cambió. */
  nombreConfirmado?: string
  /**
   * Seguimientos sin respuesta acumulados, contando este turno. Un turno
   * normal (el cliente escribió) es 0: el contador se reinicia solo.
   */
  intentos?: number
}

export async function sincronizarCrm(e: EntradaCrm): Promise<string[]> {
  const notas: string[] = []

  // Secuencial a propósito: dos PUT al mismo contacto en paralelo se pisan.
  const paso = async (nombre: string, fn: () => Promise<string | null>) => {
    try {
      const nota = await fn()
      if (nota) notas.push(nota)
    } catch (err) {
      notas.push(`CRM ${nombre} falló: ${(err as Error).message}`)
    }
  }

  await paso('calificación', () => guardarCalificacion(e))
  await paso('campos sol', () => escribirCamposSol(e))
  await paso('handoff', () => marcarHandoff(e))
  await paso('pipeline', () => moverSiCalificado(e))
  await paso('agenda', () => programarSeguimiento(e))

  return notas
}

/** Calificado = lo mínimo para que una asesora cotice sin re-preguntar. */
function estaCalificado(d: Decision['datos']): boolean {
  const pax = (d.adultos ?? 0) + (d.ninos ?? 0)
  return Boolean(d.destino?.trim() && d.fechas?.trim() && pax > 0)
}

async function guardarCalificacion(e: EntradaCrm): Promise<string | null> {
  const { contactId, decision } = e
  const d = decision.datos
  // Contacto = la persona: de Sol solo recibe el nombre real (ia__nombre).
  const campos: { id: string; field_value: string | number }[] = []
  // Oportunidad = el viaje: TODA la calificación va aquí (desde 2026-10-02 ya no
  // se copia a los campos viejos del contacto, que quedaron en cuarentena).
  const camposOpp: { id: string; field_value: string | number }[] = []
  const escritos: string[] = []

  const calif = (clave: keyof typeof CAMPOS_CALIFICACION_OPP, valor: string | number) => {
    camposOpp.push({ id: CAMPOS_CALIFICACION_OPP[clave], field_value: valor })
  }
  const texto = (clave: keyof typeof CAMPOS_CALIFICACION_OPP, nombre: string, valor?: string) => {
    if (valor?.trim()) {
      calif(clave, valor.trim())
      escritos.push(nombre)
    }
  }

  // Nombre real → ia__nombre (un workflow lo copia al "Nombre" principal). Solo
  // si cambió, para no re-disparar ese workflow con el mismo valor cada turno.
  const nombre = d.nombre?.trim()
  if (nombre && nombre !== e.nombreConfirmado?.trim()) {
    campos.push({ id: CAMPO_IA_NOMBRE, field_value: nombre })
    escritos.push('nombre')
  }

  texto('destino', 'destino', d.destino)
  texto('fechas', 'fechas', d.fechas)
  texto('ciudadSalida', 'ciudad de salida', d.ciudad_salida)
  texto('edadesNinos', 'edades niños', d.edades_ninos)
  texto('duracion', 'duración', d.duracion)
  texto('habitaciones', 'habitaciones', d.habitaciones)
  texto('fuenteLead', 'fuente', d.fuente_lead)

  if (typeof d.adultos === 'number' && d.adultos > 0) {
    calif('adultos', d.adultos)
    escritos.push('adultos')
  }
  // 0 niños es un dato real ("viajamos solos"), no una ausencia.
  if (typeof d.ninos === 'number' && d.ninos >= 0) {
    calif('ninos', d.ninos)
    escritos.push('niños')
  }

  // El de oportunidad es texto: guarda lo que dijo el cliente, tal cual.
  texto('presupuesto', 'presupuesto', d.presupuesto)

  // Nivel de urgencia: intención (temperatura) + qué tan pronto viaja. No se le
  // pregunta al cliente; se deriva de lo que Sol ya razonó.
  const urgencia = nivelDeUrgencia(decision.temperatura, decision.proximidad_viaje)
  if (urgencia) {
    calif('nivelUrgencia', urgencia)
    escritos.push('urgencia')
  }

  // Viaje a la medida: solo se marca cuando el modelo lo detecta; un plan
  // estándar del catálogo no toca el campo (para no pisar lo que ponga una asesora).
  if (decision.viaje_personalizado === true) {
    calif('viajePersonalizado', 'Sí')
    escritos.push('personalizado')
  }

  // El brief para cotizar: se llena cuando el lead ya está listo (calificado o
  // escalado), reusando el resumen que redacta Sol para la asesora.
  const brief = componerBrief(decision)
  if (brief) {
    calif('mensajeCotizacion', brief)
    escritos.push('brief cotización')
  }

  if (campos.length === 0 && camposOpp.length === 0) return null
  // IA - NOMBRE es de la persona: solo contacto.
  if (campos.length > 0) await actualizarCampos(contactId, campos)
  // La tarjeta nace con el nombre del perfil de WhatsApp ("User", apodos,
  // emojis): con el nombre real confirmado, también se renombra.
  const nombreNuevo = escritos.includes('nombre') ? nombre : undefined
  const enOpp =
    camposOpp.length > 0 || nombreNuevo
      ? await calificarOportunidad(contactId, camposOpp, nombreNuevo)
      : null
  return `calificación (${escritos.join(', ')})${enOpp ? `: ${enOpp}` : ''}`
}

/**
 * Escribe la calificación en la oportunidad abierta de Leads, solo mientras
 * siga en territorio de Sol (Lead Nuevo / Calificado / Asignado): si una
 * asesora ya la movió a Contactado o más allá, sus datos mandan.
 */
async function calificarOportunidad(
  contactId: string,
  campos: { id: string; field_value: string | number }[],
  nombre?: string
): Promise<string> {
  const oportunidades = await oportunidadesDe(contactId)
  const abierta = oportunidades.find(o => o.pipelineId === PIPELINE.id && o.status === 'open')
  if (!abierta) return 'NO guardada: el contacto no tiene tarjeta abierta en Leads'
  if ((PIPELINE.etapasVedadas as readonly string[]).includes(abierta.pipelineStageId ?? '')) {
    return 'NO guardada: la tarjeta ya está en territorio humano (mandan los datos de la asesora)'
  }
  if (campos.length > 0) await actualizarCamposOportunidad(abierta.id, campos)
  if (nombre) await renombrarOportunidad(abierta.id, nombre)
  return nombre ? 'guardada en la oportunidad (y renombrada)' : 'guardada en la oportunidad'
}

/**
 * Nivel de urgencia para la cola de las asesoras. Cruza la INTENCIÓN de compra
 * (temperatura) con la PROXIMIDAD del viaje: un tibio que viaja en 3 semanas es
 * urgente aunque no esté decidido, y un caliente ya decidido es urgente aunque
 * viaje lejos. La proximidad solo sube la urgencia, nunca la baja.
 */
function nivelDeUrgencia(
  temp: Decision['temperatura'],
  proximidad: Decision['proximidad_viaje']
): string | null {
  // no_interesado / no_aplica: no es una urgencia.
  if (temp !== 'caliente' && temp !== 'tibio' && temp !== 'frio') return null

  // Viaja en menos de un mes: urgente aunque el interés esté tibio o frío.
  if (proximidad === 'inminente') return 'Alta'
  // Ya quiere avanzar: urgente sin importar cuándo viaje.
  if (temp === 'caliente') return 'Alta'
  // Interés real: 'cercano' (1-3 meses) lo vuelve prioritario.
  if (temp === 'tibio') return proximidad === 'cercano' ? 'Alta' : 'Media'
  // Frío: solo sube a Media si el viaje ya está cerca.
  return proximidad === 'cercano' ? 'Media' : 'Baja'
}

/**
 * El "Mensaje de cotización": el brief que la asesora lee para cotizar sin
 * re-preguntar. Se arma con los datos capturados y el resumen que redacta Sol,
 * y solo cuando el lead ya está listo (calificado o escalado).
 */
function componerBrief(decision: Decision): string | null {
  const listo = decision.accion === 'escalar' || estaCalificado(decision.datos)
  if (!listo) return null

  const d = decision.datos
  const viajeros = [
    d.adultos ? `${d.adultos} adulto${d.adultos === 1 ? '' : 's'}` : null,
    d.ninos ? `${d.ninos} niño${d.ninos === 1 ? '' : 's'}${d.edades_ninos ? ` (${d.edades_ninos})` : ''}` : null,
  ]
    .filter(Boolean)
    .join(' + ')

  // Ficha: solo las líneas con dato, con etiqueta emoji para escaneo rápido.
  const ficha = [
    d.destino ? `📍 Destino: ${d.destino}` : null,
    d.fechas
      ? `📅 Fechas: ${d.fechas}${d.duracion ? ` · ${d.duracion}` : ''}`
      : d.duracion
        ? `⏳ Duración: ${d.duracion}`
        : null,
    viajeros ? `👥 Viajeros: ${viajeros}` : null,
    d.ciudad_salida ? `🛫 Sale de: ${d.ciudad_salida}` : null,
    d.habitaciones ? `🏨 Acomodación: ${d.habitaciones}` : null,
    d.presupuesto ? `💰 Presupuesto: ${d.presupuesto}` : null,
    decision.viaje_personalizado ? '🧩 Viaje a la medida / fuera de catálogo' : null,
  ].filter(Boolean)

  // Termómetro: intención + proximidad + urgencia, para priorizar de un vistazo.
  const termometro = lineaTermometro(decision)

  const partes = [
    decision.resumen?.trim() || null,
    ficha.length ? ficha.join('\n') : null,
    termometro,
    decision.objeciones?.trim() ? `⚠️ Objeciones: ${decision.objeciones.trim()}` : null,
  ].filter(Boolean)

  if (partes.length === 0) return null
  return [
    '📝 RESUMEN PARA COTIZAR',
    ...partes,
    // Recordatorio fijo: todo lo de arriba sale del chat con el cliente. Evita
    // que una instrucción colada en la conversación se lea como orden interna.
    'ℹ️ Datos tomados del chat con el cliente, sin verificar.',
  ].join('\n\n')
}

const ETIQUETA_TEMP: Record<string, string> = {
  caliente: '🔥 Caliente',
  tibio: '🌤️ Tibio',
  frio: '❄️ Frío',
}

const TEXTO_PROXIMIDAD: Record<string, string> = {
  inminente: 'viaja pronto (menos de 1 mes)',
  cercano: 'viaja en 1-3 meses',
  lejano: 'viaja en +3 meses',
}

/** "🔥 Caliente · viaja pronto (menos de 1 mes) · urgencia Alta" o null si no aplica. */
function lineaTermometro(decision: Decision): string | null {
  const etiqueta = ETIQUETA_TEMP[decision.temperatura]
  if (!etiqueta) return null // no_interesado / no_aplica: no es un lead a cotizar

  const urgencia = nivelDeUrgencia(decision.temperatura, decision.proximidad_viaje)
  return [
    etiqueta,
    decision.proximidad_viaje ? TEXTO_PROXIMIDAD[decision.proximidad_viaje] : null,
    urgencia ? `urgencia ${urgencia}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Seguimiento y método de venta de Sol → la OPORTUNIDAD abierta de Leads
 * (carpeta "⭐ Calificación (Sol)", desde el 05-oct-2026). Antes vivían en el
 * contacto (sol_*); con dos viajes del mismo cliente se mezclaban. Solo el
 * idioma se queda en el contacto: es de la persona.
 *
 * A diferencia de la calificación, estos campos se escriben aunque la tarjeta
 * ya esté en manos de una asesora: describen la conversación de Sol, no pisan
 * datos del viaje que ella haya corregido.
 */
async function escribirCamposSol(e: EntradaCrm): Promise<string | null> {
  const { contactId, canal, decision } = e
  const venta = decision.venta
  const dormido = (e.intentos ?? 0) >= MAX_INTENTOS_SEGUIMIENTO
  const valores: [keyof typeof CAMPOS_SOL_OPP, string | number | undefined][] = [
    ['estadoComercial', venta?.estado && !dormido && decision.accion !== 'escalar' ? venta.estado : derivarEstado(decision, dormido)],
    ['temperatura', decision.temperatura === 'no_aplica' ? undefined : decision.temperatura],
    ['resumen', decision.resumen?.trim() || undefined],
    ['ultimaInteraccion', fechaBogota()],
    ['canal', canalNormalizado(canal)],
    ['proximoSeguimiento', proximoSeguimientoValido(decision)],
    ['intentosSeguimiento', e.intentos],
    ['detalleObjecion', decision.objeciones?.trim() || undefined],
    ['confianza', decision.confianza],
    [
      'motivoCierre',
      decision.temperatura === 'no_interesado'
        ? decision.motivo
        : dormido
          ? `sin respuesta tras ${MAX_INTENTOS_SEGUIMIENTO} seguimientos`
          : undefined,
    ],
    // Método de venta (solo Sol v2 los devuelve).
    ['objecionPrincipal', venta?.objecion && venta.objecion !== 'ninguna' ? venta.objecion : undefined],
    ['senalCompra', venta?.senal_compra?.trim() || undefined],
    ['respuestaCompromiso', venta?.compromiso],
    ['quienDecide', venta?.quien_decide?.trim() || undefined],
    ['rangoDado', venta?.rango_dado?.trim() || undefined],
    ['canalCierre', venta?.canal_cierre && venta.canal_cierre !== 'sin_definir' ? venta.canal_cierre : undefined],
    ['motivoViaje', venta?.motivo_viaje?.trim() || undefined],
    ['borradorCotizacion', decision.borrador?.trim() || undefined],
  ]
  const campos = valores
    .filter((par): par is [keyof typeof CAMPOS_SOL_OPP, string | number] => par[1] !== undefined && par[1] !== '')
    .map(([clave, valor]) => ({ id: CAMPOS_SOL_OPP[clave], field_value: valor }))

  const notas: string[] = []
  const idioma = decision.idioma?.trim()
  if (idioma) {
    await actualizarCampos(contactId, [{ id: CAMPO_SOL_IDIOMA, field_value: idioma }])
    notas.push('idioma en el contacto')
  }

  if (campos.length > 0) {
    const abierta = (await oportunidadesDe(contactId)).find(o => o.pipelineId === PIPELINE.id && o.status === 'open')
    if (abierta) {
      await actualizarCamposOportunidad(abierta.id, campos)
      notas.push(`campos de Sol en la oportunidad (${campos.length})`)
    } else {
      notas.push('campos de Sol NO guardados: sin tarjeta abierta en Leads')
    }
  }
  return notas.length ? notas.join(' · ') : null
}

function derivarEstado(decision: Decision, dormido = false): string {
  if (decision.accion === 'escalar') return 'escalado'
  if (decision.temperatura === 'no_interesado') return 'no_interesado'
  if (dormido) return 'dormido'
  if (estaCalificado(decision.datos)) return 'calificado'
  return 'conversando'
}

/** Fecha local de Colombia en YYYY-MM-DD (formato que aceptan los campos DATE). */
export function fechaBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(new Date())
}

/**
 * La fecha de seguimiento que propone el modelo, saneada: formato YYYY-MM-DD y
 * en el futuro. Cualquier otra cosa se descarta — mejor un lead sin seguimiento
 * que un runner persiguiendo fechas del pasado en bucle.
 */
function proximoSeguimientoValido(decision: Decision): string | undefined {
  const fecha = decision.seguimiento?.proximo_contacto?.trim()
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return undefined
  return fecha > fechaBogota() ? fecha : undefined
}

function canalNormalizado(canal?: string): string | undefined {
  if (!canal) return undefined
  const c = canal.toLowerCase()
  if (c.includes('whatsapp')) return 'whatsapp'
  if (c.includes('instagram')) return 'instagram'
  if (c.includes('facebook')) return 'facebook'
  if (c.includes('chat')) return 'widget' // TYPE_LIVE_CHAT / webchat
  return undefined
}

/**
 * Traspaso al equipo, UNA sola vez por contacto (idempotente contra los tags del
 * snapshot del turno; conversacion.ts pasa `e.tags`):
 *
 *  - **Escalada dura** (accion "escalar"): nota interna. El tag
 *    `transferencia a humano` lo pone conversacion.ts y dispara la notificación.
 *  - **Lead calificado** (handoff silencioso): pone `sol_calificado` —el tag que
 *    dispara el workflow del equipo— más la nota interna con el brief. Sol sigue
 *    en espera caliente y el cliente no percibe el traspaso.
 *
 * ⚠️ El workflow de GHL sobre `sol_calificado` debe notificar/reasignar SOLO al
 * equipo; si le manda un mensaje al cliente, conversacion.ts lo leería como
 * intervención humana y pondría `stop_bot`, apagando a Sol.
 */
async function marcarHandoff(e: EntradaCrm): Promise<string | null> {
  const { decision } = e
  const tags = e.tags ?? []

  if (decision.accion === 'escalar') {
    if (tags.includes(TAGS.transferenciaHumano)) return null // ya escalado antes
    await dejarNotaDeEscalada(e)
    return 'nota interna de escalada'
  }

  if (estaCalificado(decision.datos) && !tags.includes(TAGS.calificado)) {
    await agregarTags(e.contactId, [TAGS.calificado])
    await dejarNotaDeEscalada(e) // el mismo brief sirve para quien arme la cotización
    return `handoff silencioso: ${TAGS.calificado} + nota con brief`
  }

  return null
}

/**
 * El briefing que hoy no existe: quien reciba el lead entra a cerrar, no a
 * re-preguntar. Se deja como nota interna al escalar o al dejarlo listo.
 */
async function dejarNotaDeEscalada({ contactId, decision }: EntradaCrm): Promise<string | null> {
  const d = decision.datos

  const viajeros = [
    d.adultos ? `${d.adultos} adulto(s)` : null,
    d.ninos ? `${d.ninos} niño(s)${d.edades_ninos ? ` de ${d.edades_ninos}` : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const datos = [
    d.destino ? `Destino: ${d.destino}` : null,
    d.fechas ? `Fechas: ${d.fechas}` : null,
    viajeros ? `Viajeros: ${viajeros}` : null,
    d.ciudad_salida ? `Sale de: ${d.ciudad_salida}` : null,
    d.presupuesto ? `Presupuesto: ${d.presupuesto}` : null,
  ].filter(Boolean)

  const texto = [
    decision.accion === 'escalar'
      ? '🤖 Sol escaló esta conversación.'
      : '🤖 Sol dejó este lead listo para cotizar.',
    decision.resumen?.trim() || `Motivo: ${decision.motivo}`,
    datos.length ? `Datos capturados:\n- ${datos.join('\n- ')}` : null,
    decision.temperatura !== 'no_aplica' ? `Temperatura: ${decision.temperatura}` : null,
    // Mismo recordatorio que en el brief: el contenido viene del cliente.
    'ℹ️ Datos tomados del chat con el cliente, sin verificar.',
  ]
    .filter(Boolean)
    .join('\n\n')

  await crearNota(contactId, texto)
  return 'nota interna con el briefing'
}

/**
 * Mover a "Calificado por Bot" dispara el workflow "2.-Calificado por Bot" de la
 * cuenta: asigna asesora y crea la tarea "Cotizar lead calificado por Sol" con el
 * campo Mensaje de cotización en la descripción (por eso ese campo se escribe en
 * guardarCalificacion ANTES de este paso). El workflow no le escribe al cliente.
 */
async function moverSiCalificado({ contactId, decision }: EntradaCrm): Promise<string | null> {
  if (!estaCalificado(decision.datos)) return null

  const oportunidades = await oportunidadesDe(contactId)
  const abierta = oportunidades.find(o => o.pipelineId === PIPELINE.id && o.status === 'open')

  if (!abierta) {
    return 'calificado, pero sin oportunidad abierta en el pipeline principal (no se movió nada)'
  }
  if (abierta.pipelineStageId === PIPELINE.etapas.calificadoPorBot) return null
  if (abierta.pipelineStageId !== PIPELINE.etapas.leadNuevo) {
    return 'calificado, pero la oportunidad ya pasó de Lead Nuevo (territorio humano, no se toca)'
  }

  await moverOportunidad(abierta.id, PIPELINE.id, PIPELINE.etapas.calificadoPorBot)
  return 'oportunidad movida a "Calificado por Bot"'
}

/**
 * Cola operativa del seguimiento dinámico (§5): una fila por contacto en
 * `agente_seguimientos`, que el runner de /api/agente/seguimiento consume.
 * Los campos `sol_*` de GHL son el espejo visible; esta cola es la que manda.
 */
async function programarSeguimiento(e: EntradaCrm): Promise<string | null> {
  if (!e.conversationId) return null // sin conversación no hay a qué volver

  const d = e.decision
  const intentos = e.intentos ?? 0
  const fecha = proximoSeguimientoValido(d)

  let fila: { estado: string; programado_para: string | null; nota: string | null }
  if (d.accion === 'escalar') {
    fila = { estado: 'cerrado', programado_para: null, nota: 'escalado a una asesora' }
  } else if (estaCalificado(d.datos)) {
    // Handoff silencioso: el equipo arma la cotización. Sol no persigue por su
    // cuenta (el empujón al cliente sería la fase 2 del híbrido, aún no activa).
    fila = { estado: 'cerrado', programado_para: null, nota: 'calificado; el equipo arma la cotización' }
  } else if (d.temperatura === 'no_interesado') {
    fila = { estado: 'cerrado', programado_para: null, nota: d.motivo }
  } else if (intentos >= MAX_INTENTOS_SEGUIMIENTO) {
    fila = {
      estado: 'dormido',
      programado_para: null,
      nota: `sin respuesta tras ${MAX_INTENTOS_SEGUIMIENTO} seguimientos`,
    }
  } else if (fecha) {
    fila = { estado: 'pendiente', programado_para: fecha, nota: d.seguimiento?.angulo ?? null }
  } else {
    fila = { estado: 'cerrado', programado_para: null, nota: 'sin seguimiento programado' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('agente_seguimientos').upsert({
    contact_id: e.contactId,
    conversation_id: e.conversationId,
    canal: canalNormalizado(e.canal) ?? null,
    intentos,
    actualizado_en: new Date().toISOString(),
    ...fila,
  })
  if (error) throw new Error(error.message)

  return fila.estado === 'pendiente'
    ? `seguimiento programado para ${fila.programado_para}`
    : `seguimiento: ${fila.estado}`
}
