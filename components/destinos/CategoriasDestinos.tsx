'use client'

import Image from '@/components/ui/Foto'
import type { Destino } from '@/types/destino'
import { destinoCardImg, PLACEHOLDER_DESTINO } from '@/lib/hero'
import type { Filtro } from './DestinosExplorador'

/**
 * Tarjetas de categorías de /destinos (pedido del cliente, sep-2026): grupos
 * clicables que aplican los filtros del explorador. Se generan DINÁMICAMENTE
 * según los programas activos — si mañana cargan un país nuevo de Sudamérica,
 * su tarjeta aparece sola:
 *
 *  - "Colombia": por transporte (en bus / en avión / otros planes).
 *  - "Descubre América": regiones Norteamérica, Centroamérica y Caribe.
 *  - "Sudamérica": una tarjeta POR PAÍS (Brasil, Argentina, Chile…).
 *  - "Otros continentes": Europa, África, Asia, Oceanía (si tienen programas).
 *
 * Cada tarjeta usa como fondo la foto del primer programa de su categoría
 * (destacados primero). Clic = aplicar el filtro; clic estando activa = quitarlo.
 */

interface Card {
  filtro: Filtro
  titulo: string
  n: number
  img: string
}

interface Grupo {
  titulo: string
  cards: Card[]
}

const esNacional = (d: Destino) => d.pais === 'Colombia'

/**
 * Foto representativa de una categoría: primero los destinos CON foto propia
 * (evita el placeholder de marca cuando un hermano sí tiene foto), luego
 * destacados, luego por orden.
 */
function imagenDe(ds: Destino[]): string {
  const conFoto = (d: Destino) => destinoCardImg(d) !== PLACEHOLDER_DESTINO
  const mejor = [...ds].sort(
    (a, b) => Number(conFoto(b)) - Number(conFoto(a)) || Number(b.destacado) - Number(a.destacado) || a.orden - b.orden
  )[0]
  return destinoCardImg(mejor)
}

const TRANSP_CARDS: { key: string; titulo: string }[] = [
  { key: 'bus', titulo: 'Nacionales en bus' },
  { key: 'avion', titulo: 'Nacionales en avión' },
  { key: 'otros', titulo: 'Otros planes nacionales' },
]

// Regiones de "Descubre América" (Suramérica va aparte, por país).
const REGIONES_AMERICA = ['Norteamérica', 'Centroamérica', 'Caribe']

