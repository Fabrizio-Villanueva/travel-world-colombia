import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/publico'
import type { Categoria, Destino } from '@/types/destino'
import { conCategorias } from '@/lib/categorias'

/**
 * Categorías de viajes (editables en el panel). Si la consulta falla se sigue
 * sin etiquetas: una categoría caída no debe tumbar el catálogo.
 */
export const getCategorias = cache(async function getCategorias(): Promise<Categoria[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nombre, slug, parent_id, clave, orden')
  if (error) {
    console.error('getCategorias error:', error.message)
    return []
  }
  return (data ?? []) as Categoria[]
})

/**
 * Lista de destinos activos, ordenados por `orden` con desempate alfabético.
 * Sin el desempate, los ~20 destinos con orden=0 salían en orden indeterminado
 * de Postgres y el grid "se reordenaba solo" entre revalidaciones ISR.
 */
export const getDestinos = cache(async function getDestinos(): Promise<Destino[]> {
  const supabase = createPublicClient()
  const [{ data, error }, categorias] = await Promise.all([
    supabase
      .from('destinos')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true }),
    getCategorias(),
  ])

  if (error) {
    console.error('getDestinos error:', error.message)
    return []
  }
  return conCategorias((data ?? []) as Destino[], categorias)
})

export interface ResenaDestino {
  nombre: string
  texto: string
  estrellas: number | null
}

/**
 * Una reseña activa asociada a un destino (por nombre), para el testimonio de
 * la página de detalle. Reusa la tabla `resenas` que se gestiona en el panel.
 */
export const getResenaDestino = cache(async function getResenaDestino(
  destino: string
): Promise<ResenaDestino | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('resenas')
    .select('nombre, texto, estrellas')
    .eq('activa', true)
    .ilike('destino', destino)
    .order('orden', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getResenaDestino error:', error.message)
    return null
  }
  return (data as ResenaDestino) ?? null
})

/**
 * Reseñas activas (de la tabla gestionada en el panel) para el markup JSON-LD
 * de reseñas. Reusa el cliente público → RLS solo expone las activas.
 */
export const getResenas = cache(async function getResenas(limite = 8): Promise<ResenaDestino[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('resenas')
    .select('nombre, texto, estrellas')
    .eq('activa', true)
    .order('orden', { ascending: true })
    .order('id', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('getResenas error:', error.message)
    return []
  }
  return (data as ResenaDestino[]) ?? []
})

/**
 * Un destino activo por slug. `null` = no existe (la página responde 404).
 *
 * Si la consulta FALLA (Supabase caído, timeout) lanzamos en vez de devolver
 * null: un 404 se indexa y se cachea como "esta página no existe", mientras que
 * el error boundary da un 500 reintentable. Cacheado por request: la ficha lo
 * pide en generateMetadata y de nuevo al renderizar.
 */
export const getDestino = cache(async function getDestino(slug: string): Promise<Destino | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('destinos')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()

  if (error) {
    console.error('getDestino error:', error.message)
    throw new Error(`No se pudo cargar el destino "${slug}": ${error.message}`)
  }
  if (!data) return null
  return conCategorias([data as Destino], await getCategorias())[0]
})
