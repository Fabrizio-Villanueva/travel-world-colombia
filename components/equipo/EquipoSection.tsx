'use client'

import Image from 'next/image'
import { useState } from 'react'
import { EQUIPO, inicialesDe } from '@/lib/equipo'
import { SectionTag } from '@/components/ui/SectionTag'
import { TextoRico } from '@/components/ui/TextoRico'
import { Pausable } from '@/components/ui/Pausable'

interface EquipoSectionProps {
  /** Textos de la sección (editables en el panel; los resuelve la página). */
  textos: { etiqueta: string; titulo: string; subtitulo: string }
}

export function EquipoSection({ textos }: EquipoSectionProps) {
  // Lista duplicada para un loop continuo y sin saltos (marquee).
  const loop = [...EQUIPO, ...EQUIPO]

  // El loop corre siempre; se pausa solo mientras el cursor está sobre
  // una carta y continúa apenas el cursor la abandona.
  const [paused, setPaused] = useState(false)

  return (
    <section
      aria-labelledby="equipo-title"
      className="relative overflow-hidden px-6 py-20 md:py-28"
      style={{ background: 'var(--bg)' }}
    >
      {/* Glow de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-full -translate-x-1/2"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--orange) 6%, transparent) 0%, rgba(13, 30, 60,0) 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
          <SectionTag className="mb-4"><TextoRico texto={textos.etiqueta} /></SectionTag>
          <h2
            id="equipo-title"
            className="font-plus-jakarta text-4xl font-extrabold leading-tight sm:text-5xl"
            style={{ color: 'var(--text-primary)' }}
          >
            <TextoRico texto={textos.titulo} />
          </h2>
          {textos.subtitulo && (
            <p
              className="mx-auto mt-5 max-w-2xl font-inter text-base leading-relaxed sm:text-lg"
              style={{ color: 'var(--text-dim)' }}
            >
              <TextoRico texto={textos.subtitulo} />
            </p>
          )}
          <div
            className="mx-auto mt-8 h-px w-48"
            style={{ background: 'linear-gradient(to right, transparent, var(--orange), var(--gold), transparent)' }}
          />
        </div>
      </div>

      {/* Marquee continuo (full-bleed). Se pausa con el cursor sobre una
          carta, con el foco dentro y con el botón visible de pausa (WCAG 2.2.2).
          Solo se fija 'paused' inline: un 'running' inline pisaría las pausas
          por CSS (foco / botón). */}
      <Pausable clasePausado="equipo-marquee-pausado" etiqueta="carrusel del equipo" className="relative z-10">
      <div className="equipo-marquee relative z-10 -mx-6 mt-2">
        <div
          className="equipo-marquee-track flex w-max"
          style={paused ? { animationPlayState: 'paused' } : undefined}
        >
          {loop.map((m, i) => {
            const Badge = m.badge
            const isClone = i >= EQUIPO.length
            return (
              <article
                key={`${m.nombre}-${i}`}
                aria-hidden={isClone || undefined}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className="equipo-card tema-oscuro relative mr-6 flex shrink-0 flex-col items-center overflow-hidden p-8 text-center"
                style={{ width: 'min(85vw, 320px)' }}
              >
                {/* Avatar */}
                <div className="relative mb-6">
                  <div
                    className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-full p-1"
                    style={{ border: '2px solid var(--orange)' }}
                  >
                    {m.foto ? (
                      <Image
                        src={m.foto}
                        alt={`${m.nombre}, ${m.rol}`}
                        width={110}
                        height={110}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center rounded-full font-plus-jakarta text-3xl font-extrabold text-white"
                        style={{ background: m.gradiente }}
                        aria-label={m.nombre}
                      >
                        {inicialesDe(m.nombre)}
                      </span>
                    )}
                  </div>
                  {/* Badge */}
                  <span
                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
                    style={{ background: 'var(--orange)', border: '2px solid var(--navy)' }}
                  >
                    <Badge size={14} color="#fff" />
                  </span>
                </div>

                <p
                  className="mb-2 font-cinzel text-[10px] tracking-[0.2em] uppercase"
                  style={{ color: 'var(--orange)' }}
                >
                  {m.rol}
                </p>
                <h3 className="mb-4 font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {m.nombre}
                </h3>
                <p
                  className="line-clamp-3 font-inter text-sm leading-relaxed"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {m.descripcion}
                </p>
              </article>
            )
          })}
        </div>
      </div>
      </Pausable>
    </section>
  )
}
