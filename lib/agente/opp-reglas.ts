import { TAGS } from '@/lib/agente/config'

/**
 * Reglas PURAS (sin red) para mantener al día dos datos de la oportunidad que
 * el equipo no llena y que los reportes de GHL necesitan: la FUENTE del lead y
 * el VALOR de la venta. La corrida está en lib/agente/mantenimiento-opp.ts.
 */

/** opportunity.total_pasajeros__valor_total: el valor total de la compra (COP). */
export const CAMPO_VALOR_TOTAL = 'H2thUvboanXKkNVSA8Sk'

/** opportunity.fuente_del_lead (TEXT). Mismo id que `CAMPOS_CALIFICACION_OPP.fuenteLead`. */
export const CAMPO_FUENTE_LEAD = 'YYZ5nzaNLlceZJnkV8Ar'

/**
 * Un campo personalizado tal como lo devuelve GHL. OJO: el GET por id y el
 * search lo traen en llaves distintas (`fieldValue` vs `fieldValueNumber` /
 * `fieldValueString`), por eso se prueban todas.
 */
export interface CampoOppCrudo {
  id: string
  fieldValue?: unknown
  field_value?: unknown
  fieldValueString?: string
  fieldValueNumber?: number
}

/** Lee un campo numérico (acepta "5.412.000", "$ 5,412,000" y números). */
export function numeroCampo(campos: CampoOppCrudo[] | undefined, campoId: string): number | null {
  const cf = campos?.find(f => f.id === campoId)
  const crudo = cf?.fieldValueNumber ?? cf?.fieldValue ?? cf?.field_value ?? cf?.fieldValueString
  if (crudo === undefined || crudo === null || crudo === '') return null
  if (typeof crudo === 'number') return Number.isFinite(crudo) ? crudo : null
  let t = String(crudo).replace(/[^\d.,-]/g, '')
  // Separadores de miles a la colombiana ("5.412.000") o gringa ("5,412,000").
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '')
  const n = Number(t.replace(/,/g, ''))
  return t && Number.isFinite(n) ? n : null
}

/** Lee un campo de texto (vacío → null). */
export function textoCampo(campos: CampoOppCrudo[] | undefined, campoId: string): string | null {
  const cf = campos?.find(f => f.id === campoId)
  const crudo = cf?.fieldValueString ?? cf?.fieldValue ?? cf?.field_value
  const t = typeof crudo === 'string' ? crudo.trim() : ''
  return t || null
}

/**
 * Valor que le falta a la tarjeta, o null si no hay nada que hacer. El campo
 * "Total Pasajeros - Valor Total" manda (lo llena la asesora en la
 * liquidación; es el mismo criterio que `automatizarReserva` al guardar en el
 * Generador). Un total en cero o vacío nunca pisa el valor que ya tenga.
 */
export function valorPendiente(
  o: { monetaryValue?: number | null; customFields?: CampoOppCrudo[] },
  opciones: { soloSiVacio?: boolean } = {}
): number | null {
  const total = numeroCampo(o.customFields, CAMPO_VALOR_TOTAL)
  if (total === null || total < VALOR_MINIMO_COP) return null
  const actual = o.monetaryValue ?? 0
  if (total === actual) return null
  // El cron solo llena tarjetas SIN valor: una con valor distinto lo puso una
  // persona a mano (dry-run 09-oct: 3 reservas viejas con 9,2 M / 14,2 M en la
  // tarjeta y 4,5 M / 4,9 M en el campo — probablemente sin los aéreos). Al
  // guardar en el Generador sí manda el campo: la asesora acaba de liquidar.
  if (opciones.soloSiVacio && actual > 0) return null
  return total
}

/**
 * Por debajo de esto el "Valor Total" no es un precio en pesos sino un error de
 * digitación. Caso real (dry-run del 09-oct-2026): una reserva con valor
 * 20.083.205 tenía "4" en el campo (la cantidad de pasajeros) y otra "9.720"
 * (al parecer dólares). Copiarlo borraba una venta real del tablero; se deja
 * como está y el dry-run lo reporta como dudoso.
 */
export const VALOR_MINIMO_COP = 100_000

/** El campo tiene un total distinto del valor, pero tan bajo que no se copia (para revisar a mano). */
export function valorDudoso(o: { monetaryValue?: number | null; customFields?: CampoOppCrudo[] }): number | null {
  const total = numeroCampo(o.customFields, CAMPO_VALOR_TOTAL)
  return total !== null && total > 0 && total < VALOR_MINIMO_COP && total !== (o.monetaryValue ?? 0) ? total : null
}

/**
 * ¿Se puede escribir la fuente? Solo si está vacía o dice "lead" (lo que fija
 * el workflow E-01 al crear la tarjeta). Cualquier otro valor lo puso alguien
 * a propósito y no se toca.
 */
export function fuenteSobrescribible(source: string | null | undefined): boolean {
  const s = (source ?? '').trim().toLowerCase()
  return s === '' || s === 'lead'
}

/** Recorta el nombre del anuncio para que la fuente se lea en el tablero. */
function corto(nombre: string, max = 40): string {
  const t = nombre.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/**
 * La fuente real del lead, en orden de certeza:
 *  1. anuncio de origen registrado (`agente_conversacion_anuncio`) → "Meta Ads · <anuncio>";
 *  2. tag de anuncio que pone la integración de WhatsApp → "Meta Ads";
 *  3. canal del primer mensaje: Instagram / Facebook / WhatsApp directo / chat del sitio.
 * null = no se sabe (p. ej. tarjeta creada a mano sin conversación): no se toca.
 */
export function fuenteDelLead(e: {
  anuncioNombre?: string | null
  tags?: readonly string[]
  /** messageType del primer mensaje del cliente (canal en `agente_eventos`). */
  canal?: string | null
}): string | null {
  const anuncio = e.anuncioNombre?.trim()
  if (anuncio) return `Meta Ads · ${corto(anuncio)}`
  if ((e.tags ?? []).some(t => (TAGS.anuncioMeta as readonly string[]).includes(t))) return 'Meta Ads'
  switch (e.canal) {
    case 'TYPE_INSTAGRAM':
      return 'Instagram'
    case 'TYPE_FACEBOOK':
      return 'Facebook'
    // Las dos apps de WhatsApp de la cuenta llegan como canal custom.
    case 'TYPE_CUSTOM_SMS':
    case 'TYPE_CUSTOM_PROVIDER_SMS':
    case 'TYPE_WHATSAPP':
      return 'WhatsApp directo'
    case 'TYPE_LIVE_CHAT':
      return 'Chat del sitio web'
    default:
      return null
  }
}
