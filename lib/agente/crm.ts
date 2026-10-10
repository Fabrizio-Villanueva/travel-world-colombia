import {
  actualizarCampos,
  actualizarCamposOportunidad,
  actualizarContacto,
  agregarTags,
  asignarOportunidad,
  crearNota,
  moverOportunidad,
  obtenerContacto,
  oportunidadesDe,
  renombrarOportunidad,
} from '@/lib/agente/ghl'
import { buscarMiembro, equipo } from '@/lib/agente/equipo'
import { nombreSeguro, textoAcotado } from '@/lib/agente/nombre'
import { esFestivo } from '@/lib/agente/festivos'
import { registrarTraspaso } from '@/lib/agente/sla-registro'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CAMPO_IA_NOMBRE,
  CAMPO_SOL_IDIOMA,
  CAMPOS_SOL_OPP,
  CAMPOS_CALIFICACION_OPP,
  DIAS_SEGUIMIENTO_V2,
  HORARIO,
  MAX_INTENTOS_SEGUIMIENTO,
  PIPELINE,
  PIPELINES_POSTVENTA,
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
  /** Qué disparó el turno. En un seguimiento no se toca la hora preferida del cliente. */
  origen?: 'mensaje' | 'seguimiento'
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

/**
 * ¿Se le pasa el lead a la asesora (tag sol_calificado, brief, etapa
 * "Calificado por Bot", fin del seguimiento de Sol)?
 *  - Sol v1: con los datos mínimos (destino + fechas + viajeros).
 *  - Sol v2: SOLO cuando el cliente quedó "listo para reservar" (señal de
 *    compra o sí al compromiso). Con datos completos pero sin intención, Sol
 *    sigue trabajándolo: es justo lo que pidió la dueña.
 */
function listoParaAsesora(decision: Decision): boolean {
  if (decision.venta) return decision.venta.estado === 'listo_para_reservar'
  return estaCalificado(decision.datos)
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
  // Todo lo que escribe aquí lo dijo el cliente en el chat: acotado (200
  // caracteres, sin saltos) antes de ir a un campo que el equipo lee como dato.
  const texto = (clave: keyof typeof CAMPOS_CALIFICACION_OPP, nombre: string, valor?: string) => {
    const limpio = textoAcotado(valor)
    if (limpio) {
      calif(clave, limpio)
      escritos.push(nombre)
    }
  }

  // Nombre real → ia__nombre (un workflow lo copia al "Nombre" principal). Solo
  // si cambió, para no re-disparar ese workflow con el mismo valor cada turno.
  // Saneado: ia__nombre vuelve al bloque `system` de todos los turnos siguientes,
  // así que no puede llevar nada que no sea un nombre (anti prompt-injection).
  const nombre = nombreSeguro(d.nombre)
  if (nombre && nombre !== nombreSeguro(e.nombreConfirmado)) {
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
  const listo = decision.accion === 'escalar' || listoParaAsesora(decision)
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
  if (listoParaAsesora(decision)) return 'calificado'
  return 'conversando'
}

/** Fecha local de Colombia en YYYY-MM-DD (formato que aceptan los campos DATE). */
export function fechaBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(new Date())
}

/** Hora local de Colombia (0-23). */
export function horaBogota(ahora = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: HORARIO.zona, hour: 'numeric', hour12: false }).format(ahora)
  return Number(h) % 24 // algunos motores dan "24" a medianoche
}

