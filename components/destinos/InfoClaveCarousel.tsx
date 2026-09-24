'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Icono } from '@/components/ui/Icono'
import type { InfoClave } from '@/types/destino'

function Card({ item }: { item: InfoClave }) {
  return (
    <div
      className="tema-oscuro flex h-full flex-col items-center justify-center gap-4 rounded-2xl p-6 text-center"
      style={{ background: '#16315f', boxShadow: '0 24px 48px -28px rgba(13, 30, 60,0.6)' }}
    >
      <Icono nombre={item.icono} size={44} strokeWidth={1.5} style={{ color: 'var(--orange)' }} />
      <div>
        <p className="font-cinzel text-[11px] font-semibold tracking-[0.22em] uppercase" style={{ color: 'var(--orange)' }}>
          {item.label}
        </p>
        <p className="mt-1 font-plus-jakarta text-xl font-bold" style={{ color: '#fff' }}>{item.valor}</p>
        {item.sub && <p className="mt-0.5 font-inter text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.sub}</p>}
      </div>
    </div>
  )
}

/**
 * Tarjetas de "Información clave". Hasta 4 datos usa la cuadrícula de siempre;
 * con más, un carrusel con snap (swipe en móvil, flechas en escritorio) para
 * que se muestren TODOS los datos cargados en el panel, sin recortar.
 */
export function InfoClaveCarousel({ items }: { items: InfoClave[] }) {
  const track = useRef<HTMLUListElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  // Optimista: con 5+ tarjetas el track siempre desborda en escritorio; el
  // observer lo corrige tras el primer layout.
  const [canNext, setCanNext] = useState(items.length > 4)

  // Las flechas se activan según si la primera/última tarjeta está totalmente
  // visible. IntersectionObserver cubre scroll, resize y estado inicial de una
  // sola vez (más fiable que escuchar eventos de scroll sobre un track con snap).
  useEffect(() => {
    const el = track.current
    const primera = el?.firstElementChild
    const ultima = el?.lastElementChild
    if (!el || !primera || !ultima) return
    const io = new IntersectionObserver(
      entradas => {
        for (const e of entradas) {
          if (e.target === primera) setCanPrev(e.intersectionRatio < 0.99)
          if (e.target === ultima) setCanNext(e.intersectionRatio < 0.99)
        }
      },
      { root: el, threshold: [0, 0.99, 1] }
    )
    io.observe(primera)
    io.observe(ultima)
    return () => io.disconnect()
  }, [items.length])

  if (items.length <= 4) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(item => (
          <li key={`${item.label}-${item.valor}`} className="destino-reveal">
            <Card item={item} />
          </li>
        ))}
      </ul>
    )
  }

  // Sin `behavior` explícito: hereda el scroll-behavior:smooth del track
  // (mejora progresiva; si el navegador no lo anima, salta igual de posición).
  const desplazar = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * (el.clientWidth - 80) })
  }

  return (
    <div className="destino-reveal relative">
      <ul
        ref={track}
        className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 sm:-mx-0 sm:scroll-px-0 sm:px-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        {items.map(item => (
          <li key={`${item.label}-${item.valor}`} className="w-[240px] shrink-0 snap-start sm:w-[262px]">
            <Card item={item} />
          </li>
        ))}
      </ul>

      {/* Flechas (solo escritorio; en móvil se desliza con el dedo) */}
      <button
        type="button"
        onClick={() => desplazar(-1)}
        aria-label="Datos anteriores"
        // Invisible (opacity 0) = fuera del orden de tabulación y del lector.
        aria-hidden={!canPrev || undefined}
        tabIndex={canPrev ? undefined : -1}
        className="absolute -left-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition-opacity lg:flex"
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          boxShadow: '0 10px 24px -10px rgba(13, 30, 60,0.35)',
          color: 'var(--text-primary)',
          opacity: canPrev ? 1 : 0,
          pointerEvents: canPrev ? 'auto' : 'none',
        }}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => desplazar(1)}
        aria-label="Más datos"
        // Invisible (opacity 0) = fuera del orden de tabulación y del lector.
        aria-hidden={!canNext || undefined}
        tabIndex={canNext ? undefined : -1}
        className="absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition-opacity lg:flex"
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          boxShadow: '0 10px 24px -10px rgba(13, 30, 60,0.35)',
          color: 'var(--text-primary)',
          opacity: canNext ? 1 : 0,
          pointerEvents: canNext ? 'auto' : 'none',
        }}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  )
}
