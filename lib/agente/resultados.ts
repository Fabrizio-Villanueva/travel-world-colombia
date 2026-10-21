import { createAdminClient } from '@/lib/supabase/admin'
import { todasLasFilas } from '@/lib/supabase/paginar'
import { buscarOportunidades, type OportunidadBusquedaGhl } from '@/lib/agente/ghl'
import { PIPELINE, PIPELINE_RESERVACIONES } from '@/lib/agente/config'
import { listoParaAsesora } from '@/lib/agente/crm'
import { COHORTE_DESDE } from '@/lib/agente/evaluador'
import type { Decision } from '@/lib/agente/claude'

/**
 * Embudo "Resultados de Sol" (panel /admin/sol/resultados): por cada lead que
 * atendió Sol, qué pasó después — si lo pasó al equipo, si el lead valía la
 * pena (evaluador, migración 042), si una asesora respondió y en cuánto, y si
 * terminó en cotización o venta (GHL).
 *
 * Fuentes: sol_ab_turnos (quién atendió y qué decidió), sol_ab_asignaciones
 * (versión), agente_sla_humano (traspaso y respuesta humana, desde 09-oct),
 * agente_evaluaciones y las oportunidades de GHL (5-6 búsquedas por carga).
 */

const ETAPA_COTIZADA = 'f34e7cd3-673f-4405-b608-4a031eac04e8' // 📋 Cotización Enviada
const ETAPA_SEGUIMIENTO = '202714ba-4a61-457d-b648-f5f7c99dc0ae' // 🔄 En Seguimiento
const ETAPA_CANCELADA = '76d49ba3-c574-478c-8b02-21bab764b557' // ⛔ Cancelada
/** Una venta cuenta si su tarjeta nació, como mucho, 2 días antes del primer turno de Sol. */
const MARGEN_VENTA_MS = 2 * 86400_000

export type Merece = 'si' | 'dudoso' | 'no' | 'no_aplica'
export type EstadoRespuesta = 'a_tiempo' | 'tarde' | 'sin_respuesta' | 'esperando' | 'sin_dato'

export interface FilaLead {
  contactId: string
  conversationId: string | null
  nombre: string
  version: 'v1' | 'v2'
  primerTurno: string
  pasado: boolean
  escalado: boolean
  evaluacion: {
    tipo: 'venta_nueva' | 'cliente_existente' | 'no_cliente'
    merece: Merece
    motivo: string
    notaSol: number | null
    errorSol: string | null
  } | null
  respuesta: { estado: EstadoRespuesta; minutos: number | null }
  cotizado: boolean
  venta: { valor: number } | null
}

export interface Resultados {
  filas: FilaLead[]
  avisoGhl: string | null
}

interface Turno { contact_id: string; conversation_id: string | null; decision: Decision; en: string }
interface Sla { contact_id: string; motivo: string; inicio: string; respondido_en: string | null; cierre: string | null }

