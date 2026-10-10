import { SLA_HUMANO } from '@/lib/agente/config'
import { esHabil, minutosHabilesEntre } from '@/lib/agente/horario'
import type { MensajeGhl } from '@/lib/agente/ghl'

/**
 * Reglas PURAS del SLA de respuesta humana (sin red ni base de datos), para
 * poder probarlas con casos sueltos. La corrida está en sla-humano.ts.
 */

/**
 * Primer mensaje de una persona del equipo POSTERIOR al traspaso, o null.
 * `esHumano` es la misma regla que usa el avance de etapas para "Contactado"
 * (`escritoPorAsesora`: ni de Sol ni de un workflow, con usuario o enviado
 * desde el celular), así "respondió una persona" significa lo mismo en todo
 * el código.
 */
export function primerHumanoDesde(
  mensajes: MensajeGhl[],
  inicio: Date,
  esHumano: (m: MensajeGhl & { id: string }) => boolean
): (MensajeGhl & { id: string }) | null {
  const posteriores = mensajes
    .filter(
      (m): m is MensajeGhl & { id: string } =>
        m.direction === 'outbound' &&
        Boolean(m.id) &&
        Boolean(m.messageType) &&
        !m.messageType!.startsWith('TYPE_ACTIVITY') &&
        Boolean(m.dateAdded) &&
        Date.parse(m.dateAdded!) > inicio.getTime()
    )
    .filter(esHumano)
  if (posteriores.length === 0) return null
  // La API da los mensajes del más reciente al más antiguo: el primero es el último.
  return posteriores.reduce((a, b) => (Date.parse(a.dateAdded!) <= Date.parse(b.dateAdded!) ? a : b))
}

export type PasoSla = 'esperar' | 'avisar_asesora' | 'avisar_supervision' | 'vencido'

/**
 * Qué toca con un episodio abierto SIN respuesta humana. Un aviso por corrida
 * y por episodio (el de supervisión solo después del de la asesora), y nunca
 * con la oficina cerrada: el reloj hábil solo avanza en horario, pero el cron
 * puede notar el cruce a las 5:05 p. m.; ese aviso espera a la apertura.
 */
export function pasoSla(e: {
  inicio: Date
  ahora: Date
  avisoAsesora: boolean
  avisoSupervision: boolean
}): { paso: PasoSla; minutosHabiles: number } {
  const minutosHabiles = minutosHabilesEntre(e.inicio, e.ahora)
  if (e.ahora.getTime() - e.inicio.getTime() > SLA_HUMANO.ventanaDias * 86_400_000) {
    return { paso: 'vencido', minutosHabiles }
  }
  if (!esHabil(e.ahora)) return { paso: 'esperar', minutosHabiles }
  if (!e.avisoAsesora && minutosHabiles >= SLA_HUMANO.minAsesora) return { paso: 'avisar_asesora', minutosHabiles }
  if (e.avisoAsesora && !e.avisoSupervision && minutosHabiles >= SLA_HUMANO.minSupervision) {
    return { paso: 'avisar_supervision', minutosHabiles }
  }
  return { paso: 'esperar', minutosHabiles }
}

/** "1 h 25 min" / "45 min" para los avisos. */
export function duracionTexto(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
