import { createAdminClient } from '@/lib/supabase/admin'
import { GHL } from '@/lib/agente/config'

/**
 * Embudos del panel principal (15-oct-2026): cómo avanzan los contratos y la
 * recolección de documentos. Cuenta una vez cada reserva (su último contrato
 * o enlace); lo anulado o revocado queda aparte. Los admins ven todo el
 * equipo; los demás, solo lo que ellos enviaron.
 */

export interface Etapa {
  etiqueta: string
  n: number
}

export interface Embudo {
  etapas: Etapa[]
  /** Reservas que no entran al embudo (anulados / revocados) o se quedaron colgadas (vencidos). */
  aparte: Etapa[]
}

function ultimoPorReserva<T extends { opportunity_id: string }>(filas: T[]): T[] {
  const vistas = new Set<string>()
  return filas.filter(f => (vistas.has(f.opportunity_id) ? false : (vistas.add(f.opportunity_id), true)))
}

export async function embudoContratos(email: string, verTodos: boolean): Promise<Embudo> {
  let q = createAdminClient()
    .from('contratos')
    .select('opportunity_id, estado, visto_en, vence_en')
    .eq('location_id', GHL.locationId)
    .order('creado_en', { ascending: false })
  if (!verTodos) q = q.eq('creado_por', email.toLowerCase())
  const { data, error } = await q
  if (error) throw new Error(error.message)

  const filas = ultimoPorReserva(data ?? [])
  const vivos = filas.filter(c => c.estado !== 'anulado')
  const ahora = Date.now()
  return {
    etapas: [
      { etiqueta: 'Enviados', n: vivos.length },
      { etiqueta: 'Abiertos por el cliente', n: vivos.filter(c => c.estado === 'firmado' || c.visto_en).length },
      { etiqueta: 'Firmados', n: vivos.filter(c => c.estado === 'firmado').length },
    ],
    aparte: [
      { etiqueta: 'Enlace vencido sin firmar', n: vivos.filter(c => c.estado === 'enviado' && Date.parse(c.vence_en) < ahora).length },
      { etiqueta: 'Anulados', n: filas.length - vivos.length },
    ],
  }
}

export async function embudoDocumentos(email: string, verTodos: boolean): Promise<Embudo> {
  // Los enlaces de documentos aún no guardan la subcuenta: hoy son todos de TWC.
  let q = createAdminClient()
    .from('doc_solicitudes')
    .select('opportunity_id, estado, vence_en, ultimo_acceso_en, consentimiento_en, doc_archivos(count)')
    .order('creada_en', { ascending: false })
  if (!verTodos) q = q.eq('creada_por', email.toLowerCase())
  const { data, error } = await q
  if (error) throw new Error(error.message)

  const filas = ultimoPorReserva(data ?? [])
  const vivos = filas.filter(s => s.estado !== 'revocada')
  const conArchivos = (s: (typeof vivos)[number]) => ((s.doc_archivos as unknown as { count: number }[])[0]?.count ?? 0) > 0
  const ahora = Date.now()
  return {
    etapas: [
      { etiqueta: 'Enlaces enviados', n: vivos.length },
      { etiqueta: 'Abiertos por el cliente', n: vivos.filter(s => s.estado === 'completa' || s.ultimo_acceso_en || s.consentimiento_en).length },
      { etiqueta: 'Con documentos subidos', n: vivos.filter(s => s.estado === 'completa' || conArchivos(s)).length },
      { etiqueta: 'Completos', n: vivos.filter(s => s.estado === 'completa').length },
    ],
    aparte: [
      { etiqueta: 'Enlace vencido sin completar', n: vivos.filter(s => s.estado === 'activa' && Date.parse(s.vence_en) < ahora).length },
      { etiqueta: 'Revocados', n: filas.length - vivos.length },
    ],
  }
}
