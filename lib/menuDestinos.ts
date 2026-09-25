import type { Destino } from '@/types/destino'

/** Enlace de un menú del navbar. */
export interface ItemMenu {
  label: string
  href: string
  /** Filtros del explorador de /destinos (?f=...): se aplican sin recargar si ya estamos ahí. */
  esFiltro?: boolean
  /** Segundo nivel (submenú lateral): columnas de destinos. */
  hijos?: ColumnaMenu[]
}

export interface ColumnaMenu {
  /** Título de la columna, ej. "En bus". Sin título si la región no se subdivide. */
  titulo?: string
  items: { label: string; href: string }[]
}

const porNombre = (a: Destino, b: Destino) => a.nombre.localeCompare(b.nombre, 'es')
const enlace = (d: Destino) => ({ label: d.nombre, href: `/destinos/${d.slug}` })
const filtro = (f: string) => `/destinos?f=${encodeURIComponent(f)}`

/**
 * Menú "Destinos" del navbar: "Todos", Colombia (en bus / en avión) y cada
 * región con sus destinos. Cada grupo enlaza además a su listado filtrado
 * ("Ver todos"). Se arma en el servidor para no mandar el catálogo completo
 * al navegador, solo nombre y slug. Recibe los destinos ya sin cruceros.
 */
export function menuDestinos(destinos: Destino[]): ItemMenu[] {
  const menu: ItemMenu[] = [{ label: 'Todos los destinos', href: '/destinos', esFiltro: true }]

  const nacionales = destinos.filter(d => d.pais === 'Colombia').sort(porNombre)
  if (nacionales.length) {
    const columnas: ColumnaMenu[] = [
      { titulo: 'En bus', items: nacionales.filter(d => d.transporte === 'bus').map(enlace) },
      { titulo: 'En avión', items: nacionales.filter(d => d.transporte === 'avion').map(enlace) },
      { titulo: 'Otros', items: nacionales.filter(d => !d.transporte).map(enlace) },
    ].filter(c => c.items.length)
    menu.push({ label: 'Colombia', href: filtro('nacional'), esFiltro: true, hijos: columnas })
  }

  const regiones = new Map<string, Destino[]>()
  for (const d of destinos) {
    if (d.pais === 'Colombia' || !d.region) continue
    regiones.set(d.region, [...(regiones.get(d.region) ?? []), d])
  }
  for (const [region, lista] of regiones) {
    menu.push({
      label: region,
      href: filtro(`region:${region}`),
      esFiltro: true,
      hijos: [{ items: lista.sort(porNombre).map(enlace) }],
    })
  }

  return menu
}