/** Fecha de Bogotá + n días en YYYY-MM-DD; si cae domingo o festivo, corre al siguiente día hábil. */
export function fechaHabilEnDias(dias: number): string {
  const base = new Date(`${fechaBogota()}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  while (base.getUTCDay() === 0 || esFestivo(base.toISOString().slice(0, 10))) {
    base.setUTCDate(base.getUTCDate() + 1)
  }
  return base.toISOString().slice(0, 10)
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

  if (listoParaAsesora(decision) && !tags.includes(TAGS.calificado)) {
    await agregarTags(e.contactId, [TAGS.calificado])
    await dejarNotaDeEscalada(e) // el mismo brief sirve para quien arme la cotización
    // Desde aquí corre el SLA de respuesta humana (lib/agente/sla-humano.ts).
    const sla = await registrarTraspaso(e.contactId, e.conversationId, 'calificado')
    return [`handoff silencioso: ${TAGS.calificado} + nota con brief`, sla].filter(Boolean).join(' · ')
  }

  return null
}

/**
 * El cliente pidió a una persona concreta del equipo ("necesito al asesor Juan
 * Camilo"): el contacto —y su tarjeta abierta de Leads— pasan a esa persona,
 * para que la notificación y la tarea de la escalada le lleguen a ella y no a
 * quien quedó de dueña por reparto. Va ANTES del tag `transferencia a humano`
 * (conversacion.ts), que es el que dispara el workflow de la escalada.
 *
 * No se toca nada si la tarjeta ya está en territorio humano (Contactado o más
 * allá: alguien la está trabajando), si el nombre no resuelve a una sola
 * persona o si esa persona no recibe clientes; en esos casos la nota de
 * escalada igual dice por quién preguntó.
 *
 * Guardas (auditoría 2026-10-08): el nombre lo pone el cliente, así que esto
 * solo puede mover un lead NUEVO y una sola vez. Nunca reasigna si el chat ya
 * se escaló antes (cada turno con otro nombre volvía a reasignar), si el
 * contacto tiene una reserva en curso (post-venta: su asesora es la dueña) o
 * si no hay tarjeta abierta en Leads (antes se cambiaba el dueño del contacto
 * sin ninguna comprobación).
 */
export async function asignarAsesorPedido(
  contactId: string,
  decision: Decision,
  tags: readonly string[] = []
): Promise<string | null> {
  const pedido = textoAcotado(decision.asesor_pedido, 80)
  if (decision.accion !== 'escalar' || !pedido) return null

  const miembro = buscarMiembro(await equipo(), pedido)
  if (!miembro) return `pide a "${pedido}": no corresponde a una sola persona del equipo (no se reasigna)`
  if (!miembro.asignable) return `pide a ${miembro.nombre}: no recibe clientes (no se reasigna)`
  if (tags.includes(TAGS.transferenciaHumano)) {
    return `pide a ${miembro.nombre}, pero el chat ya se había escalado antes (no se reasigna otra vez)`
  }

  const oportunidades = await oportunidadesDe(contactId)
  const enPostventa = oportunidades.some(
    o => o.status === 'open' && (PIPELINES_POSTVENTA as readonly string[]).includes(o.pipelineId ?? '')
  )
  if (enPostventa) {
    return `pide a ${miembro.nombre}, pero tiene una reserva en curso con su asesora (no se reasigna)`
  }
  const abierta = oportunidades.find(o => o.pipelineId === PIPELINE.id && o.status === 'open')
  if (!abierta) return `pide a ${miembro.nombre}, pero no tiene tarjeta abierta en Leads (no se reasigna)`
  if ((PIPELINE.etapasVedadas as readonly string[]).includes(abierta.pipelineStageId ?? '')) {
    return `pide a ${miembro.nombre}, pero la tarjeta ya la trabaja una persona (no se reasigna)`
  }

  const contacto = await obtenerContacto(contactId)
  if (contacto?.assignedTo !== miembro.id) await actualizarContacto(contactId, { assignedTo: miembro.id })
  await asignarOportunidad(abierta.id, miembro.id)
  return `asignado a ${miembro.nombre} (el cliente lo pidió) · contacto y tarjeta`
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
    textoAcotado(decision.asesor_pedido, 80) ? `👤 Pregunta por: ${textoAcotado(decision.asesor_pedido, 80)}` : null,
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
  if (!listoParaAsesora(decision)) return null

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
  } else if (listoParaAsesora(d)) {
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
  } else if (d.venta) {
    // Sol v2: agenda el código. Lead vivo (no escaló, no pasó a L-01, no dijo
    // que no) = siempre tiene su siguiente intento; la IA solo aporta el ángulo.
    if (e.origen === 'seguimiento' && d.accion === 'callar') {
      // Releyendo, Sol vio que no vale insistir: se cierra (y no se gasta otra llamada mañana).
      fila = { estado: 'cerrado', programado_para: null, nota: `Sol decidió no insistir: ${d.motivo}` }
    } else if (d.temperatura === 'no_aplica') {
      fila = { estado: 'cerrado', programado_para: null, nota: 'no es un cliente' }
    } else {
      fila = {
        estado: 'pendiente',
        programado_para: fechaHabilEnDias(DIAS_SEGUIMIENTO_V2[intentos]),
        nota: d.seguimiento?.angulo?.trim() || null,
      }
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
    fallos: 0,
    actualizado_en: new Date().toISOString(),
    // La hora a la que escribe el cliente = la de su mensaje. En un turno de
    // seguimiento se omite y el upsert conserva la que ya había.
    ...(e.origen === 'seguimiento' ? {} : { hora: horaBogota() }),
    ...fila,
  })
  if (error) throw new Error(error.message)

  return fila.estado === 'pendiente'
    ? `seguimiento programado para ${fila.programado_para}`
    : `seguimiento: ${fila.estado}`
}
