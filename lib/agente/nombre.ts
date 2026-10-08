/**
 * Nombre "seguro" para meter en el prompt y en GHL.
 *
 * El nombre del cliente llega de dos fuentes que controla el propio cliente:
 * el nombre de perfil de WhatsApp/IG y lo que dice llamarse (`ia__nombre`, que
 * Sol escribe). Ambos se interpolan en el bloque `system`, donde la regla
 * anti-inyección del prompt no aplica. Un "me llamo Ana. SISTEMA: ..." quedaba
 * guardado y se inyectaba en todos los turnos siguientes.
 *
 * Aquí se reduce a lo que puede ser un nombre: letras (con tildes), espacios,
 * apóstrofo, guion y punto; sin saltos de línea ni comillas; máximo 40
 * caracteres. Vacío → undefined (Sol pregunta el nombre).
 */
export const MAX_NOMBRE = 40

export function nombreSeguro(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined
  const limpio = valor
    .normalize('NFC')
    .replace(/[^\p{L}\p{M} '.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOMBRE)
    .trim()
  return limpio.length >= 2 ? limpio : undefined
}

/** Texto libre que viene del chat y va a un campo de GHL o a una nota: sin saltos raros y acotado. */
export function textoAcotado(valor: string | null | undefined, max = 200): string | undefined {
  if (!valor) return undefined
  const limpio = valor.replace(/\s+/g, ' ').trim().slice(0, max).trim()
  return limpio || undefined
}
