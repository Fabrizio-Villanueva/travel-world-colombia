/**
 * Nombre del PDF del contrato (pedido del cliente, 15-oct-2026): número de
 * reserva primero, para que la carpeta de descargas quede ordenada, y luego
 * el titular y el destino.
 *
 *   TW-2836 - Leydy Viviana Rayo Luna - Estados Unidos.pdf
 */

/** "LEYDY VIVIANA" / "leydy viviana" → "Leydy Viviana". */
function capitalizar(s: string): string {
  return s
    .toLocaleLowerCase('es-CO')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase('es-CO'))
}

/** Sin tildes ni símbolos: algunos celulares y WhatsApp dañan esos nombres. */
function seguro(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function partes(c: { reserva?: string | null; titular?: string | null; destino?: string | null }): string[] {
  const reserva = (c.reserva ?? '').replace(/[^\w-]/g, '')
  return [reserva ? `TW-${reserva}` : 'TWC', capitalizar(c.titular ?? ''), capitalizar(c.destino ?? '')].filter(Boolean)
}

/** Título legible (con tildes): "TW-2836 · Leydy Viviana Rayo Luna · Estados Unidos". */
export function tituloContrato(c: { reserva?: string | null; titular?: string | null; destino?: string | null }): string {
  return partes(c).join(' · ')
}

/** Nombre del archivo: "TW-2836 - Leydy Viviana Rayo Luna - Estados Unidos.pdf". */
export function nombreArchivoContrato(c: { reserva?: string | null; titular?: string | null; destino?: string | null }): string {
  const base = partes(c).map(seguro).filter(Boolean).join(' - ').slice(0, 120).trim()
  return `${base}.pdf`
}
