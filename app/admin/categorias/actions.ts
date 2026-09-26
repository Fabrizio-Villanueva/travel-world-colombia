'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor, requireAdminRole } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'
import { slugCategoria } from '@/lib/categorias'

export type CategoriaState = { error?: string; ok?: boolean }

/**
 * Las categorías se ven en todo el sitio (etiquetas de las tarjetas, filtro de
 * /destinos, menú y /cruceros vía es_crucero), así que se revalida el layout
 * completo en vez de ir página por página.
 */
function revalidar() {
  revalidatePath('/', 'layout')
}

/** Mensajes legibles para los errores que lanza la base (triggers / unique). */
function mensaje(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ya existe una categoría con ese nombre.'
  return error.message
}

/** Crea una categoría principal o, con `parent_id`, una subcategoría. */
export async function crearCategoria(_prev: CategoriaState, formData: FormData): Promise<CategoriaState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }

  const nombre = String(formData.get('nombre') ?? '').trim()
  const parentId = String(formData.get('parent_id') ?? '').trim() || null
  if (!nombre) return { error: 'Escribe el nombre de la categoría.' }
  if (nombre.length > 40) return { error: 'Máximo 40 caracteres.' }

  const admin = createAdminClient()

  // El slug de una subcategoría lleva el de su madre: "Con visa" puede existir
  // bajo Cruceros y bajo otra categoría sin chocar.
  let slug = slugCategoria(nombre)
  if (!slug) return { error: 'El nombre necesita al menos una letra o número.' }
  if (parentId) {
    const { data: madre } = await admin.from('categorias').select('slug').eq('id', parentId).maybeSingle()
    if (!madre) return { error: 'La categoría principal ya no existe. Recarga la página.' }
    slug = `${madre.slug}-${slug}`
  }

  // Al final de sus hermanas.
  let q = admin.from('categorias').select('orden').order('orden', { ascending: false }).limit(1)
  q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null)
  const { data: ultima } = await q.maybeSingle()
  const orden = (ultima?.orden ?? 0) + 1

  const { error } = await admin.from('categorias').insert({ nombre, slug, parent_id: parentId, orden })
  if (error) return { error: mensaje(error) }

  await registrarActividad({ email: user.email!, accion: 'crear', nombre: `Categoría: ${nombre}` })
  revalidar()
  return { ok: true }
}

/**
 * Renombra una categoría. El slug NO cambia a propósito: los enlaces
 * compartidos del filtro (?f=cat:slug) siguen funcionando.
 */
export async function renombrarCategoria(id: string, nombre: string): Promise<CategoriaState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }
  const limpio = nombre.trim()
  if (!limpio) return { error: 'El nombre no puede quedar vacío.' }
  if (limpio.length > 40) return { error: 'Máximo 40 caracteres.' }

  const admin = createAdminClient()
  const { error } = await admin.from('categorias').update({ nombre: limpio }).eq('id', id)
  if (error) return { error: mensaje(error) }

  await registrarActividad({ email: user.email!, accion: 'actualizar', nombre: `Categoría: ${limpio}` })
  revalidar()
  return { ok: true }
}

/** Sube o baja una categoría entre sus hermanas (intercambia el orden). */
export async function moverCategoria(id: string, direccion: 'arriba' | 'abajo'): Promise<CategoriaState> {
  try {
    await requireEditor()
  } catch (e) {
    return { error: (e as Error).message }
  }
  const admin = createAdminClient()
  const { data: actual } = await admin.from('categorias').select('id, parent_id, orden').eq('id', id).maybeSingle()
  if (!actual) return { error: 'La categoría ya no existe.' }

  let q = admin.from('categorias').select('id, orden, nombre')
  q = actual.parent_id ? q.eq('parent_id', actual.parent_id) : q.is('parent_id', null)
  const { data: hermanas } = await q.order('orden').order('nombre')
  const lista = hermanas ?? []
  const i = lista.findIndex(h => h.id === id)
  const j = direccion === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true }

  // Se renumeran todas las hermanas: si había órdenes repetidos (0,0,0) un
  // simple intercambio no movería nada.
  const nuevo = [...lista]
  ;[nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]]
  for (const [k, h] of nuevo.entries()) {
    if (h.orden !== k + 1) {
      const { error } = await admin.from('categorias').update({ orden: k + 1 }).eq('id', h.id)
      if (error) return { error: mensaje(error) }
    }
  }
  revalidar()
  return { ok: true }
}

/**
 * Elimina una categoría (y sus subcategorías). La base la quita sola de los
 * viajes y protege las categorías del sistema (Cruceros).
 */
export async function eliminarCategoria(id: string, nombre: string): Promise<CategoriaState> {
  let user
  try {
    ;({ user } = await requireAdminRole())
  } catch (e) {
    return { error: (e as Error).message }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('categorias').delete().eq('id', id)
  if (error) return { error: mensaje(error) }

  await registrarActividad({ email: user.email!, accion: 'eliminar', nombre: `Categoría: ${nombre}` })
  revalidar()
  return { ok: true }
}
