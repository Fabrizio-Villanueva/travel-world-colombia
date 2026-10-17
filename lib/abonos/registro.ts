import { createAdminClient } from '@/lib/supabase/admin'
import { GHL } from '@/lib/agente/config'
import {
  actualizarCamposOportunidad,
  conversacionDe,
  enviarMensaje,
  listarCamposTodosLosModelos,
  obtenerContacto,
  obtenerOportunidad,
  rutaDeRespuesta,
  ultimosMensajes,
  type OportunidadDetalleGhl,
} from '@/lib/agente/ghl'
import { registrarEnviado } from '@/lib/agente/conversacion'
import { divisaDe, enDivisa, type Divisa } from '@/lib/contratos/divisa'
import { estadoDeCuenta, ordenar, textoSaldo, type Abono, type EstadoCuenta } from './calculo'
import { urlEstadoCuenta } from './enlace'

/**
 * Libro de abonos (17-oct-2026). Fuente única de los pagos de una reserva:
 * cada abono guarda quién lo registró; nunca se borra (se anula con motivo).
 * Después de cada cambio se sincronizan los campos de GHL (Pago 1..10 y el
 * resumen "Estado de cuenta - …"), que leen el contrato, el tablero y los
 * workflows.
 */

/** Pagos que caben en la oportunidad de GHL (y en el contrato). */
export const MAX_PAGOS_GHL = 10
const CAMPOS_PAGO = ['Divisa', 'Medio de Pago', 'Fecha de Pago', 'TRM', 'Total Plan', 'Abono', 'Saldo en Pesos'] as const

const admin = () => createAdminClient()

type Valor = string | number | undefined

function valor(cf: Record<string, unknown>): Valor {
  const v = cf.fieldValue ?? cf.field_value ?? cf.fieldValueString ?? cf.fieldValueNumber ?? cf.fieldValueDate
  if (v == null || v === '') return undefined
  return typeof v === 'number' ? v : String(v)
}

const num = (v: Valor): number | null => {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

const fecha = (v: Valor): string | null => {
  if (v == null) return null
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10)
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  return m ? m[1] : null
}

/** Oportunidad con sus campos por nombre + los ids de campo por nombre. */
export interface ReservaGhl {
  opp: OportunidadDetalleGhl
  porNombre: Record<string, Valor>
  idDe: Map<string, string>
  contactId: string | null
}

export async function reservaGhl(opportunityId: string): Promise<ReservaGhl> {
  const [opp, campos] = await Promise.all([obtenerOportunidad(opportunityId), listarCamposTodosLosModelos()])
  if (!opp) throw new Error('La oportunidad no existe en GHL.')
  const idDe = new Map<string, string>()
  const nombreDe = new Map<string, string>()
  for (const c of campos) {
    if (c.model === 'opportunity' && c.name) {
      idDe.set(c.name.trim(), c.id)
      nombreDe.set(c.id, c.name.trim())
    }
  }
  const porNombre: Record<string, Valor> = {}
  for (const cf of opp.customFields ?? []) {
    const n = nombreDe.get(cf.id)
    if (n) porNombre[n] = valor(cf as Record<string, unknown>)
  }
  const extra = opp as { contactId?: string; contact?: { id?: string } }
  return { opp, porNombre, idDe, contactId: extra.contactId ?? extra.contact?.id ?? null }
}

/** Total del plan por divisa según la liquidación (base del saldo). */
export function totalesBase(r: ReservaGhl): Partial<Record<Divisa, number | null>> {
  return {
    COP: num(r.porNombre['Total Pasajeros - Valor Total']),
    USD: num(r.porNombre['TRM - Valor Total']),
  }
}

/* ------------------------------------------------------------------ */
/* Lectura (con importación de los pagos que ya estaban en GHL)        */
/* ------------------------------------------------------------------ */

async function filas(opportunityId: string): Promise<Abono[]> {
  const { data, error } = await admin()
    .from('abonos')
    .select('*')
    .eq('location_id', GHL.locationId)
    .eq('opportunity_id', opportunityId)
  if (error) throw new Error(error.message)
  return ordenar(
    (data ?? []).map(a => ({
      ...a,
      monto: Number(a.monto),
      total_plan: a.total_plan == null ? null : Number(a.total_plan),
      trm: a.trm == null ? null : Number(a.trm),
    })) as Abono[]
  )
}

/**
 * Pagos 1..10 que la reserva ya tenía en GHL antes del libro: se copian una
 * sola vez (origen "importado") para que el libro no los pierda ni los pise.
 */
