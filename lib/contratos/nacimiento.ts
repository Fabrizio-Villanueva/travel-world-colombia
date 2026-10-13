/**
 * Fecha de nacimiento unificada (13-oct-2026).
 *
 * El cumpleaños del CLIENTE vive en un solo lugar: el campo nativo
 * "Fecha de nacimiento" (`dateOfBirth`) del contacto en GHL — el que usa el
 * workflow R-01 · Cumpleaños. El viejo "P1 - Fecha de Nacimiento" del
 * contacto se migró ahí y se elimina.
 *
 * Los "P{n} - Fecha de Nacimiento" de la oportunidad se quedan: son de cada
 * pasajero del viaje (cada uno es otra persona). Cuando un pasajero ES el
 * contacto (mismo nombre), su fecha y la nativa se mantienen iguales:
 * el Generador y el portal de documentos escriben en ambos.
 *
 * P1 no siempre es el contacto (ej. el contacto es la hija y el titular es el
 * papá), por eso el cruce es por nombre y no por posición.
 */

const sinTildes = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Palabras de un nombre, sin tildes ni signos (emojis, puntos, guiones). */
function palabras(nombre: string): string[] {
  return sinTildes(nombre)
    .replace(/[^a-zñ\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 1)
}

/**
 * ¿Los dos nombres son la misma persona? Exige al menos dos palabras en
 * común y que TODAS las del nombre más corto estén en el otro:
 * "Diego Romero Porras" = "Diego Armando Romero Porras", pero
 * "Rosa Helena" ≠ "Rosa Elvira Garay".
 */
export function mismaPersona(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const pa = palabras(a)
  const pb = palabras(b)
  const [corto, largo] = pa.length <= pb.length ? [pa, new Set(pb)] : [pb, new Set(pa)]
  if (corto.length < 2) return false
  return corto.every(p => largo.has(p))
}

/** Fecha de GHL (epoch ms, ISO o AAAA-MM-DD) → AAAA-MM-DD, o null. */
export function fechaNacimientoIso(crudo: unknown): string | null {
  if (crudo === null || crudo === undefined || crudo === '') return null
  if (typeof crudo === 'number') {
    const d = new Date(crudo)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const m = String(crudo).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** Una fecha de nacimiento posible: no futura ni de hace más de 120 años. */
export function fechaNacimientoValida(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const t = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(t)) return false
  const hoy = Date.now()
  return t <= hoy && t >= hoy - 120 * 365.25 * 86_400_000
}

/** Nombre completo del contacto de GHL. */
export function nombreContacto(c: { firstName?: string; lastName?: string } | null | undefined): string {
  return [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim()
}
