'use server'

import { requireReservas } from '@/lib/admin/guard'
import { registrarActividad } from '@/lib/admin/audit'
import { automatizarReserva } from '@/lib/admin/reservas-automatizacion'
import { DIVISAS, enDivisa, type Divisa } from '@/lib/contratos/divisa'
import type { Abono, EstadoCuenta } from '@/lib/abonos/calculo'
import {
  anularAbono,
  enviarConfirmacion,
  libroDe,
  registrarAbono,
  reservaGhl,
  sincronizarGhl,
} from '@/lib/abonos/registro'

/**
 * Libro de abonos del Generador (17-oct-2026). Lo usan admins, editores y
 * representantes: cualquiera que reciba un abono lo registra, y queda a su
 * nombre. Anular: quien lo registró o un admin. Los errores vuelven como dato
 * (Next enmascara los `throw` en producción).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string }

export interface PanelAbonos {
  abonos: Abono[]
  estado: EstadoCuenta
  base: Partial<Record<Divisa, number | null>>
  url: string
  yo: string
  esAdmin: boolean
}

async function panel(opportunityId: string, email: string, esAdmin: boolean): Promise<PanelAbonos> {
  const l = await libroDe(opportunityId)
  return { ...l, yo: email.toLowerCase(), esAdmin }
}

export async function cargarAbonos(opportunityId: string): Promise<Resultado<PanelAbonos>> {
  try {
    const { user, rol } = await requireReservas()
    return { ok: true, datos: await panel(opportunityId, user.email ?? '', rol === 'admin') }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export interface DatosAbono {
  fecha: string
  divisa: string
  monto: string
  totalPlan: string
  trm: string
  medio: string
  referencia: string
  nota: string
  enviarMensaje: boolean
}

const numero = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = Number(t.replace(/\s/g, ''))
  return Number.isFinite(n) ? n : NaN
}

export async function registrarAbonoAction(
  opportunityId: string,
  d: DatosAbono
): Promise<Resultado<{ panel: PanelAbonos; mensaje: 'enviado' | 'no-enviado' | 'error'; aviso?: string }>> {
  try {
    const { user, rol } = await requireReservas()
    const email = user.email ?? ''
    const monto = numero(d.monto)
    const totalPlan = numero(d.totalPlan)
    const trm = numero(d.trm)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) return { ok: false, error: 'Elige la fecha del abono.' }
    if (d.fecha > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) {
      return { ok: false, error: 'La fecha del abono no puede ser futura.' }
    }
    if (!(DIVISAS as readonly string[]).includes(d.divisa)) return { ok: false, error: 'Divisa no válida.' }
    if (monto == null || Number.isNaN(monto) || monto <= 0) return { ok: false, error: 'Escribe el monto del abono (solo números).' }
    if (Number.isNaN(totalPlan) || Number.isNaN(trm)) return { ok: false, error: 'El total del plan y la TRM van solo en números.' }

    const abono = await registrarAbono(
      opportunityId,
      {
        fecha: d.fecha,
        divisa: d.divisa as Divisa,
        monto,
        totalPlan,
        trm,
        medio: d.medio.trim() || null,
        referencia: d.referencia.trim() || null,
        nota: d.nota.trim() || null,
      },
      email
    )
    const r = await reservaGhl(opportunityId)
    await sincronizarGhl(opportunityId, r)
    await automatizarReserva(opportunityId)

    let mensaje: 'enviado' | 'no-enviado' | 'error' = 'no-enviado'
    let aviso: string | undefined
    if (d.enviarMensaje) {
      try {
        await enviarConfirmacion(opportunityId, abono.id)
        mensaje = 'enviado'
      } catch (e) {
        mensaje = 'error'
        aviso = (e as Error).message
      }
    }
    await registrarActividad({
      email,
      accion: 'registrar-abono',
      slug: opportunityId,
      nombre: `${enDivisa(abono.monto, abono.divisa)} · ${abono.fecha}`,
      detalle: { abono: abono.id, medio: abono.medio, mensaje },
    })
    return { ok: true, datos: { panel: await panel(opportunityId, email, rol === 'admin'), mensaje, aviso } }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function anularAbonoAction(opportunityId: string, abonoId: string, motivo: string): Promise<Resultado<PanelAbonos>> {
  try {
    const { user, rol } = await requireReservas()
    const email = (user.email ?? '').toLowerCase()
    if (motivo.trim().length < 4) return { ok: false, error: 'Escribe el motivo de la anulación.' }
    const libro = await libroDe(opportunityId)
    const abono = libro.abonos.find(a => a.id === abonoId)
    if (!abono) return { ok: false, error: 'Ese abono no existe.' }
    if (rol !== 'admin' && abono.registrado_por !== email) {
      return { ok: false, error: 'Solo quien registró el abono o un administrador puede anularlo.' }
    }
    await anularAbono(opportunityId, abonoId, motivo.trim(), email)
    await sincronizarGhl(opportunityId)
    await automatizarReserva(opportunityId)
    await registrarActividad({
      email,
      accion: 'anular-abono',
      slug: opportunityId,
      nombre: `${enDivisa(abono.monto, abono.divisa)} · ${abono.fecha}`,
      detalle: { abono: abonoId, motivo: motivo.trim() },
    })
    return { ok: true, datos: await panel(opportunityId, email, rol === 'admin') }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function reenviarConfirmacionAction(opportunityId: string, abonoId: string): Promise<Resultado<PanelAbonos>> {
  try {
    const { user, rol } = await requireReservas()
    await enviarConfirmacion(opportunityId, abonoId)
    await registrarActividad({ email: user.email ?? '', accion: 'reenviar-confirmacion-abono', slug: opportunityId, nombre: abonoId })
    return { ok: true, datos: await panel(opportunityId, user.email ?? '', rol === 'admin') }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
