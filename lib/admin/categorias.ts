import { createAdminClient } from '@/lib/supabase/admin'
import { arbolCategorias } from '@/lib/categorias'
import type { Categoria, CategoriaArbol } from '@/types/destino'

/** Todas las categorías (service role, para el panel). */
export async function getCategoriasAdmin(): Promise<Categoria[]> {
  const { data, error } = await createAdminClient()
    .from('categorias')
    .select('id, nombre, slug, parent_id, clave, orden')
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`)
  return (data ?? []) as Categoria[]
}

export async function getArbolCategoriasAdmin(): Promise<CategoriaArbol[]> {
  return arbolCategorias(await getCategoriasAdmin())
}

/**
 * Ids de categorías enviados por el formulario del viaje, saneados: solo los
 * que existen (una categoría pudo borrarse con el formulario abierto) y con la
 * principal de cada subcategoría agregada.
 */
export async function categoriasValidas(enviados: FormDataEntryValue[]): Promise<string[]> {
  const pedidos = new Set(enviados.map(String))
  if (pedidos.size === 0) return []
  const cats = await getCategoriasAdmin()
  const porId = new Map(cats.map(c => [c.id, c]))
  const ok = new Set<string>()
  for (const id of pedidos) {
    const c = porId.get(id)
    if (!c) continue
    ok.add(c.id)
    if (c.parent_id && porId.has(c.parent_id)) ok.add(c.parent_id)
  }
  return [...ok]
}
