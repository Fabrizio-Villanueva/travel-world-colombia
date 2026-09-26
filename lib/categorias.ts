import type { Categoria, CategoriaArbol, Destino } from '@/types/destino'

/**
 * Utilidades puras de categorías de viajes (sirven en servidor y cliente).
 * La lectura de la tabla vive en lib/destinos.ts (getCategorias).
 */

const porOrden = (a: Categoria, b: Categoria) =>
  a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')

/** Lista plana → categorías principales con sus subcategorías, ordenadas. */
export function arbolCategorias(cats: Categoria[]): CategoriaArbol[] {
  return cats
    .filter(c => !c.parent_id)
    .sort(porOrden)
    .map(c => ({ ...c, hijas: cats.filter(h => h.parent_id === c.id).sort(porOrden) }))
}

/**
 * Etiquetas visibles de un viaje: una por categoría principal, con sus
 * subcategorías marcadas detrás ("Cruceros · Sin visa"). Si solo se marcó la
 * subcategoría (datos viejos o carga manual), igual aparece su madre.
 */
export function etiquetasDe(ids: string[] | undefined, arbol: CategoriaArbol[]): string[] {
  if (!ids?.length) return []
  const sel = new Set(ids)
  return arbol.flatMap(c => {
    const hijas = c.hijas.filter(h => sel.has(h.id))
    if (!sel.has(c.id) && hijas.length === 0) return []
    return [hijas.length ? `${c.nombre} · ${hijas.map(h => h.nombre).join(', ')}` : c.nombre]
  })
}

/** Slugs de las categorías del viaje, incluida la madre de cada subcategoría. */
export function slugsDe(ids: string[] | undefined, cats: Categoria[]): string[] {
  if (!ids?.length) return []
  const porId = new Map(cats.map(c => [c.id, c]))
  const slugs = new Set<string>()
  for (const id of ids) {
    const c = porId.get(id)
    if (!c) continue
    slugs.add(c.slug)
    const madre = c.parent_id ? porId.get(c.parent_id) : undefined
    if (madre) slugs.add(madre.slug)
  }
  return [...slugs]
}

/** Agrega `etiquetas` y `categoria_slugs` a cada viaje. */
export function conCategorias<T extends Destino>(destinos: T[], cats: Categoria[]): T[] {
  const arbol = arbolCategorias(cats)
  return destinos.map(d => ({
    ...d,
    etiquetas: etiquetasDe(d.categorias, arbol),
    categoria_slugs: slugsDe(d.categorias, cats),
  }))
}

/** "Todo Incluido 2027" → "todo-incluido-2027" (para el filtro ?f=cat:). */
export function slugCategoria(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
