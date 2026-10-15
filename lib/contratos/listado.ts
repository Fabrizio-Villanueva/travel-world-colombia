import { createAdminClient } from '@/lib/supabase/admin'
import { GHL } from '@/lib/agente/config'

/**
 * Lista de "Contratos enviados" del Generador (15-oct-2026). Una fila por
 * reserva: su último contrato (las versiones reemplazadas no se repiten).
 * Los admins ven todos los de la subcuenta; el resto, solo los que emitió.
 */

export type EstadoListado = 'enviado' | 'visto' | 'firmado' | 'anulado' | 'vencido'
export type FiltroListado = 'todos' | 'pendientes' | 'firmados'

export interface ContratoListado {
  id: string
  opportunityId: string
  reserva: string | null
  titular: string | null
  estado: EstadoListado
  creadoPor: string
  creadoEn: string
  firmadoEn: string | null
}

/** Cuántas reservas muestra la lista (las más recientes). */
const TOPE = 50

export async function listarContratos(opts: {
  email: string
  verTodos: boolean
  filtro: FiltroListado
}): Promise<ContratoListado[]> {
  let q = createAdminClient()
    .from('contratos')
    .select('id, opportunity_id, reserva, titular, estado, creado_por, creado_en, vence_en, visto_en, firmado_en')
    .eq('location_id', GHL.locationId)
    .order('creado_en', { ascending: false })
    // Margen para las versiones reemplazadas que se descartan abajo.
    .limit(TOPE * 4)
  if (!opts.verTodos) q = q.eq('creado_por', opts.email.toLowerCase())
  const { data, error } = await q
  if (error) throw new Error(error.message)

  const ahora = Date.now()
  const vistas = new Set<string>()
  const filas: ContratoListado[] = []
  for (const c of data ?? []) {
    if (vistas.has(c.opportunity_id)) continue
    vistas.add(c.opportunity_id)
    const estado: EstadoListado =
      c.estado === 'enviado' && Date.parse(c.vence_en) < ahora ? 'vencido'
      : c.estado === 'enviado' && c.visto_en ? 'visto'
      : c.estado
    if (opts.filtro === 'pendientes' && estado !== 'enviado' && estado !== 'visto') continue
    if (opts.filtro === 'firmados' && estado !== 'firmado') continue
    filas.push({
      id: c.id,
      opportunityId: c.opportunity_id,
      reserva: c.reserva,
      titular: c.titular,
      estado,
      creadoPor: c.creado_por,
      creadoEn: c.creado_en,
      firmadoEn: c.firmado_en,
    })
    if (filas.length === TOPE) break
  }
  return filas
}
