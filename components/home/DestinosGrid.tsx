'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Destino } from '@/types/destino'
import { SectionTag } from '@/components/ui/SectionTag'
import { TextoRico } from '@/components/ui/TextoRico'
import { DestinoCard } from '@/components/destinos/DestinoCard'

interface DestinosGridProps {
  destinos: Destino[]
  /** Textos de la sección (editables en el panel; los resuelve la página). */
  textos: { etiqueta: string; titulo: string; subtitulo: string }
}

const INICIAL = 3
const PASO = 3

export function DestinosGrid({ destinos, textos }: DestinosGridProps) {
  // Destacados primero, luego el resto.
  const ordenados = [...destinos].sort((a, b) => Number(b.destacado) - Number(a.destacado))
  const [visibles, setVisibles] = useState(INICIAL)

  const lista = ordenados.slice(0, visibles)
  const hayMas = visibles < ordenados.length

  return (
    <section aria-labelledby="destinos-title" className="py-20 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionTag className="mb-3"><TextoRico texto={textos.etiqueta} /></SectionTag>
          <h2
            id="destinos-title"
            className="font-plus-jakarta text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            <TextoRico texto={textos.titulo} />
          </h2>
          {textos.subtitulo && (
            <p
              className="mx-auto mt-4 max-w-xl font-inter text-sm leading-relaxed"
              style={{ color: 'var(--text-dim)' }}
            >
              <TextoRico texto={textos.subtitulo} />
            </p>
          )}
        </div>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((d, i) => (
            <DestinoCard key={d.id} d={d} entrada={i >= INICIAL ? 'fade' : 'none'} />
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {hayMas && (
            <button
              type="button"
              onClick={() => setVisibles(v => Math.min(v + PASO, ordenados.length))}
              className="destinos-cargar-mas font-plus-jakarta text-[11px] font-bold tracking-[0.15em] uppercase px-6 py-3 rounded-sm"
            >
              Cargar más
            </button>
          )}
          <Link
            href="/destinos"
            className="destinos-ver-todos font-plus-jakarta text-[11px] font-bold tracking-[0.15em] uppercase px-6 py-3 rounded-sm border inline-block"
          >
            Ver todos los destinos
          </Link>
        </div>
      </div>
    </section>
  )
}
