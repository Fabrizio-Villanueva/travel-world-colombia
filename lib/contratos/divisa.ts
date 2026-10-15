/**
 * Divisa de cada pago y cuota (pedido del cliente, 10-oct-2026): un pago se
 * registra en pesos, dólares o euros (EUR desde el 15-oct-2026,
 * scripts/ghl-divisa-euros.mjs), y su total, abono y saldo van en esa misma
 * divisa. Campos "Pago N - Divisa" y "Cuota N - Divisa" en GHL
 * (scripts/ghl-crear-campos-divisa.mjs).
 */

export const DIVISAS = ['COP', 'USD', 'EUR'] as const
export type Divisa = (typeof DIVISAS)[number]

/**
 * Por debajo de esto un monto es en dólares (los euros siempre vienen
 * guardados: son posteriores a la divisa). Ningún plan cuesta menos de
 * 100.000 pesos y ningún pago llega a 100.000 dólares.
 */
const TOPE_USD = 100_000

/**
 * Divisa guardada o, si falta (pagos anteriores al 10-oct-2026), inferida por
 * el tamaño de los montos. La TRM NO sirve para inferirla: en GHL hay pagos en
 * pesos que también traen TRM (revisado 10-oct-2026).
 */
export function divisaDe(guardada: unknown, ...montos: (number | null | undefined)[]): Divisa {
  if (typeof guardada === 'string' && (DIVISAS as readonly string[]).includes(guardada.trim())) {
    return guardada.trim() as Divisa
  }
  const m = montos.find((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0)
  return m !== undefined && m < TOPE_USD ? 'USD' : 'COP'
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const extranjera = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** 13575000 → "$ 13.575.000" · 8062.55 (USD) → "USD 8.062,55" · (EUR) → "€ 8.062,55". */
export function enDivisa(v: number, d: Divisa = 'COP'): string {
  return d === 'USD' ? `USD ${extranjera.format(v)}` : d === 'EUR' ? `€ ${extranjera.format(v)}` : pesos.format(v)
}

/** Unidad de la TRM de un pago: pesos por dólar o por euro. */
export const UNIDAD_TRM: Record<Divisa, string> = { COP: 'pesos por dólar', USD: 'pesos por dólar', EUR: 'pesos por euro' }
