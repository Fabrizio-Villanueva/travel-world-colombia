import Image, { type ImageProps } from 'next/image'
import { esStorage } from '@/lib/hero'

/**
 * `next/image` para las fotos que sube el equipo desde el panel.
 *
 * Contexto (2026-09-15): el proyecto corre en plan Hobby de Vercel, que solo
 * incluye 5.000 transformaciones de imagen al mes. Al agotarse, `/_next/image`
 * responde 402 y las fotos NUEVAS no se ven en el sitio (las ya cacheadas sí).
 * Cada foto nueva generaba hasta 8 anchos × 2 formatos, así que la cuota se
 * iba rápido.
 *
 * Regla: las fotos de Storage que ya vienen comprimidas por el panel (WebP,
 * ≤1920 px, ~150-400 KB; ver `comprimirImagen` en
 * `lib/supabase/upload-cliente.ts`) se sirven TAL CUAL (`unoptimized`), sin
 * gastar transformaciones. Las fotos viejas (PNG/JPG de 2-5 MB) siguen pasando
 * por el optimizador: servirlas en crudo pesaría demasiado.
 *
 * Las imágenes locales (logos, placeholders) se optimizan normal. Si el
 * proyecto pasa a plan Pro, se puede volver a `next/image` directo.
 */
function sirveTalCual(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return false
  return esStorage(src) && /\.webp(\?.*)?$/i.test(src)
}

export default function Foto({ alt, unoptimized, ...props }: ImageProps) {
  return <Image {...props} alt={alt} unoptimized={unoptimized ?? sirveTalCual(props.src)} />
}
