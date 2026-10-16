/** Números de teléfono del aviso antisuplantación (sin dependencias: sirve en el navegador). */

/** "573204891930" → "+57 320 489 1930". */
export function numeroLegible(n: string): string {
  const d = n.replace(/\D/g, '')
  const m = /^57(\d{3})(\d{3})(\d{4})$/.exec(d)
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : `+${d}`
}

/** Lo que escribe la gente ("320 489 1930", "+57 320-489-1930") → "573204891930". */
export function normalizarNumero(texto: string): string {
  const d = texto.replace(/\D/g, '')
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d
}

export function parsearNumeros(texto: string): string[] {
  return [...new Set(texto.split(/[,\n;]/).map(normalizarNumero).filter(n => n.length >= 10))]
}
