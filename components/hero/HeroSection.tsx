'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Destino } from '@/types/destino'
import { BackgroundSlider } from './BackgroundSlider'
import { HeroContent } from './HeroContent'
import { ThumbnailBar } from './ThumbnailBar'
import { heroBg, glowColor } from '@/lib/hero'
import { SITE } from '@/lib/site'
import { useReducedMotion } from '@/components/ui/useReducedMotion'

interface HeroSectionProps {
  destinos: Destino[]
}

export function HeroSection({ destinos }: HeroSectionProps) {
  // Destino activo por defecto: primer destacado, o el primero.
  const defaultIndex = useMemo(() => {
    const i = destinos.findIndex(d => d.destacado)
    return i >= 0 ? i : 0
  }, [destinos])

  const [activeIndex, setActiveIndex] = useState(defaultIndex)

  // Crossfade: dos capas A/B alternando.
  const [layers, setLayers] = useState(() => ({
    a: heroBg(destinos[defaultIndex]),
    b: '',
    showA: true,
  }))

  const select = (i: number) => {
    if (i === activeIndex) return
    const url = heroBg(destinos[i])
    setLayers(prev =>
      prev.showA ? { ...prev, b: url, showA: false } : { ...prev, a: url, showA: true }
    )
    setActiveIndex(i)
  }

  // Pausa (WCAG 2.2.2): botón visible + hover sobre el texto + foco de teclado
  // dentro del hero. Con "reducir movimiento" arranca pausado (sin autoplay)
  // salvo que el usuario lo reanude a mano.
  const reducir = useReducedMotion()
  const [pausaUsuario, setPausaUsuario] = useState<boolean | null>(null)
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  const pausadoBoton = pausaUsuario ?? reducir
  const pausado = pausadoBoton || hover || foco

  // Auto-loop: avanza al siguiente destino cada 4s (crossfade). Cada
  // selección manual reinicia el temporizador (al depender de activeIndex).
  useEffect(() => {
    if (destinos.length <= 1 || pausado) return
    const id = setTimeout(() => {
      const next = (activeIndex + 1) % destinos.length
      const url = heroBg(destinos[next])
      setLayers(prev =>
        prev.showA ? { ...prev, b: url, showA: false } : { ...prev, a: url, showA: true }
      )
      setActiveIndex(next)
    }, 4000)
    return () => clearTimeout(id)
  }, [activeIndex, destinos, pausado])

  const active = destinos[activeIndex]
  if (!active) return null

  return (
    <section
      aria-label="Destinos destacados"
      aria-roledescription="carrusel"
      className="tema-oscuro relative flex w-full flex-col overflow-hidden"
      style={{ height: '100svh' }}
      onFocus={e => {
        // Solo foco de teclado (:focus-visible) y no el propio botón de pausa:
        // si no, un clic en "Reanudar" o en una miniatura dejaba el carrusel
        // pausado hasta hacer clic fuera.
        const t = e.target as HTMLElement
        setFoco(t.matches(':focus-visible') && !t.closest('[data-pausa]'))
      }}
      onBlur={e => {
        // Solo al salir del hero (no al moverse entre controles internos).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false)
      }}
    >
      {/* h1 fijo de la home: el nombre del destino rota, así que no puede ser
          el encabezado principal de la página. */}
      <h1 className="sr-only">
        {SITE.nombre} — agencia de viajes en {SITE.ciudad}, {SITE.region}
      </h1>

      <BackgroundSlider layerA={layers.a} layerB={layers.b} showA={layers.showA} />

      {/* Glow — color según la región del destino */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[26%] z-[2] h-[300px] w-[300px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${glowColor(active.region)},.25) 0%, transparent 70%)`,
          filter: 'blur(50px)',
          animation: 'pulseGlow 4s ease-in-out infinite alternate',
          transition: 'background 0.8s ease',
        }}
      />

      {/* Contenido — remount por key dispara el fadeUp en cada cambio.
          Sin aria-live: con autoplay spamearía al lector de pantalla. */}
      <div className="flex flex-1 flex-col justify-center pt-20">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center">
          <HeroContent key={active.id} destino={active} onHover={setHover} />
        </div>
      </div>

      <ThumbnailBar
        destinos={destinos}
        activeIndex={activeIndex}
        onSelect={select}
        pausado={pausadoBoton}
        onTogglePausa={destinos.length > 1 ? () => setPausaUsuario(!pausadoBoton) : undefined}
      />
    </section>
  )
}