/** `dias` = ventana hacia atrás desde hoy; null = desde el inicio de la bitácora. */
export async function cargarResultados(dias: number | null): Promise<Resultados> {
  const ventana = dias ? new Date(Date.now() - dias * 86400_000) : null
  const desde = ventana && ventana > new Date(COHORTE_DESDE) ? ventana.toISOString() : COHORTE_DESDE
  const db = createAdminClient()
  const [tur, asig, sla, ev] = await Promise.all([
    todasLasFilas((a, b) => db.from('sol_ab_turnos').select('contact_id, conversation_id, decision, en').gte('en', desde).order('en', { ascending: true }).order('id').range(a, b)),
    todasLasFilas((a, b) => db.from('sol_ab_asignaciones').select('contact_id, grupo').order('contact_id').range(a, b)),
    todasLasFilas((a, b) => db.from('agente_sla_humano').select('contact_id, motivo, inicio, respondido_en, cierre').gte('inicio', desde).order('inicio', { ascending: true }).order('id').range(a, b)),
    todasLasFilas((a, b) => db.from('agente_evaluaciones').select('contact_id, nombre, tipo, merecia_pasar, motivo, nota_sol, error_sol').order('contact_id').range(a, b)),
  ])
  if (tur.error) throw new Error(`sol_ab_turnos: ${tur.error.message}`)

  const version = new Map((asig.data ?? []).map(a => [a.contact_id as string, a.grupo as 'v1' | 'v2']))
  const evaluacion = new Map((ev.data ?? []).map(e => [e.contact_id as string, e]))
  // Primer traspaso de cada contacto en el período.
  const traspaso = new Map<string, Sla>()
  for (const s of (sla.data ?? []) as Sla[]) if (!traspaso.has(s.contact_id)) traspaso.set(s.contact_id, s)

  const porContacto = new Map<string, Turno[]>()
  for (const t of (tur.data ?? []) as Turno[]) {
    const l = porContacto.get(t.contact_id) ?? []
    l.push(t)
    porContacto.set(t.contact_id, l)
  }

  // GHL: ventas (Reservaciones) y cotizaciones (Leads). Si falla, el panel
  // muestra el resto y avisa.
  let avisoGhl: string | null = null
  let reservas: OportunidadBusquedaGhl[] = []
  let cotizadas: OportunidadBusquedaGhl[] = []
  try {
    const [r, c, s] = await Promise.all([
      buscarOportunidades({ pipeline_id: PIPELINE_RESERVACIONES.id, status: 'all' }),
      buscarOportunidades({ pipeline_id: PIPELINE.id, pipeline_stage_id: ETAPA_COTIZADA, status: 'all' }),
      buscarOportunidades({ pipeline_id: PIPELINE.id, pipeline_stage_id: ETAPA_SEGUIMIENTO, status: 'all' }),
    ])
    reservas = r.filter(o => o.pipelineStageId !== ETAPA_CANCELADA && o.status !== 'lost' && o.status !== 'abandoned')
    cotizadas = [...c, ...s]
  } catch (err) {
    avisoGhl = `No se pudieron leer las oportunidades de GHL (${(err as Error).message}): faltan cotizaciones y ventas.`
  }
  const reservasDe = new Map<string, OportunidadBusquedaGhl[]>()
  for (const o of reservas) {
    if (!o.contactId) continue
    reservasDe.set(o.contactId, [...(reservasDe.get(o.contactId) ?? []), o])
  }
  const cotizado = new Set(cotizadas.map(o => o.contactId).filter(Boolean) as string[])

  const filas: FilaLead[] = []
  for (const [contactId, turnos] of porContacto) {
    const primerTurno = turnos[0].en
    const decisiones = turnos.map(t => t.decision).filter(Boolean)
    const s = traspaso.get(contactId)
    const e = evaluacion.get(contactId)

    const pasado = s?.motivo === 'calificado' || decisiones.some(d => d.accion !== 'escalar' && listoParaAsesora(d))
    const escalado = Boolean(s?.motivo.startsWith('escalado')) || decisiones.some(d => d.accion === 'escalar')

    let respuesta: FilaLead['respuesta'] = { estado: 'sin_dato', minutos: null }
    if (s) {
      if (s.respondido_en) {
        const min = Math.round((new Date(s.respondido_en).getTime() - new Date(s.inicio).getTime()) / 60000)
        respuesta = { estado: min <= 60 ? 'a_tiempo' : 'tarde', minutos: min }
      } else if (s.cierre === 'vencido') respuesta = { estado: 'sin_respuesta', minutos: null }
      else if (!s.cierre) respuesta = { estado: 'esperando', minutos: null }
    }

    const minVenta = new Date(primerTurno).getTime() - MARGEN_VENTA_MS
    const ventas = (reservasDe.get(contactId) ?? []).filter(o => !o.createdAt || new Date(o.createdAt).getTime() >= minVenta)
    const venta = ventas.length ? { valor: ventas.reduce((t, o) => t + (o.monetaryValue ?? 0), 0) } : null

    const nombreSol = [...decisiones].reverse().find(d => d.datos?.nombre)?.datos?.nombre
    filas.push({
      contactId,
      conversationId: [...turnos].reverse().find(t => t.conversation_id)?.conversation_id ?? null,
      nombre: (e?.nombre as string | null) || nombreSol || 'Sin nombre',
      version: version.get(contactId) ?? 'v1',
      primerTurno,
      pasado,
      escalado,
      evaluacion: e
        ? {
            tipo: e.tipo,
            merece: e.merecia_pasar,
            motivo: e.motivo,
            notaSol: e.nota_sol ?? null,
            errorSol: e.error_sol ?? null,
          }
        : null,
      respuesta,
      cotizado: Boolean(venta) || cotizado.has(contactId),
      venta,
    })
  }
  filas.sort((a, b) => b.primerTurno.localeCompare(a.primerTurno))
  return { filas, avisoGhl }
}

/** Totales del embudo sobre un conjunto de filas. */
export function resumir(filas: FilaLead[]) {
  const clientes = filas.filter(f => f.evaluacion?.tipo !== 'no_cliente')
  const ventaNueva = clientes.filter(f => f.evaluacion?.tipo !== 'cliente_existente')
  const pasados = ventaNueva.filter(f => f.pasado)
  const cuenta = (l: FilaLead[], m: Merece) => l.filter(f => f.evaluacion?.merece === m).length
  const respondidos = pasados.filter(f => f.respuesta.minutos != null)
  const minutos = respondidos.map(f => f.respuesta.minutos!).sort((a, b) => a - b)
  const notas = filas.map(f => f.evaluacion?.notaSol).filter((n): n is number => n != null)
  // Solo leads de venta nueva: la reserva de un cliente que ya existía no la trajo Sol.
  const ventas = ventaNueva.filter(f => f.venta)
  return {
    atendidos: filas.length,
    noClientes: filas.length - clientes.length,
    existentes: clientes.length - ventaNueva.length,
    ventaNueva: ventaNueva.length,
    pasados: pasados.length,
    pasadosBuenos: cuenta(pasados, 'si'),
    pasadosDudosos: cuenta(pasados, 'dudoso'),
    pasadosMalos: cuenta(pasados, 'no'),
    pasadosSinEvaluar: pasados.filter(f => !f.evaluacion).length,
    buenosRetenidos: ventaNueva.filter(f => !f.pasado && !f.escalado && f.evaluacion?.merece === 'si').length,
    aTiempo: pasados.filter(f => f.respuesta.estado === 'a_tiempo').length,
    tarde: pasados.filter(f => f.respuesta.estado === 'tarde').length,
    sinRespuesta: pasados.filter(f => f.respuesta.estado === 'sin_respuesta').length,
    esperando: pasados.filter(f => f.respuesta.estado === 'esperando').length,
    sinDatoRespuesta: pasados.filter(f => f.respuesta.estado === 'sin_dato').length,
    medianaMin: minutos.length ? minutos[Math.floor(minutos.length / 2)] : null,
    cotizados: filas.filter(f => f.cotizado).length,
    ventas: ventas.length,
    valorVentas: ventas.reduce((t, f) => t + (f.venta?.valor ?? 0), 0),
    notaSol: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
    evaluados: filas.filter(f => f.evaluacion).length,
  }
}
