'use client'

import { useRef, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import Image from '@/components/ui/Foto'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Destino } from '@/types/destino'
import { heroThumb } from '@/lib/hero'

// ─── Media query: variante única por viewport ────────────────────────────────
// Antes las variantes desktop y móvil se renderizaban AMBAS y CSS ocultaba una:
// 68 botones en el DOM para 34 destinos (lectores de pantalla anunciaban la
// lista duplicada). Ahora se monta solo la variante activa. En SSR/hidratación
// se asume desktop y matchMedia corrige al montar.
const MQ_MOVIL = '(max-width: 767px)'

function suscribirMovil(cb: () => void) {
  const mq = window.matchMedia(MQ_MOVIL)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function useEsMovil(): boolean {
  return useSyncExternalStore(
    suscribirMovil,
    () => window.matchMedia(MQ_MOVIL).matches,
    () => false
  )
}

// ─── Props (same interface as before) ────────────────────────────────────────
interface ThumbnailBarProps {
  destinos:    Destino[]
  activeIndex: number
  onSelect:    (index: number) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Circular diff: [-total/2 … total/2] */
function circularDiff(i: number, active: number, total: number): number {
  let d = i - active
  if (d >  total / 2) d -= total
  if (d < -total / 2) d += total
  return d
}

const CF_TRANSITION =
  'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), ' +
  'opacity 0.4s ease, filter 0.4s ease, box-shadow 0.4s ease'

/**
 * Returns inline styles for a coverflow card based on its diff from active.
 * All items are absolutely positioned at left:50% top:50% inside
 * a perspective:900px container.
 */
function cfStyle(diff: number): CSSProperties {
  const base: CSSProperties = {
    position:     'absolute',
    left:         '50%',
    top:          '50%',
    width:        '80px',
    height:       '80px',
    borderRadius: '50%',
    overflow:     'hidden',
    padding:      0,
    background:   'none',
    transition:   CF_TRANSITION,
    willChange:   'transform',
    border:       '2.5px solid transparent',
  }

  switch (diff) {
    case 0:
      return {
        ...base,
        transform:  'translate(-50%, -50%) translateZ(60px) scale(1.38)',
        opacity:    1,
        filter:     'brightness(1)',
        zIndex:     10,
        border:     '2.5px solid var(--orange)',
        boxShadow:  '0 0 24px color-mix(in srgb, var(--orange) 65%, transparent)',
        cursor:     'default',
      }
    case -1:
      return {
        ...base,
        transform: 'translate(calc(-50% - 130px), -50%) rotateY(28deg)',
        opacity:   1,
        filter:    'brightness(0.6)',
        zIndex:    5,
        cursor:    'pointer',
      }
    case 1:
      return {
        ...base,
        transform: 'translate(calc(-50% + 130px), -50%) rotateY(-28deg)',
        opacity:   1,
        filter:    'brightness(0.6)',
        zIndex:    5,
        cursor:    'pointer',
      }
    case -2:
      return {
        ...base,
        transform: 'translate(calc(-50% - 250px), -50%) rotateY(42deg) scale(0.72)',
        opacity:   1,
        filter:    'brightness(0.35)',
        zIndex:    2,
        cursor:    'pointer',
      }
    case 2:
      return {
        ...base,
        transform: 'translate(calc(-50% + 250px), -50%) rotateY(-42deg) scale(0.72)',
        opacity:   1,
        filter:    'brightness(0.35)',
        zIndex:    2,
        cursor:    'pointer',
      }
    default:
      return {
        ...base,
        transform:     'translate(-50%, -50%) scale(0.4)',
        opacity:       0,
        zIndex:        0,
        pointerEvents: 'none',
      }
  }
}

const ARROW_STYLE: CSSProperties = {
  width:        '30px',
  height:       '30px',
  borderRadius: '50%',
  border:       '1.5px solid color-mix(in srgb, var(--orange) 40%, transparent)',
  background:   'none',
  color:        'rgba(255,255,255,0.6)',
  cursor:       'pointer',
  display:      'grid',
  placeItems:   'center',
  flexShrink:   0,
  transition:   'border-color 0.25s, color 0.25s, background 0.25s',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ThumbnailBar({ destinos, activeIndex, onSelect }: ThumbnailBarProps) {
  const touchX  = useRef<number | null>(null)
  const total   = destinos.length
  const esMovil = useEsMovil()

  const prev = () => onSelect((activeIndex - 1 + total) % total)
  const next = () => onSelect((activeIndex + 1) % total)

  // ── Touch swipe for mobile ──
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const delta = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 44) {
      if (delta > 0) next()
      else prev()
    }
    touchX.current = null
  }

  // ── Shared dots ──
  const Dots = (
    <div
      className="flex items-center justify-center gap-1.5 pb-6 pt-3"
      role="tablist"
      aria-label="Destinos disponibles"
    >
      {destinos.map((d, i) => (
        <button
          key={d.id}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Ir a ${d.nombre}`}
          onClick={() => onSelect(i)}
          style={{ padding: '4px 2px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span
            style={{
              display:      'block',
              height:       '4px',
              borderRadius: '9999px',
              width:        i === activeIndex ? '24px' : '6px',
              background:   i === activeIndex ? 'var(--orange)' : 'rgba(255,255,255,0.28)',
              transition:   'width 0.35s ease, background 0.35s ease',
            }}
          />
        </button>
      ))}
    </div>
  )

  return (
    <div
      className="relative z-10"
      style={{ animation: 'fadeUp 0.9s 1s both' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* ══════════════════════════════════════════
          DESKTOP ≥768px — Coverflow 3D
      ══════════════════════════════════════════ */}
      {!esMovil && (
      <div className="px-6 pt-2">
        <div className="flex items-center gap-3">

          {/* Arrow — prev */}
          <button
            type="button"
            onClick={prev}
            aria-label="Destino anterior"
            style={ARROW_STYLE}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--orange)'
              el.style.color       = 'var(--orange)'
              el.style.background  = 'color-mix(in srgb, var(--orange) 10%, transparent)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = 'color-mix(in srgb, var(--orange) 40%, transparent)'
              el.style.color       = 'rgba(255,255,255,0.6)'
              el.style.background  = 'none'
            }}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Coverflow container */}
          <div
            style={{
              position:   'relative',
              flex:       1,
              height:     '120px',
              perspective: '900px',
              overflow:   'visible',
            }}
          >
            {destinos.map((d, i) => {
              const diff = circularDiff(i, activeIndex, total)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => diff !== 0 ? onSelect(i) : undefined}
                  aria-label={`Ver destino: ${d.nombre}`}
                  aria-pressed={i === activeIndex}
                  style={cfStyle(diff)}
                >
                  <Image
                    src={heroThumb(d)}
                    alt={d.nombre}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </button>
              )
            })}
          </div>

          {/* Arrow — next */}
          <button
            type="button"
            onClick={next}
            aria-label="Destino siguiente"
            style={ARROW_STYLE}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--orange)'
              el.style.color       = 'var(--orange)'
              el.style.background  = 'color-mix(in srgb, var(--orange) 10%, transparent)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = 'color-mix(in srgb, var(--orange) 40%, transparent)'
              el.style.color       = 'rgba(255,255,255,0.6)'
              el.style.background  = 'none'
            }}
          >
            <ChevronRight size={14} />
          </button>

        </div>
      </div>
      )}

      {/* ══════════════════════════════════════════
          MOBILE <768px — Flat thumbnails + swipe
      ══════════════════════════════════════════ */}
      {esMovil && (
      <div className="flex items-center gap-2.5 px-6 pt-2">

        <button
          type="button"
          onClick={prev}
          aria-label="Destino anterior"
          style={ARROW_STYLE}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--orange)'
            el.style.color       = 'var(--orange)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = 'color-mix(in srgb, var(--orange) 40%, transparent)'
            el.style.color       = 'rgba(255,255,255,0.6)'
          }}
        >
          <ChevronLeft size={14} />
        </button>

        <div className="no-scrollbar flex gap-2.5 overflow-x-auto">
          {destinos.map((d, i) => {
            const isActive = i === activeIndex
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Ver destino: ${d.nombre}`}
                aria-pressed={isActive}
                style={{
                  position:     'relative',
                  width:        '54px',
                  height:       '54px',
                  borderRadius: '50%',
                  overflow:     'hidden',
                  flexShrink:   0,
                  padding:      0,
                  background:   'none',
                  border:       isActive ? '2.5px solid var(--orange)' : '2.5px solid transparent',
                  transform:    isActive ? 'scale(1.18)' : 'scale(1)',
                  boxShadow:    isActive ? '0 0 14px color-mix(in srgb, var(--orange) 50%, transparent)' : 'none',
                  transition:   'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
                  cursor:       isActive ? 'default' : 'pointer',
                }}
              >
                <Image
                  src={heroThumb(d)}
                  alt={d.nombre}
                  width={54}
                  height={54}
                  className="h-full w-full object-cover"
                />
                {/* Dark veil for inactive */}
                {!isActive && (
                  <span
                    aria-hidden
                    style={{
                      position:     'absolute',
                      inset:        0,
                      borderRadius: '50%',
                      background:   'rgba(0,0,0,0.4)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Destino siguiente"
          style={ARROW_STYLE}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--orange)'
            el.style.color       = 'var(--orange)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = 'color-mix(in srgb, var(--orange) 40%, transparent)'
            el.style.color       = 'rgba(255,255,255,0.6)'
          }}
        >
          <ChevronRight size={14} />
        </button>

      </div>
      )}

      {/* ══════════════════════════════════════════
          DOTS — siempre visibles (desktop + móvil)
      ══════════════════════════════════════════ */}
      {Dots}

    </div>
  )
}
