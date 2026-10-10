import { HORARIO } from '@/lib/agente/config'
import { esFestivo } from '@/lib/agente/festivos'

/**
 * Cuándo vuelve a abrir la agencia, calculado (no adivinado por la IA).
 *
 * Caso real (06-oct-2026, martes 6 p. m.): Sol le dijo a un cliente "apenas
 * abramos el lunes te comparto la cotización". Sabía que estaba fuera de
 * horario, pero no cuándo se abría; el modelo inventó el día.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function partesBogota(ahora: Date): { fecha: string; dia: number; hora: number; minuto: number } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: HORARIO.zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ahora)
  const v = (t: string) => f.find(p => p.type === t)?.value ?? '0'
  const fecha = `${v('year')}-${v('month')}-${v('day')}`
  return { fecha, dia: new Date(`${fecha}T12:00:00Z`).getUTCDay(), hora: Number(v('hour')) % 24, minuto: Number(v('minute')) }
}

/** Horario del día (desde/hasta) o null si ese día no se abre. */
function horarioDel(fecha: string): { desde: number; hasta: number } | null {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  if (dia === 0 || esFestivo(fecha)) return null
  return dia === 6 ? HORARIO.sabado : HORARIO.semana
}

const horaTexto = (h: number) => (h === 12 ? '12 m.' : h < 12 ? `${h} a. m.` : `${h - 12} p. m.`)

/**
 * Si la agencia está cerrada, cuándo abre: "mañana miércoles a las 9 a. m.",
 * "hoy a las 9 a. m." o "el martes 13 de octubre a las 9 a. m." (salta
 * domingos y festivos). Null si ahora mismo está abierta.
 */
export function proximaApertura(ahora = new Date()): string | null {
  const hoy = partesBogota(ahora)
  const minutos = hoy.hora * 60 + hoy.minuto
  const deHoy = horarioDel(hoy.fecha)
  if (deHoy && minutos >= deHoy.desde * 60 && minutos < deHoy.hasta * 60) return null
  if (deHoy && minutos < deHoy.desde * 60) return `hoy a las ${horaTexto(deHoy.desde)}`

  const base = new Date(`${hoy.fecha}T12:00:00Z`)
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i)
    const fecha = d.toISOString().slice(0, 10)
    const h = horarioDel(fecha)
    if (!h) continue
    const nombre = DIAS[d.getUTCDay()]
    if (i === 1) return `mañana ${nombre} a las ${horaTexto(h.desde)}`
    return `el ${nombre} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} a las ${horaTexto(h.desde)}`
  }
  return null
}

/** Línea para la situación del prompt: horario real y si la oficina está abierta ahora. */
export function lineaHorario(ahora = new Date()): string {
  const abre = proximaApertura(ahora)
  const horario = `Lunes a viernes ${horaTexto(HORARIO.semana.desde)} – ${horaTexto(HORARIO.semana.hasta)}, sábados ${horaTexto(HORARIO.sabado.desde)} – ${horaTexto(HORARIO.sabado.hasta)}, domingos y festivos cerrado`
  return abre
    ? `Horario de la agencia: ${horario}. AHORA la oficina está cerrada y abre ${abre} (si mencionas cuándo abre o cuándo le escriben, usa EXACTAMENTE eso: nunca adivines un día ni una hora).`
    : `Horario de la agencia: ${horario}. Ahora la oficina está abierta.`
}

/**
 * Minutos HÁBILES entre dos instantes: solo cuentan los que caen dentro del
 * horario de atención (L-V 9-17, sáb 9-13; sin domingos ni festivos).
 *
 * Lo usa el SLA de respuesta humana (lib/agente/sla-humano.ts): un lead que Sol
 * califica un viernes a las 8 p. m. no "lleva 13 horas sin respuesta" el
 * sábado a las 9 a. m.; su reloj arranca con la apertura. Equivale a contar el
 * tiempo desde la siguiente apertura (`proximaApertura`) cuando el hecho
 * ocurrió con la oficina cerrada.
 *
 * Bogotá no tiene horario de verano (UTC-5 fijo desde 1993), por eso las
 * ventanas de cada día se arman con un desfase fijo.
 */
export function minutosHabilesEntre(desde: Date, hasta: Date): number {
  if (!(hasta.getTime() > desde.getTime())) return 0
  const inicio = partesBogota(desde).fecha
  const fin = partesBogota(hasta).fecha
  let total = 0
  const dia = new Date(`${inicio}T12:00:00Z`)
  for (let i = 0; i < 400; i++) {
    const fecha = dia.toISOString().slice(0, 10)
    const h = horarioDel(fecha)
    if (h) {
      const abre = Date.parse(`${fecha}T${String(h.desde).padStart(2, '0')}:00:00-05:00`)
      const cierra = Date.parse(`${fecha}T${String(h.hasta).padStart(2, '0')}:00:00-05:00`)
      const a = Math.max(abre, desde.getTime())
      const b = Math.min(cierra, hasta.getTime())
      if (b > a) total += (b - a) / 60_000
    }
    if (fecha >= fin) break
    dia.setUTCDate(dia.getUTCDate() + 1)
  }
  return Math.floor(total)
}

/** ¿Este instante cae en horario hábil (incluye festivos, a diferencia de `enHorario`)? */
export function esHabil(ahora = new Date()): boolean {
  return proximaApertura(ahora) === null
}
