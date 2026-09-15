import type { Destino } from '@/types/destino'

/**
 * ¿La URL es una imagen subida a Supabase Storage (vs. placeholder externo
 * como Unsplash)? Si el viaje ya tiene su foto propia en Storage (subida
 * desde el panel) se usa; si no, placeholder de marca.
 */
export function esStorage(url?: string): boolean {
  return !!url && url.includes('/storage/v1/object/public/')
}

/**
 * Placeholder de marca para destinos sin foto. Vive en /public/images (que SÍ
 * se versiona) — el fallback anterior a /img/{slug}/hero.webp apuntaba a una
 * carpeta excluida por .gitignore y daba 404 en producción.
 */
export const PLACEHOLDER_DESTINO = '/images/placeholder-destino.webp'
export const PLACEHOLDER_DESTINO_THUMB = '/images/placeholder-destino-thumb.webp'

/** Imagen de fondo del hero. Storage-first → placeholder de marca. */
export function heroBg(destino: Pick<Destino, 'slug' | 'imagen_hero'>): string {
  return esStorage(destino.imagen_hero) ? destino.imagen_hero! : PLACEHOLDER_DESTINO
}

/** Thumbnail circular del coverflow. Storage-first → placeholder de marca. */
export function heroThumb(destino: Pick<Destino, 'slug' | 'imagen_thumb'>): string {
  return esStorage(destino.imagen_thumb) ? destino.imagen_thumb! : PLACEHOLDER_DESTINO_THUMB
}

/**
 * Imagen de la tarjeta de destino (grid del home y /destinos), sincronizada
 * con el hero. Storage-first → placeholder de marca.
 */
export function destinoCardImg(destino: Pick<Destino, 'slug' | 'imagen_hero'>): string {
  return esStorage(destino.imagen_hero) ? destino.imagen_hero! : PLACEHOLDER_DESTINO
}

/** Color RGB del glow del hero según la región del destino. */
export function glowColor(region?: string): string {
  switch (region) {
    case 'Caribe':        return '255, 204, 41'   // amarillo de marca
    case 'Europa':        return '70, 130, 220'   // azul
    case 'Asia':          return '230, 168, 23'   // dorado
    case 'Norteamérica':  return '90, 150, 235'   // azul claro
    case 'Centroamérica': return '32, 200, 180'   // turquesa
    case 'Suramérica':    return '60, 200, 120'   // verde
    default:              return '255, 204, 41'   // amarillo (marca)
  }
}

/** Iniciales para el avatar del autor de la frase. */
export function initials(nombre?: string): string {
  if (!nombre) return 'TW'
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}
