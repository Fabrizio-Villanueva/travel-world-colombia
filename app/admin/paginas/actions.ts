'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'
import { MAX_CONTENIDO, MAX_INTRO, PAGINAS_INFO } from '@/lib/paginas-info'

export type PaginaState = { error?: string; ok?: boolean; publicada?: boolean }

/** Guarda el texto de una página del pie de página (y si está publicada). */
export async function guardarPagina(_prev: PaginaState, formData: FormData): Promise<PaginaState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }

  const slug = String(formData.get('slug') ?? '')
  const def = PAGINAS_INFO.find(p => p.slug === slug)
  if (!def) return { error: 'Página desconocida.' }

  const limpiar = (v: FormDataEntryValue | null) => String(v ?? '').replace(/\r\n/g, '\n').trim()
  const intro = limpiar(formData.get('intro'))
  const contenido = limpiar(formData.get('contenido'))
  const publicada = formData.get('publicada') === 'on'
  if (intro.length > MAX_INTRO) return { error: `La introducción supera los ${MAX_INTRO} caracteres.` }
  if (contenido.length > MAX_CONTENIDO) return { error: `El texto supera los ${MAX_CONTENIDO.toLocaleString('es-CO')} caracteres.` }
  if (publicada && !contenido) return { error: 'Escribe el texto antes de publicar la página.' }

  const { error } = await createAdminClient().from('paginas_info').upsert({
    slug,
    intro,
    contenido,
    publicada,
    actualizado_en: new Date().toISOString(),
    actualizado_por: user.email ?? '',
  })
  if (error) return { error: error.message }

  await registrarActividad({
    email: user.email!,
    accion: 'actualizar',
    nombre: `Pie de página · ${def.titulo}`,
    detalle: { slug, publicada },
  })

  // El pie de página está en todas las páginas del sitio.
  revalidatePath('/', 'layout')
  return { ok: true, publicada }
}
