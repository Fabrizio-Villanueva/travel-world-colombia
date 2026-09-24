'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Botón pequeño que copia un texto (número de cuenta, correo) al portapapeles.
 * `ariaLabel` da contexto al lector de pantalla cuando hay varios "Copiar" en la
 * página ("Copiar número de cuenta Bancolombia"). El aviso "Copiado" va en un
 * status aparte: un aria-live en el propio botón no se anuncia de forma fiable.
 */
export function BotonCopiar({ texto, etiqueta = 'Copiar', ariaLabel }: { texto: string; etiqueta?: string; ariaLabel?: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles (http, iframes): el usuario copia a mano.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copiar}
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-plus-jakarta text-[11px] font-bold uppercase tracking-wide transition-all duration-200"
        style={
          copiado
            // #047857 sobre el verde claro: ≈4,7:1 (antes #059669 = 3,3:1).
            ? { background: 'color-mix(in srgb, #10b981 15%, transparent)', color: '#047857', border: '1px solid #10b981' }
            : { background: 'var(--bg-alt)', color: 'var(--text-dim)', border: '1px solid var(--border)' }
        }
      >
        {copiado ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        {copiado ? 'Copiado' : etiqueta}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copiado ? 'Copiado al portapapeles' : ''}
      </span>
    </>
  )
}