export function grupos(destinos: Destino[]): Grupo[] {
  const nacionales = destinos.filter(esNacional)
  const internacionales = destinos.filter(d => !esNacional(d))
  const region = (d: Destino) => d.region ?? 'Otros destinos'
  const out: Grupo[] = []

  // Colombia: por transporte; si ningún programa está etiquetado, una sola
  // tarjeta general para no mostrar "Otros planes" como única opción.
  if (nacionales.length > 0) {
    const sinEtiquetar = nacionales.every(d => !d.transporte)
    const cards: Card[] = sinEtiquetar
      ? [{ filtro: 'nacional', titulo: 'Planes en Colombia', n: nacionales.length, img: imagenDe(nacionales) }]
      : TRANSP_CARDS.flatMap(({ key, titulo }) => {
          const ds = nacionales.filter(d => (d.transporte ?? 'otros') === key)
          return ds.length > 0 ? [{ filtro: `transporte:${key}` as Filtro, titulo, n: ds.length, img: imagenDe(ds) }] : []
        })
    out.push({ titulo: 'Colombia', cards })
  }

  // Descubre América: regiones del continente (sin Suramérica).
  const america: Card[] = REGIONES_AMERICA.flatMap(r => {
    const ds = internacionales.filter(d => region(d) === r)
    return ds.length > 0 ? [{ filtro: `region:${r}` as Filtro, titulo: r, n: ds.length, img: imagenDe(ds) }] : []
  })
  if (america.length > 0) out.push({ titulo: 'Descubre América', cards: america })

  // Sudamérica: por país.
  const sur = internacionales.filter(d => region(d) === 'Suramérica')
  if (sur.length > 0) {
    const porPais = new Map<string, Destino[]>()
    for (const d of sur) {
      const lista = porPais.get(d.pais)
      if (lista) lista.push(d)
      else porPais.set(d.pais, [d])
    }
    const cards = [...porPais.entries()]
      .sort((a, b) => Math.min(...a[1].map(d => d.orden)) - Math.min(...b[1].map(d => d.orden)))
      .map(([pais, ds]): Card => ({ filtro: `pais:${pais}`, titulo: pais, n: ds.length, img: imagenDe(ds) }))
    out.push({ titulo: 'Sudamérica', cards })
  }

  // Resto de regiones (Europa, África, Asia, Oceanía, Otros destinos).
  const cubiertas = new Set([...REGIONES_AMERICA, 'Suramérica'])
  const resto = new Map<string, Destino[]>()
  for (const d of internacionales) {
    const r = region(d)
    if (cubiertas.has(r)) continue
    const lista = resto.get(r)
    if (lista) lista.push(d)
    else resto.set(r, [d])
  }
  if (resto.size > 0) {
    const cards = [...resto.entries()]
      .sort((a, b) => Math.min(...a[1].map(d => d.orden)) - Math.min(...b[1].map(d => d.orden)))
      .map(([r, ds]): Card => ({ filtro: `region:${r}`, titulo: r, n: ds.length, img: imagenDe(ds) }))
    out.push({ titulo: 'Otros continentes', cards })
  }

  return out
}

export function CategoriasDestinos({
  grupos, filtro, onSelect,
}: {
  grupos: Grupo[]
  filtro: Filtro
  onSelect: (f: Filtro) => void
}) {
  if (grupos.length === 0) return null
  return (
    <div className="mb-10 flex flex-col gap-8">
      {grupos.map(g => (
        <section key={g.titulo}>
          {/* El color va en clase, no inline: el inline pisaría el hover amarillo.
              text-gold (no --orange): sobre este navy el acento es amarillo aunque
              la sección viva en tema claro (donde --orange es azul). */}
          <span
            className="mb-4 inline-block rounded-lg px-4 py-1.5 font-plus-jakarta text-xs font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:text-gold"
            style={{ background: 'rgb(13, 30, 60)' }}
          >
            {g.titulo}
          </span>
          {/* Misma grilla y altura que las tarjetas de producto (DestinoCard:
              h-56) — pedido del cliente: "del mismo tamaño que los productos". */}
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {g.cards.map(c => {
              const activo = filtro === c.filtro
              return (
                <li key={c.filtro}>
                  <button
                    type="button"
                    aria-pressed={activo}
                    onClick={() => onSelect(activo ? 'todos' : c.filtro)}
                    className="u-lift group relative block h-56 w-full overflow-hidden rounded-xl text-left"
                    style={{
                      border: activo ? '2px solid var(--orange)' : '1px solid var(--border)',
                      boxShadow: activo ? '0 0 0 3px color-mix(in srgb, var(--orange) 30%, transparent)' : undefined,
                    }}
                  >
                    <Image
                      src={c.img}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(8, 18, 38, 0.88) 0%, rgba(8, 18, 38, 0.25) 60%, rgba(8, 18, 38, 0.1) 100%)' }}
                    />
                    <span className="absolute inset-x-4 bottom-3">
                      <span className="block font-plus-jakarta text-xl font-extrabold leading-tight text-white transition-colors group-hover:text-gold sm:text-2xl">
                        {c.titulo}
                      </span>
                      <span className="font-inter text-[11px] font-medium" style={{ color: activo ? 'var(--orange)' : 'rgba(255,255,255,0.75)' }}>
                        {c.n} programa{c.n !== 1 ? 's' : ''}{activo ? ' · viendo ✓' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
