import { createClient } from '@/lib/supabase/client'

/**
 * Sube archivos directo del navegador a Supabase Storage, usando la sesión
 * autenticada del admin (las políticas RLS del bucket permiten insert a
 * `authenticated`).
 *
 * ¿Por qué del cliente y no por un Server Action? Porque los Server Actions
 * pasan por una función de Vercel, que corta el body en ~4.5 MB, y Next lo
 * limita a 1 MB por defecto. Subiendo directo a Supabase evitamos ambos topes.
 */

/** Bucket de imágenes de destinos y su tope por archivo (definido en Supabase). */
export const BUCKET_DESTINOS = 'destinos'
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024 // 5 MB (coincide con file_size_limit del bucket)

/** Valida tamaño/tipo de una imagen antes de subir. Devuelve un error legible o null. */
export function validarImagen(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'El archivo debe ser una imagen (JPG, PNG o WebP).'
  if (file.size > MAX_IMAGEN_BYTES) return 'La imagen supera 5 MB. Comprímela o elige una más liviana.'
  return null
}

/** Bucket de documentos (PDF/Word) de los viajes y su tope por archivo. */
export const BUCKET_DOCUMENTOS = 'documentos'
export const MAX_DOCUMENTO_BYTES = 20 * 1024 * 1024 // 20 MB (coincide con file_size_limit del bucket)

/** 'pdf' | 'word' según el archivo, o null si no es un tipo permitido. */
export function tipoDeDocumento(file: File): 'pdf' | 'word' | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'doc' || ext === 'docx'
  ) return 'word'
  return null
}

/** Valida tamaño/tipo de un documento antes de subir. Devuelve un error legible o null. */
export function validarDocumento(file: File): string | null {
  if (!tipoDeDocumento(file)) return 'El archivo debe ser un PDF o un Word (.pdf, .doc, .docx).'
  if (file.size > MAX_DOCUMENTO_BYTES) return 'El documento supera 20 MB. Comprímelo o divídelo en partes.'
  return null
}

/**
 * Comprime una imagen en el navegador antes de subirla: la reduce a un lado
 * máximo de `maxLado` px y la re-codifica en WebP.
 *
 * ¿Por qué? Las fotos de Storage se sirven tal cual en el sitio (sin el
 * optimizador de Vercel, ver `components/ui/Foto.tsx`), así que el peso del
 * original es el peso que descarga el visitante. Un PNG de 3 MB subido "a
 * pelo" queda en ~150-300 KB. Si algo falla (formato raro, navegador viejo)
 * o el resultado no es más liviano, se sube el archivo original.
 */
export const IMAGEN_LADO_MAX = 1920
export const IMAGEN_CALIDAD = 0.82

export async function comprimirImagen(file: File, maxLado = IMAGEN_LADO_MAX, calidad = IMAGEN_CALIDAD): Promise<File> {
  // GIF (animado) y SVG no se re-codifican.
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * escala))
    const h = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', calidad))
    // Si el navegador no sabe WebP (devuelve PNG) o no ganamos peso, original.
    if (!blob || blob.type !== 'image/webp' || (escala === 1 && blob.size >= file.size)) return file
    const nombre = file.name.replace(/.[^.]+$/, '') + '.webp'
    return new File([blob], nombre, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  }
}

/**
 * Sube un archivo al bucket indicado y devuelve su URL pública.
 * `slug` y `campo` solo arman una ruta legible dentro del bucket.
 */
export async function subirAStorage(
  bucket: string,
  slug: string,
  campo: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  // Las imágenes de destinos se comprimen en el navegador (ver comprimirImagen).
  if (bucket === BUCKET_DESTINOS) file = await comprimirImagen(file)
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${slug || 'sin-slug'}/${campo}-${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw new Error(error.message)

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Lee el slug actual del formulario (para agrupar las subidas por destino). */
export function slugDelFormulario(fallback = 'galeria'): string {
  const el = document.querySelector('input[name="slug"]') as HTMLInputElement | null
  return el?.value?.trim() || fallback
}
