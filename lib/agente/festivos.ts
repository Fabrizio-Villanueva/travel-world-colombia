/**
 * Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani").
 *
 * Los usa el seguimiento de Sol: la Ley 2300 de 2023 ("Dejen de fregar")
 * prohíbe contactar a los consumidores con fines comerciales en domingos y
 * festivos. Se calculan (no hay tabla que actualizar cada año):
 *   - fijos: se celebran el día que caen;
 *   - trasladables: se corren al lunes siguiente si no caen en lunes;
 *   - de Semana Santa: dependen del domingo de Pascua.
 */

const FIJOS: ReadonlyArray<[mes: number, dia: number]> = [
  [1, 1],   // Año Nuevo
  [5, 1],   // Día del Trabajo
  [7, 20],  // Independencia
  [8, 7],   // Batalla de Boyacá
  [12, 8],  // Inmaculada Concepción
  [12, 25], // Navidad
]

const TRASLADABLES: ReadonlyArray<[mes: number, dia: number]> = [
  [1, 6],   // Reyes Magos
  [3, 19],  // San José
  [6, 29],  // San Pedro y San Pablo
  [8, 15],  // Asunción de la Virgen
  [10, 12], // Día de la Raza
  [11, 1],  // Todos los Santos
  [11, 11], // Independencia de Cartagena
]

// Días desde el domingo de Pascua, ya con el traslado a lunes aplicado.
const DESDE_PASCUA = [
  -3, // Jueves Santo
  -2, // Viernes Santo
  43, // Ascensión (jueves +39 → lunes)
  64, // Corpus Christi (jueves +60 → lunes)
  71, // Sagrado Corazón (viernes +68 → lunes)
]

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
function pascua(año: number): Date {
  const a = año % 19
  const b = Math.floor(año / 100)
  const c = año % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(año, mes - 1, dia))
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

function alLunes(d: Date): Date {
  const r = new Date(d)
  const dow = r.getUTCDay()
  if (dow !== 1) r.setUTCDate(r.getUTCDate() + ((8 - dow) % 7))
  return r
}

const cache = new Map<number, Set<string>>()

/** Festivos del año en formato YYYY-MM-DD. */
export function festivosDe(año: number): Set<string> {
  const guardado = cache.get(año)
  if (guardado) return guardado

  const fechas = new Set<string>()
  for (const [mes, dia] of FIJOS) fechas.add(iso(new Date(Date.UTC(año, mes - 1, dia))))
  for (const [mes, dia] of TRASLADABLES) fechas.add(iso(alLunes(new Date(Date.UTC(año, mes - 1, dia)))))
  const p = pascua(año)
  for (const n of DESDE_PASCUA) {
    const d = new Date(p)
    d.setUTCDate(d.getUTCDate() + n)
    fechas.add(iso(d))
  }

  cache.set(año, fechas)
  return fechas
}

/** ¿La fecha (YYYY-MM-DD, calendario de Colombia) es festivo? */
export function esFestivo(fecha: string): boolean {
  return festivosDe(Number(fecha.slice(0, 4))).has(fecha)
}
