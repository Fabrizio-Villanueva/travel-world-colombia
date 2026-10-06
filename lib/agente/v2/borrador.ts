import { getDestinos } from '@/lib/destinos'
import { SITE } from '@/lib/site'
import type { Decision } from '@/lib/agente/claude'
import type { ReglasComerciales } from '@/lib/agente/reglas'
import { textoRango } from '@/lib/agente/reglas'
import type { Destino } from '@/types/destino'

/**
 * Borrador de cotización "TU VIAJE SOÑADO" (docs/plan-sol-vendedora.md §13.3).
 *
 * Lo arma el CÓDIGO (no el modelo) con lo que Sol ya sabe: datos del cliente,
 * ficha del catálogo, rango que se le dio y política de reserva. Deja marcados
 * con ✏️ los huecos que SOLO la asesora puede llenar (tarifa real, vuelos,
 * disponibilidad). Va al campo "Borrador de cotización" de la oportunidad; el
 * cliente nunca lo ve. Formato copiado de las cotizaciones reales de las ventas.
 */

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** El programa del catálogo al que se refiere el destino que dijo el cliente. */
export function destinoDelCatalogo(destinoCliente: string | undefined, destinos: Destino[]): Destino | undefined {
  if (!destinoCliente?.trim()) return undefined
  const t = norm(destinoCliente)
  return destinos.find(d =>
    [d.nombre, d.nombre_local, d.slug?.replace(/-/g, ' ')]
      .filter((x): x is string => Boolean(x && x.length >= 4))
      .some(a => t.includes(norm(a)) || norm(a).includes(t))
  )
}

export async function armarBorrador(decision: Decision, reglas: ReglasComerciales): Promise<string | undefined> {
  const d = decision.datos
  if (!d.destino?.trim()) return undefined

  const destinos = await getDestinos()
  const prog = destinoDelCatalogo(d.destino, destinos)
  const rango = reglas.rangos.find(r => (prog && r.slug === prog.slug) || norm(d.destino!).includes(norm(r.destino)))
  const p = reglas.politica

  const viajeros = [
    d.adultos ? `${d.adultos} adulto${d.adultos === 1 ? '' : 's'}` : null,
    d.ninos ? `${d.ninos} niño${d.ninos === 1 ? '' : 's'}${d.edades_ninos ? ` (${d.edades_ninos})` : ''}` : null,
  ].filter(Boolean).join(' y ') || '✏️ [confirmar viajeros]'

  const lista = (items?: string[]) => (items?.length ? items.map(i => `• ${i}`).join('\n') : '• ✏️ [completar]')

  return [
    `✈️ *TU VIAJE SOÑADO A ${(prog?.nombre ?? d.destino).toUpperCase()}* 🌴`,
    '',
    `*FECHA DE VIAJE: ${d.fechas?.trim() ? d.fechas.toUpperCase() : '✏️ [confirmar fechas]'}*`,
    `*VIAJEROS: ${viajeros} · SALIDA: ${d.ciudad_salida?.trim() || 'Bogotá (confirmar)'}*`,
    '',
    '*ITINERARIOS DE VUELOS SUGERIDOS*',
    '✏️ [Aerolínea y horarios — confirmar disponibilidad]',
    '',
    '*✅ SU TARIFA INCLUYE:*',
    prog ? lista(prog.incluye) : '• ✏️ [viaje a la medida: completar]',
    '',
    '*❌ SU PLAN NO INCLUYE:*',
    prog ? lista(prog.no_incluye) : '• ✏️ [completar]',
    '',
    '💰 *TARIFA POR PERSONA EN ACOMODACIÓN DOBLE:* ✏️ [$ confirmar]',
    decision.venta?.rango_dado?.trim()
      ? `Referencia que Sol le dio al cliente: ${decision.venta.rango_dado.trim()}`
      : rango
        ? `Rango de referencia del panel: ${textoRango(rango)}`
        : null,
    d.presupuesto?.trim() ? `Presupuesto que mencionó: ${d.presupuesto.trim()}` : null,
    '',
    `📌 Para apartar: ${Number(p.anticipo_pct)} % · saldo hasta ${p.saldo_dias_antes} días antes del viaje (pago total si faltan menos de ${p.pago_total_si_faltan_dias} días).`,
    prog ? `🔗 ${SITE.url}/destinos/${prog.slug}` : null,
    '*TARIFAS SUJETAS A CAMBIO Y DISPONIBILIDAD*',
  ]
    .filter(x => x !== null)
    .join('\n')
}
