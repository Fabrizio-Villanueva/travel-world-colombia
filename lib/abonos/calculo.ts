import { DIVISAS, type Divisa } from '@/lib/contratos/divisa'

/**
 * Estado de cuenta a partir del libro de abonos (17-oct-2026). Puro: lo usan
 * el servidor (página del cliente, GHL, mensaje) y el Generador (vista en vivo).
 *
 * Cada divisa lleva su propia cuenta, como el plan de pagos desde el 10-oct:
 * total del plan en esa divisa (el último que se haya anotado en un abono, o
 * el de la liquidación) menos lo abonado en esa divisa.
 */

export interface Abono {
  id: string
  fecha: string // AAAA-MM-DD
  divisa: Divisa
  monto: number
  total_plan: number | null
  trm: number | null
  medio: string | null
  referencia: string | null
  nota: string | null
  registrado_por: string
  registrado_nombre: string | null
  creado_en: string
  origen: 'panel' | 'importado'
  mensaje_enviado_en: string | null
  anulado_en: string | null
  anulado_por: string | null
  anulado_motivo: string | null
}

export interface CuentaDivisa {
  divisa: Divisa
  total: number | null
  abonado: number
  saldo: number | null
}

/** Abono vigente con el saldo de su divisa justo después de él. */
export interface AbonoConSaldo extends Abono {
  totalPlan: number | null
  saldoTras: number | null
}

export interface EstadoCuenta {
  abonos: AbonoConSaldo[]
  cuentas: CuentaDivisa[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Orden del libro: por fecha del abono y, a igual fecha, por cuándo se registró. */
export function ordenar<T extends { fecha: string; creado_en: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado_en.localeCompare(b.creado_en))
}

/**
 * `totalesBase`: total del plan por divisa según la liquidación de la reserva
 * (COP = "Total Pasajeros - Valor Total", USD = "TRM - Valor Total"). Un
 * `total_plan` anotado en un abono manda sobre la base desde ese abono.
 */
export function estadoDeCuenta(lista: Abono[], totalesBase: Partial<Record<Divisa, number | null>> = {}): EstadoCuenta {
  const vigentes = ordenar(lista.filter(a => !a.anulado_en))
  const total: Partial<Record<Divisa, number | null>> = { ...totalesBase }
  const abonado: Partial<Record<Divisa, number>> = {}
  const abonos: AbonoConSaldo[] = vigentes.map(a => {
    if (a.total_plan != null) total[a.divisa] = a.total_plan
    abonado[a.divisa] = redondear((abonado[a.divisa] ?? 0) + a.monto)
    const t = total[a.divisa] ?? null
    return { ...a, totalPlan: t, saldoTras: t != null ? redondear(t - abonado[a.divisa]!) : null }
  })
  // Con abonos, solo las divisas en las que se ha abonado (como el plan de
  // pagos: un viaje que se paga en dólares no "debe" además el total en
  // pesos de la liquidación). Sin abonos, lo que se debe de entrada en pesos.
  const conAbonos = vigentes.length > 0
  const cuentas = DIVISAS.flatMap(d => {
    const t = total[d] ?? null
    const ab = abonado[d] ?? 0
    if (conAbonos ? ab === 0 : !(d === 'COP' && t != null && t > 0)) return []
    return [{ divisa: d, total: t, abonado: ab, saldo: t != null ? redondear(t - ab) : null }]
  })
  return { abonos, cuentas }
}

/**
 * Saldo pendiente legible: "$ 3.000.000 + USD 450", "Pagado", o null si no
 * se conoce el total del plan de ninguna divisa (no se le dice nada al cliente).
 */
export function textoSaldo(cuentas: CuentaDivisa[], enDivisa: (v: number, d: Divisa) => string): string | null {
  const pendientes = cuentas.filter(c => c.saldo != null && c.saldo > 0)
  if (pendientes.length) return pendientes.map(c => enDivisa(c.saldo!, c.divisa)).join(' + ')
  return cuentas.some(c => c.saldo != null) ? 'Pagado' : null
}
