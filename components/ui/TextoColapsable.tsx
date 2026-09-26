'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Párrafo largo recortado a N líneas con "Ver más" / "Ver menos". El botón
 * solo aparece si el texto de verdad desborda (se mide al montar y al cambiar
 * el ancho), así una descripción corta se ve completa y sin botón.
 */
export function TextoColapsable({
  texto,
  lineas = 3,
  className = '',
  style,
}: {
  texto: string
  lineas?: 2 | 3 | 4 | 5
  className?: string
  style?: React.CSSProperties
}) {
  const [abierto, setAbierto] = useState(false)
  const [desborda, setDesborda] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  const id = useId()

  useEffect(() => {
    const p = ref.current
    if (!p) return
    const medir = () => {
      // Se mide siempre en estado recortado: con el texto abierto no desborda.
      if (abierto) return
      setDesborda(p.scrollHeight > p.clientHeight + 1)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(p)
    return () => ro.disconnect()
  }, [abierto, texto])

  // line-clamp-N con clases fijas (Tailwind no compila clases armadas al vuelo).
  const clamp = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4', 5: 'line-clamp-5' }[lineas]

  return (
    <div>
      <p ref={ref} id={id} className={`${abierto ? '' : clamp} ${className}`} style={style}>
        {texto}
      </p>
      {(desborda || abierto) && (
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto(a => !a)}
          className="mt-1.5 inline-flex items-center gap-1 font-plus-jakarta text-xs font-bold"
          style={{ color: 'var(--eyebrow)' }}
        >
          {abierto ? 'Ver menos' : 'Ver más'}
          {abierto ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        </button>
      )}
    </div>
  )
}
