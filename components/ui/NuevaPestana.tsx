/**
 * Aviso solo para lectores de pantalla en enlaces con target="_blank"
 * (WCAG 3.2.5): se coloca al final del texto del enlace.
 */
export function NuevaPestana() {
  return <span className="sr-only"> (abre en una pestaña nueva)</span>
}

/** Mismo aviso, en texto plano, para concatenar en un aria-label. */
export const NUEVA_PESTANA = ' (abre en una pestaña nueva)'
