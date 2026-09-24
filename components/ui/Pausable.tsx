'use client'

import { useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'

/**
 * Envuelve un marquee/animación continua con un botón visible de pausa
 * (WCAG 2.2.2). Al pausar añade `clasePausado` al contenedor; el CSS de cada
 * marquee detiene su animación con esa clase. Con "reducir movimiento" la
 * animación ya no corre (globals.css), así que el botón se oculta.
 */
export function Pausable({
  children,
  clasePausado,
  etiqueta,
  className = '',
}: {
  children: ReactNode
  clasePausado: string
  /** Qué se pausa, para el nombre accesible: "Pausar {etiqueta}". */
  etiqueta: string
  className?: string
}) {
  const [pausado, setPausado] = useState(false)
  return (
    <div className={`${className} ${pausado ? clasePausado : ''}`}>
      <div className="mb-3 flex justify-end px-6 motion-reduce:hidden">
        <button
          type="button"
          onClick={() => setPausado(p => !p)}
          aria-label={`${pausado ? 'Reanudar' : 'Pausar'} ${etiqueta}`}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-plus-jakarta text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-dim)', border: '1px solid var(--border)', background: 'var(--bg-alt)' }}
        >
          {pausado ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}
          <span aria-hidden="true">{pausado ? 'Reanudar' : 'Pausar'}</span>
        </button>
      </div>
      {children}
    </div>
  )
}
