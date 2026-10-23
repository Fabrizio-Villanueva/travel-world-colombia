import type { Decision } from '@/lib/agente/claude'

/**
 * Revisión del traspaso de Sol v2 (casos reales del 19 y 22-oct-2026).
 *
 * La regla del 13-oct ("pide cotización + datos mínimos = pasa sin más
 * preguntas") dejó pasar leads que la asesora no podía cotizar o que no
 * querían comprar todavía:
 *  - Grupo de 18 con 3 niños: pasó sin las edades (la tarifa de niño depende
 *    de la edad, así que la asesora tiene que volver a preguntar).
 *  - "Por ahora solo quiero mirar opciones": Sol lo tomó como pedido de
 *    cotización y lo pasó a "Calificado por Bot".
 *
 * Estas revisiones se suman a las de `revisarMensaje` (guardas.ts): si hay
 * hallazgos, se pide UNA corrección al modelo.
 */

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** "solo quiero mirar", "por ahora solo estoy averiguando", "de momento solo viendo opciones"… (sin tildes). */
const SOLO_MIRANDO =
  /\b(solo|solamente|por ahora|de momento|por el momento|todavia)\b[^.?!\n]{0,30}\b(mirar|mirando|ver opciones|viendo|averiguar|averiguando|curiosear|curioseando|curiosidad)\b/

/** ¿El cliente dijo que por ahora solo está mirando / averiguando? */
export function soloEstaMirando(texto: string): boolean {
  return SOLO_MIRANDO.test(sinTildes(texto))
}

/** Hay niños y no se sabe qué edades tienen (ni de este turno ni de antes). */
export function faltanEdadesNinos(datos: Decision['datos'], previos?: Partial<Decision['datos']>): boolean {
  const ninos = datos.ninos ?? previos?.ninos ?? 0
  const edades = datos.edades_ninos?.trim() || previos?.edades_ninos?.trim()
  return ninos > 0 && !edades
}

export function revisarTraspaso(
  decision: Decision,
  opciones: {
    previos?: Partial<Decision['datos']>
    /** Último mensaje del cliente (lo que acaba de decir). */
    ultimoCliente?: string
  }
): string[] {
  const v = decision.venta
  if (!v || v.estado !== 'listo_para_reservar' || decision.accion !== 'responder') return []
  const problemas: string[] = []

  if (faltanEdadesNinos(decision.datos ?? {}, opciones.previos)) {
    problemas.push(
      'pasas el caso a cotización sin las edades de los niños, y sin ellas no se puede cotizar (la tarifa de niño depende de la edad). Pregúntalas en este mensaje (y el nombre en la misma frase si aún no lo tienes), deja el estado en falta_informacion y todavía no digas que le preparas la cotización.'
    )
  }

  if (opciones.ultimoCliente && soloEstaMirando(opciones.ultimoCliente)) {
    problemas.push(
      'el cliente acaba de decir que por ahora solo está mirando: eso es estado explorando con objeción solo_mirando (pide_cotizacion false), no listo_para_reservar, aunque pregunte cuánto sale exactamente. No digas que le preparas la cotización. Si tienes referencia (rango o programa del catálogo), dásela ("hay opciones desde…"); si no la tienes, pregúntale qué presupuesto tiene en mente para mostrarle las opciones que más se le ajusten. Cuando dé su presupuesto, ahí sí pasa.'
    )
  } else if (v.compromiso === 'todavia_no' || v.compromiso === 'no') {
    problemas.push(
      `el cliente respondió «${v.compromiso === 'no' ? 'no' : 'todavía no'}» a la pregunta de compromiso: no es listo_para_reservar. Averigua con suavidad qué lo frena (presupuesto, fechas, quién decide) y trabaja eso.`
    )
  }

  return problemas
}
