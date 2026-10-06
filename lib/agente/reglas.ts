import { createAdminClient } from '@/lib/supabase/admin'
import { formatearPrecio } from '@/lib/precio'

/**
 * Reglas comerciales que Sol v2 usa al vender (migración 031). Las edita solo
 * un administrador en /admin/sol: el 20 %, los rangos o una promoción cambian
 * sin deploy.
 */

export interface PoliticaReserva {
  anticipo_pct: number
  saldo_dias_antes: number
  pago_total_si_faltan_dias: number
  medios_pago: string | null
  notas: string | null
  actualizado_en: string
}

export interface RangoPrecio {
  id: string
  destino: string
  slug: string | null
  noches: string | null
  temporada: 'baja' | 'alta' | 'todo_el_ano'
  desde: number
  hasta: number
  moneda: 'COP' | 'USD'
  incluye: string | null
  notas: string | null
  activo: boolean
  revisado_en: string
}

export interface Promocion {
  id: string
  titulo: string
  slug: string | null
  detalle: string
  valida_hasta: string
  cupos: number | null
  activa: boolean
}

export interface ReglasComerciales {
  politica: PoliticaReserva
  rangos: RangoPrecio[]
  /** Solo las activas y vigentes (valida_hasta >= hoy en Bogotá). */
  promociones: Promocion[]
}

/** Valores de respaldo si la tabla no responde: nunca dejar a Sol sin política. */
const POLITICA_DEFECTO: PoliticaReserva = {
  anticipo_pct: 20,
  saldo_dias_antes: 30,
  pago_total_si_faltan_dias: 30,
  medios_pago: null,
  notas: null,
  actualizado_en: new Date(0).toISOString(),
}

export async function cargarReglas(): Promise<ReglasComerciales> {
  const admin = createAdminClient()
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  const [pol, ran, pro] = await Promise.all([
    admin.from('sol_politica_reserva').select('*').eq('id', 1).maybeSingle(),
    admin.from('sol_rangos').select('*').eq('activo', true).order('destino'),
    admin.from('sol_promociones').select('*').eq('activa', true).gte('valida_hasta', hoy).order('valida_hasta'),
  ])
  return {
    politica: (pol.data as PoliticaReserva | null) ?? POLITICA_DEFECTO,
    rangos: ((ran.data ?? []) as RangoPrecio[]).map(r => ({ ...r, desde: Number(r.desde), hasta: Number(r.hasta) })),
    promociones: (pro.data ?? []) as Promocion[],
  }
}

export function textoRango(r: Pick<RangoPrecio, 'desde' | 'hasta' | 'moneda'>): string {
  return `${formatearPrecio(r.desde, r.moneda)} – ${formatearPrecio(r.hasta, r.moneda)}`
}

/** Bloque de texto para el prompt de Sol v2 (va en la parte variable por turno). */
export function reglasParaPrompt(r: ReglasComerciales): string {
  const p = r.politica
  const politica = [
    `- Para apartar (bloquear la tarifa) se deja un anticipo del **${Number(p.anticipo_pct)} %**.`,
    `- El saldo se paga a más tardar **${p.saldo_dias_antes} días antes** del viaje.`,
    `- Si el viaje es en menos de ${p.pago_total_si_faltan_dias} días, se paga el **total** al reservar.`,
    p.medios_pago ? `- Medios de pago: ${p.medios_pago}` : null,
    p.notas ? `- ${p.notas}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const rangos = r.rangos.length
    ? r.rangos
        .map(x =>
          `- **${x.destino}**${x.noches ? ` (${x.noches})` : ''}: ${textoRango(x)} por persona en acomodación doble` +
          `${x.temporada === 'alta' ? ', temporada alta' : x.temporada === 'baja' ? ', temporada baja/media' : ''}` +
          `${x.incluye ? ` — ${x.incluye}` : ''}${x.notas ? `. ${x.notas}` : ''}${x.slug ? ` [${x.slug}]` : ''}`
        )
        .join('\n')
    : '(sin rangos cargados)'

  const promos = r.promociones.length
    ? r.promociones
        .map(x => `- **${x.titulo}**: ${x.detalle} — válida hasta ${x.valida_hasta}${x.cupos != null ? `, quedan ${x.cupos} cupos` : ''}${x.slug ? ` [${x.slug}]` : ''}`)
        .join('\n')
    : '(ninguna promoción vigente: NO menciones urgencia de cupos ni fechas límite)'

  return `## Política de reserva (oficial)\n${politica}\n\n## Rangos de referencia (por persona, saliendo de Bogotá)\n${rangos}\n\n## Promociones vigentes (la ÚNICA urgencia que puedes mencionar)\n${promos}`
}
