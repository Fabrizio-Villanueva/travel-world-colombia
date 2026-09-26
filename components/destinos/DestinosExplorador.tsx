'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Globe, Star, CalendarDays, ArrowLeft, Tag } from 'lucide-react'
import type { Categoria, CategoriaArbol, Destino } from '@/types/destino'
import { fbCustomEvent } from '@/lib/analytics/fbpixel'
import { DestinoCard } from './DestinoCard'
import type { SeleccionMapa } from './MapaDestinos'
import { CategoriasDestinos, grupos as gruposCategorias } from './CategoriasDestinos'
import { scrollBehavior } from '@/components/ui/useReducedMotion'

// El mapa (y sus ~120 KB de geografía) se cargan en un chunk aparte: no pesan
// en el bundle inicial de /destinos ni bloquean el primer render del listado.
const MapaDestinos = dynamic(() => import('./MapaDestinos').then(m => m.MapaDestinos), {
  ssr: false,
  loading: () => (
    <div
      className="tema-oscuro rounded-2xl"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', aspectRatio: '960 / 540' }}
    />
  ),
})

/**
 * Filtro único del explorador. Vive en la URL (?f=...) para que las tarjetas
 * de categorías, el mapa y los enlaces externos apliquen el mismo estado y la
 * vista filtrada sea compartible. `transporte:` implica nacional (bus/avión/
 * otros); `pais:` y `region:` son internacionales; `cat:` es una categoría del
 * panel (principal o subcategoría) por su slug.
 */
export type Filtro =
  | 'todos'
  | 'nacional'
  | 'favoritos'
  | 'fin_ano'
  | `region:${string}`
  | `pais:${string}`
  | `transporte:${string}`
  | `cat:${string}`

const esNacional = (d: Destino) => d.pais === 'Colombia'
const minOrden = (ds: Destino[]) => Math.min(...ds.map(d => d.orden))

// Emoji aparte del texto: se pinta con aria-hidden (el lector lee solo el texto).
const TRANSP_LABEL: Record<string, { emoji?: string; texto: string }> = {
  bus: { emoji: '🚌', texto: 'En bus' },
  avion: { emoji: '✈️', texto: 'En avión' },
  otros: { texto: 'Otros planes nacionales' },
}
const TRANSP_ORDEN: Record<string, number> = { bus: 0, avion: 1, otros: 2 }

/** Agrupa manteniendo el orden de inserción; devuelve [clave, destinos][]. */
function agrupar(items: Destino[], clave: (d: Destino) => string): [string, Destino[]][] {
  const m = new Map<string, Destino[]>()
  for (const d of items) {
    const k = clave(d)
    const lista = m.get(k)
    if (lista) lista.push(d)
    else m.set(k, [d])
  }
  return [...m.entries()]
}

/**
 * La URL (?f=) es la única fuente de verdad del filtro, leída con
 * useSyncExternalStore: en el servidor devuelve '' (el HTML estático trae el
 * menú de categorías) y tras hidratar React aplica el deep-link sin mismatch.
 * El evento propio avisa los replaceState que hacemos nosotros (replaceState
 * no dispara popstate).
 */
const EVENTO_FILTRO = 'twc:filtro-destinos'
function suscribirUrl(cb: () => void) {
  window.addEventListener('popstate', cb)
  window.addEventListener(EVENTO_FILTRO, cb)
  return () => {
    window.removeEventListener('popstate', cb)
    window.removeEventListener(EVENTO_FILTRO, cb)
  }
}

/** Valida el ?f= de la URL contra los datos reales; lo desconocido cae a 'todos'. */
function normalizarFiltro(raw: string | null, regiones: Set<string>, paises: Set<string>, cats: Set<string>): Filtro {
  if (raw === 'nacional' || raw === 'favoritos' || raw === 'fin_ano') return raw
  if (raw?.startsWith('region:') && regiones.has(raw.slice(7))) return raw as Filtro
  if (raw?.startsWith('pais:') && paises.has(raw.slice(5))) return raw as Filtro
  if (raw?.startsWith('transporte:') && ['bus', 'avion', 'otros'].includes(raw.slice(11))) return raw as Filtro
  if (raw?.startsWith('cat:') && cats.has(raw.slice(4))) return raw as Filtro
  return 'todos'
}

function Grid({ destinos, nivel }: { destinos: Destino[]; nivel?: 3 | 4 }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {destinos.map((d, i) => (
        <DestinoCard key={d.id} d={d} i={i} nivel={nivel} />
      ))}
    </ul>
  )
}

