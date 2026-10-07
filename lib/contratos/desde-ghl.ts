import {
  listarCamposTodosLosModelos,
  nombreUsuario,
  obtenerContacto,
  obtenerOportunidad,
} from '@/lib/agente/ghl'
import { armarContrato, type Valor } from './armar'
import type { ContratoDatos } from './tipos'

/**
 * Lee la oportunidad y su contacto en GHL y arma el contrato. Los campos de
 * oportunidad se leen por NOMBRE (los del catálogo); la facturación estable
 * vive en el contacto (por fieldKey, igual que el Generador de Contratos).
 */

export const FACTURACION = {
  nombre: 'contact.cliente',
  documento: 'contact.numero_de_documento',
  direccion: 'contact.direccin',
  ciudad: 'contact.datos_de_facturacin__ciudad',
  correo: 'contact.datos_de_facturacin__correo_electrnico',
  telefono: 'contact.telefono',
} as const

/** Hoy en Colombia (AAAA-MM-DD). */
function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** El GET por id devuelve el valor en distintas llaves según el tipo. */
function valorCrudo(cf: Record<string, unknown>): Valor {
  const v = cf.fieldValue ?? cf.field_value ?? cf.fieldValueString ?? cf.fieldValueNumber ?? cf.fieldValueDate
  if (v == null) return undefined
  if (Array.isArray(v)) return v.map(String)
  return typeof v === 'number' ? v : String(v)
}

export async function contratoDesdeGhl(opportunityId: string): Promise<ContratoDatos> {
  const oportunidad = await obtenerOportunidad(opportunityId)
  if (!oportunidad) throw new Error('La oportunidad no existe en GHL.')
  const extra = oportunidad as { contactId?: string; contact?: { id?: string }; assignedTo?: string }
  const contactId = extra.contactId ?? extra.contact?.id

  const [campos, contacto, agente] = await Promise.all([
    listarCamposTodosLosModelos(),
    contactId ? obtenerContacto(contactId) : Promise.resolve(null),
    extra.assignedTo ? nombreUsuario(extra.assignedTo).catch(() => null) : Promise.resolve(null),
  ])

  const nombrePorId = new Map<string, string>()
  const idPorKey = new Map<string, string>()
  for (const c of campos) {
    if (c.model === 'opportunity' && c.name) nombrePorId.set(c.id, c.name.trim())
    if (c.model !== 'opportunity' && c.fieldKey) idPorKey.set(c.fieldKey, c.id)
  }

  const opp: Record<string, Valor> = {}
  for (const cf of oportunidad.customFields ?? []) {
    const nombre = nombrePorId.get(cf.id)
    if (nombre) opp[nombre] = valorCrudo(cf as Record<string, unknown>)
  }

  const delContacto = new Map((contacto?.customFields ?? []).map(f => [f.id, f.value]))
  const fact = (key: string) => {
    const id = idPorKey.get(key)
    const v = id ? delContacto.get(id) : undefined
    return v == null || v === '' ? undefined : String(v).trim()
  }

  return armarContrato({
    opp,
    facturacion: {
      nombre: fact(FACTURACION.nombre),
      documento: fact(FACTURACION.documento),
      direccion: fact(FACTURACION.direccion),
      ciudad: fact(FACTURACION.ciudad),
      correo: fact(FACTURACION.correo) ?? contacto?.email,
      telefono: fact(FACTURACION.telefono) ?? contacto?.phone,
    },
    contacto: {
      nombre: [contacto?.firstName, contacto?.lastName].filter(Boolean).join(' ') || undefined,
      telefono: contacto?.phone,
    },
    agente: agente ?? undefined,
    hoy: hoyBogota(),
  })
}
