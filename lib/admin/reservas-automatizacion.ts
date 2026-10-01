import { PIPELINE_RESERVACIONES } from '@/lib/agente/config'
import { catalogoResuelto, normalizarValor, valorParaGhl } from '@/lib/admin/reservas'
import {
  actualizarCamposOportunidad,
  fijarValorOportunidad,
  moverOportunidad,
  obtenerContacto,
  obtenerOportunidad,
  oportunidadesDe,
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

/** opportunity.enviar_contrato ("ENVIAR CONTRATO?", MULTIPLE_OPTIONS): dispara el workflow "Envio de Contrato". */
const CAMPO_ENVIAR_CONTRATO = 't8kedGFJLDUnXZXcvhrZ'

type CampoLote = { id: string; field_value: string | number | string[] }

/**
 * El workflow de envío se dispara cuando "ENVIAR CONTRATO?" CAMBIA A una
 * opción. Como el campo es de selección múltiple, las opciones se acumulaban
 * ("Preview" + "Enviar" + "Reenviar") y volver a pedir la misma acción no
 * cambiaba nada → no salía el contrato. Aquí se deja solo la acción recién
 * pedida y se vacía el campo antes de escribirla, para que GHL siempre vea un
 * cambio. Modifica el lote en su lugar; llamar ANTES de guardar la oportunidad.
 */
export async function prepararEnvioContrato(
  opportunityId: string,
  lote: CampoLote[]
): Promise<void> {
  const i = lote.findIndex(c => c.id === CAMPO_ENVIAR_CONTRATO)
  if (i < 0) return
  const valor = lote[i].field_value
  const pedido = (Array.isArray(valor) ? valor : [String(valor)]).filter(Boolean)
  if (pedido.length === 0) return

  const o = await obtenerOportunidad(opportunityId)
  const cf = o?.customFields?.find(f => f.id === CAMPO_ENVIAR_CONTRATO)
  const crudo = cf?.fieldValue ?? cf?.field_value
  const actual = Array.isArray(crudo) ? crudo.map(String) : []
  // La acción nueva es la que no estaba marcada; si repite, la última pedida.
  const accion = pedido.filter(x => !actual.includes(x)).at(-1) ?? pedido.at(-1)!

  await actualizarCamposOportunidad(opportunityId, [{ id: CAMPO_ENVIAR_CONTRATO, field_value: [] }])
  lote[i] = { id: CAMPO_ENVIAR_CONTRATO, field_value: [accion] }
}

/**
 * El Generador muestra en amarillo valores SUGERIDOS desde el contacto (campos
 * viejos / calificación de Sol), pero solo quedan en la oportunidad si la
 * asesora guarda ese paso. Las plantillas v2 leen de la oportunidad, así que un
 * contrato pedido con sugerencias sin guardar salía vacío. Al pedir
 * Enviar / Reenviar / Preview, se agregan al lote todas las sugerencias de
 * campos aún vacíos en la oportunidad. Las de lista que no calzan con sus
 * opciones (p. ej. Acomodación en texto libre) se omiten: un valor inválido
 * haría que GHL rechazara el guardado completo. Devuelve cuántas agregó.
 */
export async function completarConSugerencias(
  opportunityId: string,
  lote: CampoLote[]
): Promise<number> {
  if (!lote.some(c => c.id === CAMPO_ENVIAR_CONTRATO)) return 0
  const o = await obtenerOportunidad(opportunityId)
  if (!o) return 0
  const contactId = (o as { contactId?: string }).contactId
  if (contactId && (await esClienteRepetido(contactId, opportunityId))) return 0
  const [{ campos }, contacto] = await Promise.all([
    catalogoResuelto(),
    contactId ? obtenerContacto(contactId) : Promise.resolve(null),
  ])

  const enOportunidad = new Set<string>()
  for (const cf of o.customFields ?? []) {
    const crudo = cf.fieldValue ?? cf.field_value ?? cf.fieldValueString ?? cf.fieldValueDate
    if (normalizarValor(crudo, 'TEXT') !== null) enOportunidad.add(cf.id)
  }
  const enLote = new Set(lote.map(c => c.id))
  const delContacto = new Map((contacto?.customFields ?? []).map(f => [f.id, f.value]))

  let agregadas = 0
  for (const campo of campos) {
    if (campo.model !== 'opportunity' || !campo.prefillContactId) continue
    if (campo.ghlId === CAMPO_ENVIAR_CONTRATO) continue
    if (enOportunidad.has(campo.ghlId) || enLote.has(campo.ghlId)) continue
    const v = normalizarValor(delContacto.get(campo.prefillContactId), campo.dataType)
    if (v === null) continue
    if (campo.options?.length) {
      const elegidos = Array.isArray(v) ? v : [v]
      if (!elegidos.every(x => campo.options!.includes(x))) continue
    }
    lote.push({ id: campo.ghlId, field_value: valorParaGhl(v, campo.dataType) })
    agregadas++
  }
  return agregadas
}

/**
 * ¿El contacto ya tiene OTRA reserva ganada (Reservaciones o historial de
 * Leads)? Las sugerencias vienen del contacto, que solo guarda el último viaje:
 * a un cliente que repite le mostrarían —y guardarían— los pasajeros, vuelos y
 * pagos del viaje anterior. En ese caso la reserva nueva arranca en blanco.
 */
export async function esClienteRepetido(contactId: string, opportunityId: string): Promise<boolean> {
  const oportunidades = await oportunidadesDe(contactId)
  return oportunidades.some(
    o =>
      o.id !== opportunityId &&
      (o.status === 'won' || o.pipelineId === PIPELINE_RESERVACIONES.id)
  )
}