function Caja({ icon, titulo, total, children }: { icon: React.ReactNode; titulo: string; total: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 sm:p-8" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}>
          {icon}
        </span>
        <h2 className="font-plus-jakarta text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          {titulo}
        </h2>
        <span className="rounded-full px-3 py-1 font-inter text-[11px] font-bold" style={{ background: 'color-mix(in srgb, var(--orange) 10%, transparent)', color: 'var(--orange)' }}>
          {total} programa{total !== 1 ? 's' : ''}
        </span>
        <div aria-hidden className="hidden h-px flex-1 sm:block" style={{ background: 'var(--border)' }} />
      </header>
      {children}
    </section>
  )
}

// Esquema de títulos: h2 (caja) > h3 (subgrupo) > h4 (tarjetas del subgrupo).
function SubGrupo({ titulo, emoji, destinos }: { titulo: string; emoji?: string; destinos: Destino[] }) {
  return (
    <div className="mb-8 last:mb-0">
      <h3 className="mb-3 font-plus-jakarta text-sm font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-dim)' }}>
        {emoji && <span aria-hidden="true">{emoji} </span>}
        {titulo}
      </h3>
      <Grid destinos={destinos} nivel={4} />
    </div>
  )
}

/** Colombia: una caja, sub-grupos por transporte (bus / avión). */
function SeccionNacional({ destinos }: { destinos: Destino[] }) {
  const grupos = agrupar(destinos, d => d.transporte ?? 'otros').sort(
    (a, b) => (TRANSP_ORDEN[a[0]] ?? 9) - (TRANSP_ORDEN[b[0]] ?? 9)
  )
  const soloSinEtiqueta = grupos.length === 1 && grupos[0][0] === 'otros'
  return (
    <Caja icon={<MapPin size={18} />} titulo="Colombia" total={destinos.length}>
      {soloSinEtiqueta ? (
        <Grid destinos={destinos} />
      ) : (
        grupos.map(([k, lista]) => (
          <SubGrupo key={k} titulo={TRANSP_LABEL[k]?.texto ?? 'Otros planes'} emoji={TRANSP_LABEL[k]?.emoji} destinos={lista} />
        ))
      )}
    </Caja>
  )
}

/**
 * Internacional: una caja por región/continente, con TODAS sus tarjetas en una
 * sola grilla (3 por fila) para agruparlas horizontalmente. Se ordenan por país
 * (mismo país queda adyacente) respetando el orden del panel; el país se ve en
 * cada tarjeta.
 */
function SeccionInternacional({ destinos }: { destinos: Destino[] }) {
  const regiones = agrupar(destinos, d => d.region ?? 'Otros destinos').sort(
    (a, b) => minOrden(a[1]) - minOrden(b[1])
  )
  return (
    <>
      {regiones.map(([region, lista]) => {
        const ordenados = agrupar(lista, d => d.pais)
          .sort((a, b) => minOrden(a[1]) - minOrden(b[1]))
          .flatMap(([, ds]) => [...ds].sort((a, b) => a.orden - b.orden))
        return (
          <Caja key={region} icon={<Globe size={18} />} titulo={region} total={lista.length}>
            <Grid destinos={ordenados} />
          </Caja>
        )
      })}
    </>
  )
}

/**
 * Una categoría del panel. Si es principal y sus viajes usan subcategorías, se
 * subdivide (Cruceros › Con visa / Sin visa / Otros); si es una subcategoría,
 * una sola grilla.
 */
function SeccionCategoria({ cat, madre, hijas, destinos }: { cat: Categoria; madre?: CategoriaArbol; hijas: Categoria[]; destinos: Destino[] }) {
  const titulo = madre ? `${madre.nombre} › ${cat.nombre}` : cat.nombre
  const grupos = hijas
    .map(h => ({ h, lista: destinos.filter(d => d.categoria_slugs?.includes(h.slug)) }))
    .filter(g => g.lista.length > 0)
  const sinSub = destinos.filter(d => !hijas.some(h => d.categoria_slugs?.includes(h.slug)))
  return (
    <Caja icon={<Tag size={18} />} titulo={titulo} total={destinos.length}>
      {grupos.length === 0 ? (
        <Grid destinos={destinos} />
      ) : (
        <>
          {grupos.map(({ h, lista }) => (
            <SubGrupo key={h.id} titulo={h.nombre} destinos={lista} />
          ))}
          {sinSub.length > 0 && <SubGrupo titulo={`Otros · ${cat.nombre}`} destinos={sinSub} />}
        </>
      )}
    </Caja>
  )
}

