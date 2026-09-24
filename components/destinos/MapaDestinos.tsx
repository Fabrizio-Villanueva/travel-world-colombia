'use client'

import { useState } from 'react'
import { useReducedMotion } from '@/components/ui/useReducedMotion'
import { MAPA_VIEWBOX, PAIS_PATHS, PAIS_XY, PAIS_REGION, FONDO_REGIONES, COLOMBIA_XY } from './mapa-mundo'

/**
 * Mapamundi interactivo de /destinos con geografía REAL (Natural Earth 110m,
 * dominio público; ver scripts/generar-mapa-mundo.mjs), ahora POR PAÍS: cada
 * país con programas se ilumina, lleva un punto marcador y es clicable (clic =
 * filtrar por ese país). Las zonas/regiones quedan como tinte de fondo. Las
 * micro-islas sin silueta a 110m (Aruba, Curazao, Singapur, Maldivas) se
 * representan solo con el punto. Colombia (nacional) mantiene su pin animado.
 *
 * El mapa no filtra por sí mismo: reporta la selección al padre
 * (DestinosExplorador) vía onSelect, y pinta el estado `seleccion`. Una
 * selección `region:X` (hecha desde las tarjetas de categorías) también se
 * refleja tiñendo los países de esa región.
 */

export type SeleccionMapa = 'nacional' | `pais:${string}` | `region:${string}` | null

interface MapaDestinosProps {
  /** Conteo de programas por país (solo internacionales) + región del sitio. */
  paises: Map<string, { n: number; region: string }>
  /** Conteo de programas nacionales (pin de Colombia). */
  nacionales: number
  seleccion: SeleccionMapa
  /** El mapa emite 'nacional', `pais:X` o null (limpiar). */
  onSelect: (sel: 'nacional' | `pais:${string}` | null) => void
}

/** Tinte RGB de fondo por zona (sutil; solo diferencia visualmente las regiones). */
const ZONA_RGB: Record<string, string> = {
  Norteamérica: '90, 150, 235',
  Centroamérica: '32, 200, 180',
  Caribe: '255, 204, 41',
  Suramérica: '60, 200, 120',
  Europa: '70, 130, 220',
  África: '225, 145, 65',
  Asia: '230, 168, 23',
  Oceanía: '160, 120, 230',
}
const tinteZona = (region?: string) => `rgba(${ZONA_RGB[region ?? ''] ?? '255, 255, 255'}, 0.12)`

