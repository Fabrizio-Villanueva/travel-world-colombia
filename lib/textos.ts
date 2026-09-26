import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/publico'
import { SITE } from '@/lib/site'
import type { Destino } from '@/types/destino'

/**
 * Textos editables del sitio: títulos, subtítulos y etiquetas de sección de la
 * página principal y de la página de producto.
 *
 * - Los ORIGINALES están aquí (`CATALOGO_TEXTOS`): son el valor por defecto y
 *   lo que muestra "Restaurar" en el panel.
 * - La PLANTILLA GLOBAL vive en la tabla `textos_sitio` (solo lo que cambió).
 *   Editarla cambia todas las páginas de producto a la vez.
 * - Un viaje puede sobreescribir textos de producto en `destinos.textos`
 *   (mismas claves). Los campos históricos `subtitulo`, `cta_titulo` y
 *   `cta_subtitulo` del viaje siguen mandando sobre su sección.
 *
 * Marcas dentro de un texto:
 *   `*así*`      → se pinta con el color de acento (naranja/amarillo del tema).
 *   salto de línea → se respeta (<br>).
 *   `{nombre}`   → nombre del viaje (solo en textos de producto).
 *   `{familias}` / `{resenas}` → cifras de la agencia (lib/site.ts).
 */

export type PaginaTexto = 'inicio' | 'producto'
export type TipoTexto = 'etiqueta' | 'titulo' | 'subtitulo'

export interface DefTexto {
  clave: string
  pagina: PaginaTexto
  /** Nombre de la sección para agrupar en el panel. */
  seccion: string
  tipo: TipoTexto
  original: string
  ayuda?: string
}

/** Tope de caracteres por tipo (los títulos largos rompen el diseño). */
export const MAX_TEXTO: Record<TipoTexto, number> = { etiqueta: 60, titulo: 140, subtitulo: 320 }

const def = (
  pagina: PaginaTexto,
  seccionClave: string,
  seccion: string,
  tipo: TipoTexto,
  original: string,
  ayuda?: string
): DefTexto => ({ clave: `${pagina}.${seccionClave}.${tipo}`, pagina, seccion, tipo, original, ayuda })

export const CATALOGO_TEXTOS: DefTexto[] = [
  // ── Página principal ──
  def('inicio', 'destinos', 'Nuestros destinos', 'etiqueta', 'Nuestros destinos'),
  def('inicio', 'destinos', 'Nuestros destinos', 'titulo', 'Explora el mundo con nosotros'),
  def('inicio', 'destinos', 'Nuestros destinos', 'subtitulo', 'Paquetes diseñados para cada tipo de viajero, con atención personalizada de nuestro equipo de expertos.'),

  def('inicio', 'como', 'Cómo funciona', 'etiqueta', 'El proceso'),
  def('inicio', 'como', 'Cómo funciona', 'titulo', '¿Cómo *funciona?*', 'Lo que va entre asteriscos sale en color de acento.'),

  def('inicio', 'equipo', 'El equipo', 'etiqueta', 'Las personas detrás de tus viajes'),
  def('inicio', 'equipo', 'El equipo', 'titulo', 'El Equipo *Travel World*'),
  def('inicio', 'equipo', 'El equipo', 'subtitulo', 'Cada miembro de nuestro equipo es un apasionado de los viajes. Conocemos los destinos porque los hemos vivido.'),

  def('inicio', 'porque', 'Por qué elegirnos', 'etiqueta', 'Por qué elegirnos'),
  def('inicio', 'porque', 'Por qué elegirnos', 'titulo', 'Tu viaje soñado, en manos expertas.'),
  def('inicio', 'porque', 'Por qué elegirnos', 'subtitulo', 'Cada detalle de tu viaje está diseñado por especialistas que conocen cada destino. Desde la primera consulta hasta tu regreso a casa.'),

  def('inicio', 'alianzas', 'Alianzas', 'etiqueta', 'Respaldo internacional'),
  def('inicio', 'alianzas', 'Alianzas', 'titulo', 'Nuestras alianzas premium'),
  def('inicio', 'alianzas', 'Alianzas', 'subtitulo', 'Trabajamos directamente con las mejores cadenas hoteleras, líneas de crucero y aerolíneas del mundo para ofrecerte tarifas exclusivas.'),

  def('inicio', 'resenas', 'Testimonios', 'etiqueta', 'Testimonios'),
  def('inicio', 'resenas', 'Testimonios', 'titulo', 'Lo que dicen nuestros viajeros'),

  def('inicio', 'cta', 'Llamado a la acción', 'titulo', 'Tu próxima aventura\n*empieza aquí*', 'Puedes usar un salto de línea y asteriscos para el color de acento.'),
  def('inicio', 'cta', 'Llamado a la acción', 'subtitulo', 'Cotiza gratis en menos de 24 horas. Sin compromisos. Más de {familias} familias ya confían en nosotros.', '{familias} se reemplaza por la cifra de familias de la agencia.'),

  def('inicio', 'contacto', 'Contacto', 'etiqueta', 'Encuéntranos'),
  def('inicio', 'contacto', 'Contacto', 'titulo', 'Visítanos o contáctanos'),
  def('inicio', 'contacto', 'Contacto', 'subtitulo', 'Estamos en el corazón de Fusagasugá, listos para planear tu viaje soñado. Puedes hacer tu reserva con nosotros desde cualquier lugar del mundo.'),

  // ── Página de producto ──
  def('producto', 'sobre', 'Sobre el destino', 'etiqueta', 'Sobre el destino'),
  def('producto', 'sobre', 'Sobre el destino', 'titulo', 'Por qué elegir {nombre}', 'Si el viaje tiene "Subtítulo" en su ficha, ese manda.'),

  def('producto', 'incluye', 'Qué incluye', 'etiqueta', 'El paquete'),
  def('producto', 'incluye', 'Qué incluye', 'titulo', '¿Qué incluye tu viaje?'),

  def('producto', 'hospedaje', 'Hospedaje', 'etiqueta', 'Dónde te alojarás'),
  def('producto', 'hospedaje', 'Hospedaje', 'titulo', 'Hospedaje'),

  def('producto', 'experiencias', 'Experiencias', 'etiqueta', 'Lo que te espera'),
  def('producto', 'experiencias', 'Experiencias', 'titulo', 'Experiencias únicas'),

  def('producto', 'info', 'Información clave', 'etiqueta', 'Información clave'),
  def('producto', 'info', 'Información clave', 'titulo', 'Lo que necesitas saber'),

  def('producto', 'itinerario', 'Itinerario', 'etiqueta', 'El plan'),
  def('producto', 'itinerario', 'Itinerario', 'titulo', 'Itinerario día a día'),

  def('producto', 'galeria', 'Galería', 'etiqueta', 'Galería'),
  def('producto', 'galeria', 'Galería', 'titulo', 'Imágenes del destino'),

  def('producto', 'documentos', 'Documentos', 'etiqueta', 'Para descargar'),
  def('producto', 'documentos', 'Documentos', 'titulo', 'Documentos del viaje'),

  def('producto', 'cta', 'Llamado a la acción final', 'etiqueta', '¿Listo para viajar?'),
  def('producto', 'cta', 'Llamado a la acción final', 'titulo', 'Viaja a {nombre}', 'Si el viaje tiene "Título del CTA final" en su ficha, ese manda.'),
  def('producto', 'cta', 'Llamado a la acción final', 'subtitulo', '', 'Vacío = no se muestra. El "Subtítulo del CTA" de cada viaje manda si existe.'),

  def('producto', 'resenas', 'Reseñas', 'etiqueta', 'Reseñas de Google ⭐'),
  def('producto', 'resenas', 'Reseñas', 'titulo', '¿Por qué nos prefieren nuestros clientes?'),

  def('producto', 'nosotros', 'Sobre la agencia', 'etiqueta', 'Agencia de viajes'),
  def('producto', 'nosotros', 'Sobre la agencia', 'titulo', 'Travel World Colombia'),
  def('producto', 'nosotros', 'Sobre la agencia', 'subtitulo', 'Más de 14 años cumpliendo sueños'),
]

