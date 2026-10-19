import { buscarOportunidades, listarUsuarios, type OportunidadBusquedaGhl } from '@/lib/agente/ghl'
import { CAMPOS_VENTA, PIPELINE, PIPELINE_RESERVACIONES } from '@/lib/agente/config'
import { CAMPO_FUENTE_LEAD } from '@/lib/agente/opp-reglas'

/**
 * Conversión real de leads a ventas (panel /admin/conversion).
 *
 * El widget de GHL mide por pipeline: la venta se MUDA de 🎯 Leads a 🗂️
 * Reservaciones y Leads se queda con ~0 % de ganadas. Aquí se junta todo:
 *   - Lead = tarjeta que nació en Leads (siga ahí o ya mudada a Reservaciones).
 *   - Venta = tarjeta viva en Reservaciones (no cancelada) o ganada en Leads.
 *   - Un lead se vendió si su propia tarjeta es venta, o si a su contacto le
 *     crearon una tarjeta NUEVA en Reservaciones después (la asesora no mudó
 *     la del lead): esa venta se le atribuye al lead más reciente del contacto.
 *
 * Mudada = tiene la marca "Origen de la venta" (la pone /api/agente/reservacion
 * desde el 19-oct) o, sin marca, nació más de 10 min antes de ganarse.
 */

/** Antes de esto los pipelines viejos se consolidaron (29/30-sep) y las fechas no sirven. */
export const CONVERSION_DESDE = '2026-10'
const MARGEN_MUDADA_MS = 10 * 60 * 1000
/** Tarjeta nueva para un lead que ya tenía su venta mudada, dentro de esta ventana = duplicado. */
const VENTANA_DUPLICADO_MS = 7 * 86400_000
const ETAPA_CANCELADA = '76d49ba3-c574-478c-8b02-21bab764b557' // ⛔ Cancelada
const ES_PRUEBA = /prueba|ejemplo|capacitaci/i

export type OrigenVenta = 'mudada' | 'tarjeta_nueva' | 'sin_lead' | 'duplicado'

export interface LeadConv {
  id: string
  nombre: string
  contactId: string | null
  creado: string
  mes: string
  asesora: string
  fuente: string
  venta: VentaConv | null
}

export interface VentaConv {
  id: string
  nombre: string
  contactId: string | null
  fecha: string
  mes: string
  valor: number
  origen: OrigenVenta
  asesora: string
}

export interface Conversion {
  leads: LeadConv[]
  ventas: VentaConv[]
  meses: string[]
}

/** Mes (YYYY-MM) en hora de Bogotá. */
function mesBogota(iso: string): string {
  return new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 7)
}

function campo(o: OportunidadBusquedaGhl, idCampo: string) {
  return (o.customFields ?? []).find(f => f.id === idCampo)
}

function fuenteDe(o: OportunidadBusquedaGhl): string {
  const f = campo(o, CAMPO_FUENTE_LEAD)?.fieldValueString?.trim()
  if (f) return f
  const s = o.source?.trim()
  return s && s.toLowerCase() !== 'lead' ? s : 'Sin fuente'
}

/** Fecha de la venta: la marca "Fecha de venta"; si no, cuando cambió a ganada; si no, cuando nació. */
function fechaVenta(o: OportunidadBusquedaGhl): string {
  const marca = campo(o, CAMPOS_VENTA.fecha)?.fieldValueDate
  if (marca != null && !Number.isNaN(Number(marca))) {
    // El DATE llega como medianoche UTC del día: se corre a mediodía para no caer en el día anterior en Bogotá.
    return new Date(Number(marca) + 12 * 3600_000).toISOString()
  }
  return (o.status === 'won' && o.lastStatusChangeAt) || o.createdAt || new Date().toISOString()
}

function esMudada(o: OportunidadBusquedaGhl): boolean {
  if (campo(o, CAMPOS_VENTA.origen)?.fieldValueString) return true
  if (!o.createdAt || !o.lastStatusChangeAt || o.status !== 'won') return false
  return Date.parse(o.lastStatusChangeAt) - Date.parse(o.createdAt) > MARGEN_MUDADA_MS
}

