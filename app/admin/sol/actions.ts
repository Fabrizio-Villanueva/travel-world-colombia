'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminRole } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'

/**
 * Reglas comerciales de Sol (política de reserva, rangos, promociones).
 * SOLO rol admin (decidido 05-oct-2026): cada acción lo verifica.
 */

export type SolState = { error?: string; ok?: string }

const txt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

async function sesion(): Promise<{ email: string } | { error: string }> {
  try {
    const { user } = await requireAdminRole()
    return { email: user.email ?? '' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

function listo(msg: string): SolState {
  revalidatePath('/admin/sol')
  revalidatePath('/admin/catalogo')
  return { ok: msg }
}

export async function guardarPolitica(_prev: SolState, fd: FormData): Promise<SolState> {
  const s = await sesion()
  if ('error' in s) return s
  const anticipo = num(fd.get('anticipo_pct'))
  const saldo = num(fd.get('saldo_dias_antes'))
  const total = num(fd.get('pago_total_si_faltan_dias'))
  if (anticipo == null || Number.isNaN(anticipo) || anticipo <= 0 || anticipo > 100) return { error: 'El anticipo debe ser un porcentaje entre 1 y 100.' }
  if (saldo == null || Number.isNaN(saldo) || saldo < 0) return { error: 'Los días del saldo deben ser un número.' }
  if (total == null || Number.isNaN(total) || total < 0) return { error: 'Los días para pago total deben ser un número.' }

  const { error } = await createAdminClient()
    .from('sol_politica_reserva')
    .upsert({
      id: 1,
      anticipo_pct: anticipo,
      saldo_dias_antes: Math.trunc(saldo),
      pago_total_si_faltan_dias: Math.trunc(total),
      medios_pago: txt(fd.get('medios_pago')),
      notas: txt(fd.get('notas')),
      actualizado_en: new Date().toISOString(),
      actualizado_por: s.email,
    })
  if (error) return { error: error.message }
  await registrarActividad({ email: s.email, accion: 'actualizar', nombre: 'Sol: política de reserva', detalle: { anticipo_pct: anticipo } })
  return listo('Política guardada. Sol la usa desde el próximo mensaje.')
}

export async function guardarRango(_prev: SolState, fd: FormData): Promise<SolState> {
  const s = await sesion()
  if ('error' in s) return s
  const id = txt(fd.get('id'))
  const destino = txt(fd.get('destino'))
  const desde = num(fd.get('desde'))
  const hasta = num(fd.get('hasta'))
  const moneda = txt(fd.get('moneda')) ?? 'COP'
  const temporada = txt(fd.get('temporada')) ?? 'baja'
  if (!destino) return { error: 'Falta el destino.' }
  if (desde == null || hasta == null || Number.isNaN(desde) || Number.isNaN(hasta) || desde <= 0 || hasta < desde) {
    return { error: 'Revisa el rango: "desde" y "hasta" son números y "hasta" no puede ser menor.' }
  }
  if (!['COP', 'USD'].includes(moneda) || !['baja', 'alta', 'todo_el_ano'].includes(temporada)) return { error: 'Moneda o temporada inválida.' }

  const fila = {
    destino,
    slug: txt(fd.get('slug')),
    noches: txt(fd.get('noches')),
    temporada,
    desde,
    hasta,
    moneda,
    incluye: txt(fd.get('incluye')),
    notas: txt(fd.get('notas')),
    activo: fd.get('activo') === 'on',
    revisado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  }
  const admin = createAdminClient()
  const { error } = id ? await admin.from('sol_rangos').update(fila).eq('id', id) : await admin.from('sol_rangos').insert(fila)
  if (error) return { error: error.message }
  await registrarActividad({ email: s.email, accion: id ? 'actualizar' : 'crear', nombre: `Sol: rango ${destino}` })
  return listo(id ? 'Rango actualizado (y marcado como revisado hoy).' : 'Rango agregado.')
}

export async function eliminarRango(id: string): Promise<SolState> {
  const s = await sesion()
  if ('error' in s) return s
  const { error } = await createAdminClient().from('sol_rangos').delete().eq('id', id)
  if (error) return { error: error.message }
  await registrarActividad({ email: s.email, accion: 'eliminar', nombre: 'Sol: rango', detalle: { id } })
  return listo('Rango eliminado.')
}

export async function guardarPromocion(_prev: SolState, fd: FormData): Promise<SolState> {
  const s = await sesion()
  if ('error' in s) return s
  const id = txt(fd.get('id'))
  const titulo = txt(fd.get('titulo'))
  const detalle = txt(fd.get('detalle'))
  const valida = txt(fd.get('valida_hasta'))
  const cupos = num(fd.get('cupos'))
  if (!titulo || !detalle || !valida) return { error: 'Título, detalle y fecha límite son obligatorios.' }
  if (cupos != null && (Number.isNaN(cupos) || cupos < 0)) return { error: 'Cupos debe ser un número.' }

  const fila = {
    titulo,
    detalle,
    slug: txt(fd.get('slug')),
    valida_hasta: valida,
    cupos: cupos == null ? null : Math.trunc(cupos),
    activa: fd.get('activa') === 'on',
  }
  const admin = createAdminClient()
  const { error } = id ? await admin.from('sol_promociones').update(fila).eq('id', id) : await admin.from('sol_promociones').insert(fila)
  if (error) return { error: error.message }
  await registrarActividad({ email: s.email, accion: id ? 'actualizar' : 'crear', nombre: `Sol: promoción ${titulo}` })
  return listo(id ? 'Promoción actualizada.' : 'Promoción agregada.')
}

export async function eliminarPromocion(id: string): Promise<SolState> {
  const s = await sesion()
  if ('error' in s) return s
  const { error } = await createAdminClient().from('sol_promociones').delete().eq('id', id)
  if (error) return { error: error.message }
  await registrarActividad({ email: s.email, accion: 'eliminar', nombre: 'Sol: promoción', detalle: { id } })
  return listo('Promoción eliminada.')
}