export function DestinosExplorador({ destinos, categorias = [] }: { destinos: Destino[]; categorias?: CategoriaArbol[] }) {
  // SEO: el filtro NO usa useSearchParams — eso forzaba render solo-cliente de
  // todo el explorador y el HTML estático de /destinos perdía las tarjetas y
  // sus links internos. Ver suscribirUrl arriba.
  const search = useSyncExternalStore(suscribirUrl, () => window.location.search, () => '')
  // El mapa en móvil va colapsado (la página era muy larga antes del listado).
  const [mapaAbierto, setMapaAbierto] = useState(false)

  const { nacionales, internacionales, favoritos, finAno } = useMemo(() => ({
    nacionales: destinos.filter(esNacional),
    internacionales: destinos.filter(d => !esNacional(d)),
    favoritos: destinos.filter(d => d.destacado),
    finAno: destinos.filter(d => d.salida_fin_ano),
  }), [destinos])

  // País → { conteo, región } (solo internacionales) para el mapa por país.
  const conteoPaises = useMemo(() => {
    const m = new Map<string, { n: number; region: string }>()
    for (const d of internacionales) {
      const e = m.get(d.pais)
      if (e) e.n += 1
      else m.set(d.pais, { n: 1, region: d.region ?? 'Otros destinos' })
    }
    return m
  }, [internacionales])

  const regionesSet = useMemo(
    () => new Set(internacionales.map(d => d.region ?? 'Otros destinos')),
    [internacionales]
  )

  // Categorías del panel con al menos un viaje en esta lista (en /destinos
  // no hay cruceros, así que "Cruceros" no aparece aquí).
  const catsConViajes = useMemo(() => new Set(destinos.flatMap(d => d.categoria_slugs ?? [])), [destinos])

  const filtro = normalizarFiltro(
    new URLSearchParams(search).get('f'),
    regionesSet,
    new Set(conteoPaises.keys()),
    catsConViajes
  )

  // Al LLEGAR a /destinos con un filtro en la URL (submenú del navbar, enlace
  // compartido), bajar directo al listado filtrado: aterrizar en el hero hace
  // parecer que la elección no aplicó. Solo una vez por montaje — los cambios
  // de filtro dentro de la página ya deciden su propio scroll en setFiltro.
  const scrollInicialHecho = useRef(false)
  useEffect(() => {
    if (scrollInicialHecho.current) return
    // En la navegación SPA el primer render llega ANTES de que la URL cambie
    // (filtro aún 'todos'): no cerrar el candado hasta ver el filtro real.
    if (filtro === 'todos') return
    scrollInicialHecho.current = true
    // Diferido: Next hace su scroll-al-tope al confirmar la navegación y
    // pisaría este. SIN cleanup: en dev, Strict Mode monta dos veces y el
    // clearTimeout del primer montaje cancelaba el scroll; si el componente se
    // desmonta antes de disparar, el getElementById devuelve null y no pasa nada.
    setTimeout(() => {
      document.getElementById('resultados')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    }, 150)
  }, [filtro])

  /**
   * Cambia el filtro y lo refleja en la URL con el History API nativo (shallow:
   * sin ronda al servidor). `scroll` acerca el listado tras elegir una tarjeta
   * o un país del mapa; `origen` reporta el uso del filtro al píxel de Meta.
   * `foco` fuerza a dónde va el foco de teclado tras el cambio (ver abajo).
   */
  const setFiltro = (
    f: Filtro,
    opts?: { scroll?: boolean; origen?: 'tarjeta' | 'mapa' | 'chip'; foco?: 'resultados' | 'categorias' },
  ) => {
    const url = f === 'todos' ? window.location.pathname : `${window.location.pathname}?f=${encodeURIComponent(f)}`
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new Event(EVENTO_FILTRO))
    if (f !== 'todos' && opts?.origen) fbCustomEvent('FiltroDestinos', { filtro: f, origen: opts.origen })
    if (opts?.scroll && f !== 'todos') {
      // Diferido: al filtrar las categorías se ocultan y #resultados cambia de
      // posición, así que hay que medir el scroll DESPUÉS del re-render.
      setTimeout(() => {
        document.getElementById('resultados')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
      }, 50)
    }
    // Gestión del foco (teclado/lector de pantalla): al filtrar, el control
    // pulsado (tarjeta, chip, "Volver") desaparece y el foco caía al <body>.
    // Tras el re-render se mueve al contenedor pedido; tarjetas y chips llevan
    // al listado. Sin destino pedido (p. ej. el mapa, que sigue en pantalla)
    // solo se rescata si el foco se perdió. preventScroll: el scroll (suave o
    // no) ya lo decide el bloque de arriba.
    const pedido = opts?.foco ?? (opts?.origen === 'tarjeta' || opts?.origen === 'chip' ? 'resultados' : null)
    setTimeout(() => {
      const perdido = !document.activeElement || document.activeElement === document.body
      const destino = pedido ?? (perdido ? (f === 'todos' ? 'categorias' : 'resultados') : null)
      if (destino) document.getElementById(destino)?.focus({ preventScroll: true })
    }, 0)
  }

  /** Vuelve al menú de categorías (quita el filtro) y lo deja a la vista. */
  const volverAlMenu = () => {
    setFiltro('todos', { foco: 'categorias' })
    setTimeout(() => {
      document.getElementById('categorias')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    }, 50)
  }

  const grupos = useMemo(() => gruposCategorias(destinos), [destinos])

  const regionSel = filtro.startsWith('region:') ? filtro.slice(7) : null
  const paisSel = filtro.startsWith('pais:') ? filtro.slice(5) : null
  const transpSel = filtro.startsWith('transporte:') ? filtro.slice(11) : null
  const catSlug = filtro.startsWith('cat:') ? filtro.slice(4) : null
  // La categoría elegida: principal (con sus hijas) o subcategoría (con su madre).
  const principalSel = categorias.find(c => c.slug === catSlug)
  const madreSel = principalSel ? undefined : categorias.find(c => c.hijas.some(h => h.slug === catSlug))
  const catSel: Categoria | undefined = principalSel ?? madreSel?.hijas.find(h => h.slug === catSlug)
  const destinosDeCat = catSlug ? destinos.filter(d => d.categoria_slugs?.includes(catSlug)) : []

  // El mapa entiende 'nacional', pais: y region: (region llega de las tarjetas
  // y solo tiñe los países de esa zona).
  const seleccionMapa: SeleccionMapa =
    filtro === 'nacional' || filtro.startsWith('pais:') || filtro.startsWith('region:')
      ? (filtro as SeleccionMapa)
      : null

  // Facetas transversales que ni las tarjetas ni el mapa expresan; solo se
  // muestran en el menú (con filtro activo, el botón de volver las reemplaza).
  const chips: { key: Filtro; emoji?: string; label: string; n: number }[] = [
    { key: 'favoritos' as const, emoji: '⭐', label: 'Favoritos', n: favoritos.length },
    { key: 'fin_ano' as const, emoji: '🎄', label: 'Salidas fin de año', n: finAno.length },
    // Categorías principales del panel (la subcategoría se ve dentro).
    ...categorias
      .filter(c => catsConViajes.has(c.slug))
      .map(c => ({
        key: `cat:${c.slug}` as const,
        label: c.nombre,
        n: destinos.filter(d => d.categoria_slugs?.includes(c.slug)).length,
      })),
  ].filter(c => c.n > 0)

  const nacionalesDeTransp = transpSel
    ? nacionales.filter(d => (d.transporte ?? 'otros') === transpSel)
    : []
  const destinosDePais = paisSel
    ? internacionales.filter(d => d.pais === paisSel).sort((a, b) => a.orden - b.orden)
    : []

  if (destinos.length === 0) {
    return (
      <p className="py-20 text-center font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
        No hay destinos disponibles por el momento.
      </p>
    )
  }

  // Vista tipo menú (pedido del cliente, sep-2026): sin filtro se ve SOLO el
  // menú (mapa + tarjetas de categorías + chips), sin el listado de destinos;
  // con un filtro activo se ocultan las categorías y se ve SOLO el listado
  // filtrado, con un botón para volver al menú.
  const filtrando = filtro !== 'todos'

  // Número de resultados de la vista filtrada (se anuncia por aria-live).
  const nResultados =
    filtro === 'favoritos' ? favoritos.length
    : filtro === 'fin_ano' ? finAno.length
    : regionSel ? internacionales.filter(d => (d.region ?? 'Otros destinos') === regionSel).length
    : paisSel ? destinosDePais.length
    : transpSel ? nacionalesDeTransp.length
    : filtro === 'nacional' ? nacionales.length
    : catSlug ? destinosDeCat.length
    : 0

  const botonVolver = (
    <button
      type="button"
      onClick={volverAlMenu}
      className="flex items-center gap-2 rounded-full px-6 py-2.5 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase transition-all duration-200"
      style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', border: '1px solid var(--orange)' }}
    >
      <ArrowLeft size={14} aria-hidden /> Volver a todos los destinos
    </button>
  )

  return (
    <div>
      {/* Mapa interactivo por país — primero, arriba de las categorías y el
          listado (pedido del cliente). En móvil va colapsado tras un botón para
          que el listado quede más a mano; en sm+ siempre visible. */}
      <div className="mx-auto mb-8 max-w-3xl">
        <button
          type="button"
          aria-expanded={mapaAbierto}
          onClick={() => setMapaAbierto(v => !v)}
          className="mb-3 w-full rounded-full px-5 py-2.5 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase sm:hidden"
          style={{ background: 'var(--bg-alt)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
        >
          <span aria-hidden="true">🗺️</span> {mapaAbierto ? 'Ocultar el mapa' : 'Explorar el mapa'}
        </button>
        <div className={`${mapaAbierto ? 'block' : 'hidden'} sm:block`}>
          <MapaDestinos
            paises={conteoPaises}
            nacionales={nacionales.length}
            seleccion={seleccionMapa}
            onSelect={sel => setFiltro(sel ?? 'todos', { scroll: sel !== null, origen: 'mapa' })}
          />
        </div>
      </div>

      {/* Menú de categorías (solo sin filtro): navegación rápida por
          transporte, región y país; aplican el mismo filtro que el mapa. */}
      {!filtrando && (
        <div id="categorias" tabIndex={-1} aria-label="Categorías de destinos" className="scroll-mt-24 outline-none">
          <CategoriasDestinos grupos={grupos} filtro={filtro} onSelect={f => setFiltro(f, { scroll: f !== 'todos', origen: 'tarjeta' })} />
        </div>
      )}

      {/* Con filtro: botón para volver al menú. Sin filtro: facetas
          transversales (favoritos / fin de año) que el menú no expresa. */}
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {filtrando
          ? botonVolver
          : chips.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFiltro(c.key, { scroll: true, origen: 'chip' })}
                className="flex items-center gap-1.5 rounded-full px-5 py-2 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase transition-all duration-200"
                style={{ background: 'var(--bg-alt)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
              >
                {c.emoji && <span aria-hidden="true">{c.emoji}</span>} {c.label} · {c.n}
              </button>
            ))}
      </div>

      {/* Anuncio para lectores de pantalla al cambiar el filtro */}
      <p className="sr-only" role="status" aria-live="polite">
        {filtrando ? `${nResultados} destino${nResultados !== 1 ? 's' : ''} encontrado${nResultados !== 1 ? 's' : ''}` : ''}
      </p>

      <div id="resultados" tabIndex={-1} aria-label="Resultados" className="flex flex-col gap-10 scroll-mt-24 outline-none">
        {filtro === 'favoritos' && (
          <Caja icon={<Star size={18} />} titulo="Favoritos" total={favoritos.length}>
            <Grid destinos={favoritos} />
          </Caja>
        )}
        {filtro === 'fin_ano' && (
          <Caja icon={<CalendarDays size={18} />} titulo="Salidas de fin de año" total={finAno.length}>
            <Grid destinos={finAno} />
          </Caja>
        )}
        {regionSel && (
          <SeccionInternacional
            destinos={internacionales.filter(d => (d.region ?? 'Otros destinos') === regionSel)}
          />
        )}
        {paisSel && destinosDePais.length > 0 && (
          <Caja icon={<Globe size={18} />} titulo={paisSel} total={destinosDePais.length}>
            <Grid destinos={destinosDePais} />
          </Caja>
        )}
        {transpSel && nacionalesDeTransp.length > 0 && <SeccionNacional destinos={nacionalesDeTransp} />}
        {filtro === 'nacional' && nacionales.length > 0 && <SeccionNacional destinos={nacionales} />}
        {catSel && destinosDeCat.length > 0 && (
          <SeccionCategoria cat={catSel} madre={madreSel} hijas={principalSel?.hijas ?? []} destinos={destinosDeCat} />
        )}
        {/* Repetido al final del listado: tras recorrer muchas tarjetas, el
            camino de vuelta al menú queda a mano sin subir toda la página. */}
        {filtrando && <div className="flex justify-center">{botonVolver}</div>}
      </div>
    </div>
  )
}