function Pill({
  x, y, texto, activo, onClick, onHover, onLeave,
}: {
  x: number; y: number; texto: string; activo: boolean
  onClick?: () => void; onHover?: () => void; onLeave?: () => void
}) {
  // El mapa se muestra compacto (max-w-3xl ≈ escala 0.8), así que la pastilla
  // es un poco más grande en unidades SVG para que quede legible en pantalla.
  const w = texto.length * 7.4 + 22
  return (
    <g
      transform={`translate(${x - w / 2}, ${y - 13})`}
      style={{ pointerEvents: onClick ? 'auto' : 'none', cursor: onClick ? 'pointer' : undefined }}
      // stopPropagation: la pastilla puede vivir dentro del <g> clicable de su
      // marcador; sin esto el clic haría toggle dos veces y se anularía.
      onClick={onClick ? e => { e.stopPropagation(); onClick() } : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <rect
        width={w}
        height={26}
        rx={13}
        fill={activo ? 'var(--orange)' : 'rgba(13, 30, 60, 0.85)'}
        stroke={activo ? 'var(--orange)' : 'rgba(255,255,255,0.22)'}
      />
      <text
        x={w / 2}
        y={18}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill={activo ? 'var(--orange-contrast)' : 'rgba(255,255,255,0.9)'}
        style={{ fontFamily: 'var(--font-inter, Inter), sans-serif' }}
      >
        {texto}
      </text>
    </g>
  )
}

export function MapaDestinos({ paises, nacionales, seleccion, onSelect }: MapaDestinosProps) {
  const [hover, setHover] = useState<string | null>(null)
  // Foco de teclado: muestra la pastilla y un contorno blanco (capa aparte).
  const [foco, setFoco] = useState<string | null>(null)
  const reducir = useReducedMotion()
  const focoProps = (clave: string) => ({
    onFocus: () => setFoco(clave),
    onBlur: () => setFoco(f => (f === clave ? null : f)),
  })

  const togglePais = (pais: string) =>
    onSelect(seleccion === `pais:${pais}` ? null : `pais:${pais}`)
  const nacionalActivo = seleccion === 'nacional'
  const regionSel = seleccion?.startsWith('region:') ? seleccion.slice(7) : null

  // Países del catálogo con programas. Orden estable a propósito: antes se
  // reordenaban para dibujar el activo al final, pero mover el <path> enfocado
  // en el DOM le quitaba el foco de teclado. El borde del activo se pinta ahora
  // en una capa aparte, encima de todo.
  const conProgramas = [...paises.entries()]

  // País del que hay que mostrar pastilla: el seleccionado, o el que está en hover.
  const paisSel = seleccion?.startsWith('pais:') ? seleccion.slice(5) : null
  const paisPill = hover && paises.has(hover) ? hover : foco && paises.has(foco) ? foco : paisSel

  return (
    <div
      className="tema-oscuro relative overflow-hidden rounded-2xl p-3 sm:p-5"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
    >
      <p className="mb-1 px-2 font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        Explora el mapa
      </p>
      <p className="mb-3 px-2 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Los países iluminados tienen programas: haz clic en uno para ver sus destinos.
      </p>

      <svg viewBox={MAPA_VIEWBOX} className="h-auto w-full" role="group" aria-label="Mapa de países con destinos">
        {/* Fondo decorativo: resto del mundo teñido por zona */}
        {Object.entries(FONDO_REGIONES).map(([region, d]) => (
          <path key={region} d={d} fill={tinteZona(region)} stroke="rgba(8, 18, 38, 0.9)" strokeWidth={0.5} />
        ))}

        {/* Países del catálogo SIN programas: mismo tratamiento que el fondo */}
        {Object.entries(PAIS_PATHS).map(([pais, d]) => {
          if (paises.has(pais) || pais === 'Colombia') return null
          return <path key={pais} d={d} fill={tinteZona(PAIS_REGION[pais])} stroke="rgba(8, 18, 38, 0.9)" strokeWidth={0.5} />
        })}

        {/* Colombia: silueta destacada (el pin de abajo es el control) */}
        {PAIS_PATHS['Colombia'] && (
          <path
            d={PAIS_PATHS['Colombia']}
            fill={nacionalActivo || hover === 'CO' || foco === 'CO' ? 'var(--orange)' : nacionales > 0 ? '#33507f' : tinteZona('Suramérica')}
            stroke={nacionalActivo ? 'color-mix(in srgb, var(--orange) 70%, #000)' : 'rgba(8, 18, 38, 0.9)'}
            strokeWidth={0.7}
            onClick={nacionales > 0 ? () => onSelect(nacionalActivo ? null : 'nacional') : undefined}
            onMouseEnter={nacionales > 0 ? () => setHover('CO') : undefined}
            onMouseLeave={nacionales > 0 ? () => setHover(null) : undefined}
            style={{ cursor: nacionales > 0 ? 'pointer' : 'default', transition: 'fill .2s' }}
          />
        )}

        {/* Países con programas: silueta clicable */}
        {conProgramas.map(([pais, { n, region }]) => {
          const d = PAIS_PATHS[pais]
          if (!d) return null // micro-isla: solo marcador (abajo)
          const activo = seleccion === `pais:${pais}`
          const enRegion = regionSel !== null && region === regionSel
          const fill = activo
            ? 'var(--orange)'
            : hover === pais || foco === pais
              ? 'color-mix(in srgb, var(--orange) 55%, #7a92c4)'
              : enRegion
                ? 'color-mix(in srgb, var(--orange) 40%, #33507f)'
                : '#33507f'
          return (
            <path
              key={pais}
              d={d}
              fill={fill}
              stroke={activo ? 'color-mix(in srgb, var(--orange) 70%, #000)' : 'rgba(8, 18, 38, 0.9)'}
              strokeWidth={0.7}
              role="button"
              tabIndex={0}
              aria-pressed={activo}
              aria-label={`${pais}: ${n} programa${n !== 1 ? 's' : ''}`}
              onClick={() => togglePais(pais)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePais(pais) } }}
              onMouseEnter={() => setHover(pais)}
              onMouseLeave={() => setHover(null)}
              {...focoProps(pais)}
              // Sin outline nativo (en SVG sale como caja rectangular): el foco
              // se muestra con el contorno blanco de la capa de foco de abajo.
              style={{ cursor: 'pointer', outline: 'none', transition: 'fill .2s' }}
            />
          )
        })}

        {/* Marcadores puntuales de los países con programas (clave para islas
            y países pequeños, difíciles de acertar con el dedo) */}
        {conProgramas.map(([pais, { n }]) => {
          const xy = PAIS_XY[pais]
          if (!xy) return null
          const activo = seleccion === `pais:${pais}` || hover === pais || foco === pais
          return (
            <g
              key={`pin-${pais}`}
              role="button"
              tabIndex={PAIS_PATHS[pais] ? -1 : 0}
              aria-pressed={seleccion === `pais:${pais}`}
              aria-label={`${pais}: ${n} programa${n !== 1 ? 's' : ''}`}
              onClick={() => togglePais(pais)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePais(pais) } }}
              onMouseEnter={() => setHover(pais)}
              onMouseLeave={() => setHover(null)}
              {...focoProps(pais)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <circle cx={xy[0]} cy={xy[1]} r={12} fill="transparent" />
              {/* Anillo de foco visible (el outline está anulado) */}
              {foco === pais && !PAIS_PATHS[pais] && (
                <circle cx={xy[0]} cy={xy[1]} r={8} fill="none" stroke="#fff" strokeWidth={2} />
              )}
              <circle cx={xy[0]} cy={xy[1]} r={3.5} fill={activo ? 'var(--orange)' : '#FFD84D'} stroke="rgba(0,0,0,0.4)" />
            </g>
          )
        })}

        {/* Colombia — viajes nacionales */}
        {nacionales > 0 && (
          <g
            role="button"
            tabIndex={0}
            aria-pressed={nacionalActivo}
            aria-label={`Colombia: ${nacionales} programas nacionales`}
            onClick={() => onSelect(nacionalActivo ? null : 'nacional')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(nacionalActivo ? null : 'nacional') } }}
            onMouseEnter={() => setHover('CO')}
            onMouseLeave={() => setHover(null)}
            {...focoProps('CO')}
            style={{ cursor: 'pointer', outline: 'none' }}
          >
            <circle cx={COLOMBIA_XY[0]} cy={COLOMBIA_XY[1]} r={16} fill="transparent" />
            {/* <animate> ignora el CSS de movimiento reducido: solo se monta si se permite */}
            <circle cx={COLOMBIA_XY[0]} cy={COLOMBIA_XY[1]} r={9} fill="color-mix(in srgb, var(--orange) 30%, transparent)">
              {!reducir && <animate attributeName="r" values="7;12;7" dur="2.4s" repeatCount="indefinite" />}
            </circle>
            {foco === 'CO' && (
              <circle cx={COLOMBIA_XY[0]} cy={COLOMBIA_XY[1]} r={14} fill="none" stroke="#fff" strokeWidth={2} />
            )}
            <circle
              cx={COLOMBIA_XY[0]}
              cy={COLOMBIA_XY[1]}
              r={4.5}
              fill={nacionalActivo || hover === 'CO' || foco === 'CO' ? 'var(--orange)' : '#FFD84D'}
              stroke="rgba(0,0,0,0.4)"
            />
            <Pill
              x={COLOMBIA_XY[0] - 78}
              y={COLOMBIA_XY[1] + 22}
              texto={`Colombia · ${nacionales}`}
              activo={nacionalActivo || hover === 'CO' || foco === 'CO'}
              onClick={() => onSelect(nacionalActivo ? null : 'nacional')}
              onHover={() => setHover('CO')}
              onLeave={() => setHover(null)}
            />
          </g>
        )}

        {/* Borde del país seleccionado, encima de sus vecinos */}
        {paisSel && PAIS_PATHS[paisSel] && (
          <path d={PAIS_PATHS[paisSel]} fill="none" stroke="color-mix(in srgb, var(--orange) 70%, #000)" strokeWidth={0.7} pointerEvents="none" />
        )}

        {/* Capa de foco: contorno blanco del país enfocado con teclado */}
        {foco && PAIS_PATHS[foco] && paises.has(foco) && (
          <path d={PAIS_PATHS[foco]} fill="none" stroke="#fff" strokeWidth={2} pointerEvents="none" />
        )}

        {/* Pastilla del país en hover, foco o seleccionado (encima de todo) */}
        {paisPill && PAIS_XY[paisPill] && (
          <Pill
            x={PAIS_XY[paisPill][0]}
            y={PAIS_XY[paisPill][1] - 16}
            texto={`${paisPill} · ${paises.get(paisPill)?.n ?? 0}`}
            activo={seleccion === `pais:${paisPill}` || hover === paisPill || foco === paisPill}
            onClick={() => togglePais(paisPill)}
            onHover={() => setHover(paisPill)}
            onLeave={() => setHover(null)}
          />
        )}
      </svg>
    </div>
  )
}