export const ORIGINALES: Record<string, string> = Object.fromEntries(
  CATALOGO_TEXTOS.map(t => [t.clave, t.original])
)

/**
 * Claves de producto que un viaje puede sobreescribir desde su ficha. Se
 * excluyen las que ya tienen un campo propio en el viaje (subtítulo y CTA).
 */
export const CLAVES_PRODUCTO_PERSONALIZABLES = CATALOGO_TEXTOS.filter(
  t => t.pagina === 'producto' && !['producto.sobre.titulo', 'producto.cta.titulo', 'producto.cta.subtitulo'].includes(t.clave)
)

/** clave → valor efectivo de la plantilla global (originales + cambios de la tabla). */
export type Textos = Record<string, string>

/**
 * Plantilla global: originales del código con los cambios guardados encima.
 * Cliente público (anon): la tabla tiene lectura pública y así las páginas
 * siguen siendo estáticas (ISR). Si la lectura falla, se sirven los originales.
 */
export const getTextosSitio = cache(async function getTextosSitio(): Promise<Textos> {
  const textos: Textos = { ...ORIGINALES }
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.from('textos_sitio').select('clave, valor')
    if (error) {
      console.error('getTextosSitio error:', error.message)
      return textos
    }
    for (const fila of data ?? []) {
      if (fila.clave in ORIGINALES && typeof fila.valor === 'string') textos[fila.clave] = fila.valor
    }
  } catch (err) {
    console.error('getTextosSitio excepción:', (err as Error).message)
  }
  return textos
})

/** Reemplaza `{clave}` por su valor; las claves desconocidas se dejan tal cual. */
export function aplicarVariables(texto: string, vars: Record<string, string | number | undefined>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] === undefined ? m : String(vars[k])))
}

const VARS_AGENCIA = { familias: SITE.familias, resenas: SITE.reseñas }

/** Texto de la página principal, con las cifras de la agencia resueltas. */
export function textoInicio(textos: Textos, clave: string): string {
  return aplicarVariables(textos[clave] ?? ORIGINALES[clave] ?? '', VARS_AGENCIA)
}

/**
 * Texto de la página de producto: lo que el viaje personalizó, si no la
 * plantilla global, si no el original; con `{nombre}` resuelto.
 */
export function textoProducto(
  textos: Textos,
  d: Pick<Destino, 'nombre' | 'textos'>,
  clave: string
): string {
  const propio = d.textos?.[clave]?.trim()
  const valor = propio || textos[clave] || ORIGINALES[clave] || ''
  return aplicarVariables(valor, { ...VARS_AGENCIA, nombre: d.nombre })
}
