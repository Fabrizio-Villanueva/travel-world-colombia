import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/publico'

/**
 * Páginas informativas del pie de página (pedido del cliente, 15-oct-2026):
 * información de la compañía y textos que pide la ley en Colombia.
 *
 * La lista (título, columna y orden) vive aquí; el texto de cada una se
 * escribe en el panel ("Páginas del pie de página") y se guarda en la tabla
 * `paginas_info`. Una página se ve en /info/<slug> cuando está publicada y
 * tiene texto. Mientras no, el pie de página enlaza a la página que ya
 * existía (`ruta`), si la hay, o no la muestra.
 */

export type ColumnaInfo = 'compania' | 'servicio' | 'legal'

export const COLUMNAS: { id: ColumnaInfo; titulo: string }[] = [
  { id: 'compania', titulo: 'Nuestra compañía' },
  { id: 'servicio', titulo: 'Servicio al cliente' },
  { id: 'legal', titulo: 'Información legal' },
]

export interface PaginaInfoDef {
  slug: string
  titulo: string
  columna: ColumnaInfo
  /** Página que ya existía en el sitio: se usa mientras no haya texto publicado. */
  ruta?: string
}

export const PAGINAS_INFO: PaginaInfoDef[] = [
  { slug: 'quienes-somos', titulo: '¿Quiénes somos?', columna: 'compania', ruta: '/nosotros' },
  { slug: 'objetivos-de-calidad', titulo: 'Objetivos de calidad y valores corporativos', columna: 'compania' },
  { slug: 'nuestras-oficinas', titulo: 'Nuestras oficinas', columna: 'compania' },
  { slug: 'trabaja-con-nosotros', titulo: 'Trabaja con nosotros', columna: 'compania' },
  { slug: 'sistema-de-gestion-de-calidad', titulo: 'Sistema de gestión de calidad', columna: 'compania' },
  { slug: 'sostenibilidad', titulo: 'Unidos por la sostenibilidad', columna: 'compania', ruta: '/sostenibilidad' },
  { slug: 'portafolio', titulo: 'Nuestro portafolio', columna: 'servicio', ruta: '/destinos' },
  { slug: 'ayudanos-a-mejorar', titulo: 'Ayúdanos a mejorar', columna: 'servicio' },
  { slug: 'politica-de-privacidad', titulo: 'Políticas de privacidad', columna: 'legal', ruta: '/privacidad' },
  { slug: 'lavado-de-activos', titulo: 'Política de lavado de activos LA/FT', columna: 'legal' },
  { slug: 'terminos-y-condiciones', titulo: 'Términos y condiciones', columna: 'legal', ruta: '/terminos-y-condiciones' },
  { slug: 'politicas-de-servicio', titulo: 'Políticas integradas de servicio', columna: 'legal' },
  { slug: 'proteccion-poblacion-infantil', titulo: 'Código de conducta “protección a la población infantil”', columna: 'legal' },
]

export const MAX_INTRO = 400
export const MAX_CONTENIDO = 40_000

export interface PaginaInfoGuardada {
  slug: string
  intro: string
  contenido: string
  publicada: boolean
  actualizado_en: string
}

/** Páginas publicadas con texto (lectura pública, así el sitio sigue siendo estático). */
export const getPaginasPublicadas = cache(async function getPaginasPublicadas(): Promise<Map<string, PaginaInfoGuardada>> {
  const mapa = new Map<string, PaginaInfoGuardada>()
  try {
    const { data, error } = await createPublicClient()
      .from('paginas_info')
      .select('slug, intro, contenido, publicada, actualizado_en')
      .eq('publicada', true)
    if (error) {
      console.error('getPaginasPublicadas error:', error.message)
      return mapa
    }
    for (const p of (data ?? []) as PaginaInfoGuardada[]) {
      if (p.contenido.trim()) mapa.set(p.slug, p)
    }
  } catch (err) {
    console.error('getPaginasPublicadas excepción:', (err as Error).message)
  }
  return mapa
})

/** Enlace de una página en el pie: su texto publicado, la página anterior o nada. */
export function enlacePagina(def: PaginaInfoDef, publicadas: Map<string, PaginaInfoGuardada>): string | null {
  if (publicadas.has(def.slug)) return `/info/${def.slug}`
  return def.ruta ?? null
}
