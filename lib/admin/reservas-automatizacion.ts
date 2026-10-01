import { PIPELINE_RESERVACIONES } from '@/lib/agente/config'
import {
  fijarValorOportunidad,
  moverOportunidad,
  obtenerOportunidad,
  type OportunidadDetalleGhl,
} from '@/lib/agente/ghl'

/**
 * Fase 4 de la migración (2026-10-01): al guardar una reserva en el Generador
 * de Contratos, la tarjeta se mantiene sola al día para que el tablero de GHL
 * muestre métricas correctas sin depender de que la asesora se acuerde.
 *
 * - "Total Pasajeros - Valor Total" → valor de la tarjeta (lo que suma el tablero).
 * - Primer abono registrado → 💳 En Pagos.
 * - Abono que deja el saldo en 0 → 📁 Pagada y Documentada.
 *
 * Solo actúa en tarjetas de 🗂️ Reservaciones y solo AVANZA de etapa: una
 * tarjeta que ya va más adelante (Por Viajar, En Viaje…) o cancelada no se toca.
 */

/** opportunity.total_pasajeros__valor_total: el valor total de la compra (COP). */
const CAMPO_VALOR_TOTAL = 'H2thUvboanXKkNVSA8Sk'

/** Plan de pagos de la oportunidad, en orden: abono y saldo de cada cuota. */
const PAGOS = [
  { abono: 'WF8YaiAWMWSTYP6ETaoI', saldo: 'SqC50UYeBvKM9KmBaMkT' }, // Pago 1
  { abono: 'e9toIVVlRrLviMNLJk5H', saldo: 'sjgLOV456lH6vL2bSZIe' }, // Pago 2
  { abono: '4bsIjvo10Z1Fwl4dmpif', saldo: 'gzVA4CQUBLxNlHjDE08e' }, // Pago 3
  { abono: 'tilZL5wYDHmi5jVaNacL', saldo: 'l4hEjxajnvBuXoqqvBPB' }, // Pago 4
] as const

/** Lee un campo numérico del GET por id (cada formato trae el valor en una llave distinta). */
function numero(o: OportunidadDetalleGhl, campoId: string): number | null {
  const cf = o.customFields?.find(f => f.id === campoId)
  const crudo = cf?.fieldValueNumber ?? cf?.fieldValue ?? cf?.field_value ?? cf?.fieldValueString
  if (crudo === undefined || crudo === null || crudo === '') return null
  const n = typeof crudo === 'number' ? crudo : Number(String(crudo).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Etapa a la que deben llevarla los abonos registrados, o null si aún no hay ninguno. */
function etapaPorPagos(o: OportunidadDetalleGhl): string | null {
  const cuotas = PAGOS.map(p => ({ abono: numero(o, p.abono), saldo: numero(o, p.saldo) }))
  const conAbono = cuotas.filter(c => (c.abono ?? 0) > 0)
  if (conAbono.length === 0) return null
  const ultima = conAbono[conAbono.length - 1]
  return ultima.saldo === 0
    ? PIPELINE_RESERVACIONES.etapas.pagadaDocumentada
    : PIPELINE_RESERVACIONES.etapas.enPagos
}

/**
 * Aplica la automatización a una oportunidad recién guardada. Devuelve qué
 * hizo (para el audit log); nunca lanza: un fallo aquí no debe tumbar el
 * guardado de la reserva, que ya ocurrió.
 */
export async function automatizarReserva(opportunityId: string): Promise<string[]> {
  const hecho: string[] = []
  try {
    const o = await obtenerOportunidad(opportunityId)
    if (!o || o.pipelineId !== PIPELINE_RESERVACIONES.id) return hecho
    if (o.status === 'lost' || o.status === 'abandoned') return hecho

    const total = numero(o, CAMPO_VALOR_TOTAL)
    if (total !== null && total > 0 && total !== o.monetaryValue) {
      await fijarValorOportunidad(opportunityId, total)
      hecho.push(`valor=${total}`)
    }

    const destino = etapaPorPagos(o)
    const orden: readonly string[] = PIPELINE_RESERVACIONES.orden
    if (destino && orden.indexOf(o.pipelineStageId ?? '') < orden.indexOf(destino)) {
      await moverOportunidad(opportunityId, PIPELINE_RESERVACIONES.id, destino, 'won')
      hecho.push(`etapa=${destino}`)
    }
  } catch (e) {
    console.error('automatizarReserva:', e)
    hecho.push(`error: ${(e as Error).message}`)
  }
  return hecho
}