export async function cargarConversion(): Promise<Conversion> {
  const [enLeads, enReservas, usuarios] = await Promise.all([
    buscarOportunidades({ pipeline_id: PIPELINE.id, status: 'all' }, 40),
    buscarOportunidades({ pipeline_id: PIPELINE_RESERVACIONES.id, status: 'all' }, 20),
    listarUsuarios().catch(() => new Map<string, string>()),
  ])
  const asesora = (id?: string | null) => (id ? usuarios.get(id) ?? 'Usuario retirado' : 'Sin asignar')
  const reales = (l: OportunidadBusquedaGhl[]) => l.filter(o => !ES_PRUEBA.test(o.name ?? '') && o.createdAt)

  const leads: LeadConv[] = []
  const ventas: VentaConv[] = []
  const nuevaVenta = (o: OportunidadBusquedaGhl, origen: OrigenVenta): VentaConv => {
    const fecha = fechaVenta(o)
    return {
      id: o.id,
      nombre: o.name ?? 'Sin nombre',
      contactId: o.contactId ?? null,
      fecha,
      mes: mesBogota(fecha),
      valor: o.monetaryValue ?? 0,
      origen,
      asesora: asesora(o.assignedTo),
    }
  }
  const nuevoLead = (o: OportunidadBusquedaGhl, venta: VentaConv | null): LeadConv => ({
    id: o.id,
    nombre: o.name ?? 'Sin nombre',
    contactId: o.contactId ?? null,
    creado: o.createdAt!,
    mes: mesBogota(o.createdAt!),
    asesora: asesora(o.assignedTo),
    fuente: fuenteDe(o),
    venta,
  })

  for (const o of reales(enLeads)) {
    const venta = o.status === 'won' ? nuevaVenta(o, 'mudada') : null
    if (venta) ventas.push(venta)
    leads.push(nuevoLead(o, venta))
  }

  const directas: OportunidadBusquedaGhl[] = []
  for (const o of reales(enReservas)) {
    if (o.status === 'lost' || o.status === 'abandoned' || o.pipelineStageId === ETAPA_CANCELADA) continue
    if (esMudada(o)) {
      const venta = nuevaVenta(o, 'mudada')
      ventas.push(venta)
      leads.push(nuevoLead(o, venta))
    } else directas.push(o)
  }

  // Tarjetas nuevas en Reservaciones: se le atribuyen al lead más reciente del
  // contacto nacido antes de la venta.
  const leadsDe = new Map<string, LeadConv[]>()
  for (const l of leads) if (l.contactId) leadsDe.set(l.contactId, [...(leadsDe.get(l.contactId) ?? []), l])
  for (const o of directas.sort((a, b) => fechaVenta(a).localeCompare(fechaVenta(b)))) {
    const fecha = Date.parse(fechaVenta(o))
    const lead = (leadsDe.get(o.contactId ?? '') ?? [])
      .filter(l => Date.parse(l.creado) <= fecha)
      .sort((a, b) => b.creado.localeCompare(a.creado))[0]
    if (!lead) {
      ventas.push(nuevaVenta(o, 'sin_lead'))
      continue
    }
    if (lead.venta) {
      const cerca = Math.abs(Date.parse(lead.venta.fecha) - fecha) < VENTANA_DUPLICADO_MS
      ventas.push(nuevaVenta(o, cerca ? 'duplicado' : 'sin_lead'))
      continue
    }
    const venta = nuevaVenta(o, 'tarjeta_nueva')
    ventas.push(venta)
    lead.venta = venta
  }

  const meses = [...new Set([...leads.map(l => l.mes), ...ventas.map(v => v.mes)])]
    .filter(m => m >= CONVERSION_DESDE)
    .sort()
    .reverse()
  return {
    leads: leads.filter(l => l.mes >= CONVERSION_DESDE),
    ventas: ventas.filter(v => v.mes >= CONVERSION_DESDE),
    meses,
  }
}

export interface FilaGrupo {
  clave: string
  leads: number
  vendidos: number
  valor: number
}

/** Leads y vendidos agrupados (por asesora, fuente…), de más a menos leads. */
export function agrupar(leads: LeadConv[], clave: (l: LeadConv) => string): FilaGrupo[] {
  const m = new Map<string, FilaGrupo>()
  for (const l of leads) {
    const k = clave(l)
    const f = m.get(k) ?? { clave: k, leads: 0, vendidos: 0, valor: 0 }
    f.leads++
    if (l.venta) {
      f.vendidos++
      f.valor += l.venta.valor
    }
    m.set(k, f)
  }
  return [...m.values()].sort((a, b) => b.leads - a.leads || b.vendidos - a.vendidos)
}