async function importarDeGhl(opportunityId: string, r: ReservaGhl): Promise<number> {
  const nuevos = []
  for (let i = 1; i <= MAX_PAGOS_GHL; i++) {
    const p = (c: string) => r.porNombre[`Pago ${i} - ${c}`]
    const monto = num(p('Abono'))
    if (!monto || monto <= 0) continue
    const totalPlan = num(p('Total Plan'))
    nuevos.push({
      location_id: GHL.locationId,
      opportunity_id: opportunityId,
      contact_id: r.contactId,
      fecha: fecha(p('Fecha de Pago')) ?? new Date().toISOString().slice(0, 10),
      divisa: divisaDe(p('Divisa'), monto, totalPlan),
      monto,
      total_plan: totalPlan,
      trm: num(p('TRM')),
      medio: p('Medio de Pago') ? String(p('Medio de Pago')) : null,
      nota: `Pago ${i} registrado en GHL antes del libro de abonos`,
      registrado_por: 'importado de GHL',
      registrado_nombre: 'Registro anterior (GHL)',
      origen: 'importado',
    })
  }
  if (nuevos.length === 0) return 0
  const { error } = await admin().from('abonos').insert(nuevos)
  if (error) throw new Error(error.message)
  return nuevos.length
}

export interface LibroAbonos {
  abonos: Abono[]
  estado: EstadoCuenta
  base: Partial<Record<Divisa, number | null>>
  url: string
}

export async function libroDe(opportunityId: string, r?: ReservaGhl): Promise<LibroAbonos> {
  const reserva = r ?? (await reservaGhl(opportunityId))
  let abonos = await filas(opportunityId)
  if (abonos.length === 0 && (await importarDeGhl(opportunityId, reserva)) > 0) abonos = await filas(opportunityId)
  const base = totalesBase(reserva)
  return { abonos, estado: estadoDeCuenta(abonos, base), base, url: urlEstadoCuenta(opportunityId) }
}

/* ------------------------------------------------------------------ */
/* Escritura                                                           */
/* ------------------------------------------------------------------ */

