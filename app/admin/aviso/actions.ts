'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'
import { parsearNumeros } from '@/lib/aviso-seguridad-numeros'

export type AvisoState = { error?: string; ok?: boolean }

/** Guarda la franja antisuplantación (fila única de `aviso_seguridad`). */
export async function guardarAviso(_prev: AvisoState, formData: FormData): Promise<AvisoState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }

  const activo = formData.get('activo') === 'on'
  const popup = formData.get('popup') === 'on'
  const mensaje = String(formData.get('mensaje') ?? '').replace(/\s+/g, ' ').trim()
  const numeros = parsearNumeros(String(formData.get('numeros') ?? ''))
  if (!mensaje) return { error: 'Escribe el mensaje de la franja.' }
  if (mensaje.length > 220) return { error: 'El mensaje supera los 220 caracteres: en celular quedaría muy largo.' }
  if (numeros.length === 0) return { error: 'Escribe al menos un número oficial (con indicativo, p. ej. +57 320 489 1930).' }

  const { error } = await createAdminClient().from('aviso_seguridad').upsert({
    id: 1,
    activo,
    popup_activo: popup,
    mensaje,
    numeros: numeros.join(','),
    actualizado_en: new Date().toISOString(),
    actualizado_por: user.email ?? '',
  })
  if (error) return { error: error.message }

  await registrarActividad({ email: user.email!, accion: 'actualizar', nombre: 'Aviso de seguridad', detalle: { activo, popup, numeros } })
  // La franja está en todas las páginas del sitio.
  revalidatePath('/', 'layout')
  return { ok: true }
}