/** Nombre de quien registra: el de la lista de usuarios del panel o el de GHL. */
export async function nombreDe(email: string): Promise<string | null> {
  const e = email.toLowerCase()
  const { data } = await admin().from('admin_allowlist').select('nombre').eq('email', e).maybeSingle()
  if (data?.nombre) return data.nombre as string
  try {
    const t = process.env.GHL_TWC_PIT
    const res = await fetch(`${GHL.api}/users/?locationId=${GHL.locationId}`, {
      headers: { Authorization: `Bearer ${t}`, Version: GHL.version, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const j = (await res.json()) as { users?: { email?: string; name?: string; firstName?: string; lastName?: string }[] }
    const u = j.users?.find(x => x.email?.toLowerCase() === e)
    return u ? u.name?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null : null
  } catch {
    return null
  }
}

export interface NuevoAbono {
  fecha: string
  divisa: Divisa
  monto: number
  totalPlan: number | null
  trm: number | null
  medio: string | null
  referencia: string | null
  nota: string | null
}

export async function registrarAbono(opportunityId: string, a: NuevoAbono, email: string): Promise<Abono> {
  const r = await reservaGhl(opportunityId)
  await libroDe(opportunityId, r) // importa los pagos de GHL antes del primero nuevo
  const { data, error } = await admin()
    .from('abonos')
    .insert({
      location_id: GHL.locationId,
      opportunity_id: opportunityId,
      contact_id: r.contactId,
      fecha: a.fecha,
      divisa: a.divisa,
      monto: a.monto,
      total_plan: a.totalPlan,
      trm: a.trm,
      medio: a.medio,
      referencia: a.referencia,
      nota: a.nota,
      registrado_por: email.toLowerCase(),
      registrado_nombre: await nombreDe(email),
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return { ...data, monto: Number(data.monto) } as Abono
}

export async function anularAbono(opportunityId: string, id: string, motivo: string, email: string): Promise<void> {
  const { error } = await admin()
    .from('abonos')
    .update({ anulado_en: new Date().toISOString(), anulado_por: email.toLowerCase(), anulado_motivo: motivo })
    .eq('id', id)
    .eq('opportunity_id', opportunityId)
    .is('anulado_en', null)
  if (error) throw new Error(error.message)
}

/* ------------------------------------------------------------------ */
/* GHL: Pago 1..10 + resumen                                           */
/* ------------------------------------------------------------------ */

const fechaLegible = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Escribe en la oportunidad los primeros 10 abonos vigentes (Pago 1..10, el
 * resto de ranuras vacías) y el resumen del estado de cuenta.
 */
export async function sincronizarGhl(opportunityId: string, r?: ReservaGhl): Promise<void> {
  const reserva = r ?? (await reservaGhl(opportunityId))
  const libro = await libroDe(opportunityId, reserva)
  const campos: { id: string; field_value: string | number }[] = []
  const poner = (nombre: string, v: string | number | null) => {
    const id = reserva.idDe.get(nombre)
    if (id) campos.push({ id, field_value: v ?? '' })
  }
  for (let i = 1; i <= MAX_PAGOS_GHL; i++) {
    const a = libro.estado.abonos[i - 1]
    if (!a) {
      for (const c of CAMPOS_PAGO) if (reserva.porNombre[`Pago ${i} - ${c}`] !== undefined) poner(`Pago ${i} - ${c}`, null)
      continue
    }
    poner(`Pago ${i} - Divisa`, a.divisa)
    poner(`Pago ${i} - Medio de Pago`, a.medio)
    poner(`Pago ${i} - Fecha de Pago`, a.fecha)
    poner(`Pago ${i} - TRM`, a.trm)
    poner(`Pago ${i} - Total Plan`, a.totalPlan)
    poner(`Pago ${i} - Abono`, a.monto)
    poner(`Pago ${i} - Saldo en Pesos`, a.saldoTras)
  }
  const ultimo = libro.estado.abonos.at(-1)
  poner('Estado de cuenta - Enlace', libro.estado.abonos.length ? libro.url : null)
  poner(
    'Estado de cuenta - Saldo pendiente',
    libro.estado.abonos.length ? (textoSaldo(libro.estado.cuentas, enDivisa) ?? 'Falta el total del plan') : null
  )
  poner(
    'Estado de cuenta - Último abono',
    ultimo ? `${enDivisa(ultimo.monto, ultimo.divisa)} el ${fechaLegible(ultimo.fecha)} · registró ${ultimo.registrado_nombre ?? ultimo.registrado_por}` : null
  )
  if (campos.length) await actualizarCamposOportunidad(opportunityId, campos)
}

/* ------------------------------------------------------------------ */
/* Confirmación al cliente por WhatsApp                                */
/* ------------------------------------------------------------------ */

export function textoConfirmacion(p: {
  nombre: string | null
  abono: Abono
  reserva: string | null
  destino: string | null
  saldo: string | null
  url: string
}): string {
  const viaje = [p.reserva ? `reserva TW-${p.reserva}` : null, p.destino].filter(Boolean).join(' · ')
  return (
    `✅ Travel World Colombia\n\n` +
    `Hola${p.nombre ? ` ${p.nombre}` : ''}, confirmamos tu abono de *${enDivisa(p.abono.monto, p.abono.divisa)}* ` +
    `recibido el ${fechaLegible(p.abono.fecha)}${viaje ? ` para tu ${viaje}` : ''}. ¡Gracias!\n\n` +
    (p.saldo === 'Pagado'
      ? `🎉 ¡Tu viaje está totalmente pagado!\n\n`
      : p.saldo
        ? `Saldo pendiente: *${p.saldo}*\n\n`
        : '') +
    `Consulta tu estado de cuenta actualizado (todos tus abonos) aquí:\n${p.url}`
  )
}

/** Envía la confirmación del abono por el mismo canal de la conversación. */
export async function enviarConfirmacion(opportunityId: string, abonoId: string): Promise<boolean> {
  const reserva = await reservaGhl(opportunityId)
  if (!reserva.contactId) throw new Error('La reserva no tiene contacto en GHL.')
  const libro = await libroDe(opportunityId, reserva)
  const abono = libro.abonos.find(a => a.id === abonoId)
  if (!abono || abono.anulado_en) throw new Error('El abono no existe o está anulado.')
  const [contacto, conv] = await Promise.all([obtenerContacto(reserva.contactId), conversacionDe(reserva.contactId)])
  const mensajes = conv ? await ultimosMensajes(conv.id, 40) : []
  const texto = textoConfirmacion({
    nombre: contacto?.firstName?.trim() || null,
    abono,
    reserva: reserva.porNombre['TWC'] ? String(reserva.porNombre['TWC']) : null,
    destino: reserva.porNombre['Destino de interés'] ? String(reserva.porNombre['Destino de interés']) : null,
    saldo: textoSaldo(libro.estado.cuentas, enDivisa),
    url: libro.url,
  })
  const r = await enviarMensaje(reserva.contactId, texto, rutaDeRespuesta(mensajes))
  // Envío del sistema: Sol no lo toma como mensaje de una asesora.
  if (r.messageId) await registrarEnviado(r.messageId, r.conversationId ?? conv?.id ?? '', reserva.contactId)
  await admin().from('abonos').update({ mensaje_enviado_en: new Date().toISOString() }).eq('id', abonoId)
  return true
}
