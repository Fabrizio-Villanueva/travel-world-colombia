'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'
import { revincularAnuncio } from '@/lib/agente/anuncios'

export type AnuncioState = { error?: string; ok?: boolean }

/**
 * Fija a mano los programas del catálogo a los que corresponde un anuncio. A
 * partir de ahí el vínculo no se re-evalúa solo (queda 'manual').
 */
export async function guardarVinculoManual(adId: string, nombre: string, slugs: string[]): Promise<AnuncioState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()
  const { data: validos } = await admin.from('destinos').select('slug').in('slug', slugs)
  const limpios = (validos ?? []).map(d => d.slug as string)

  const { error } = await admin
    .from('agente_anuncios')
    .update({
      slugs: limpios,
      vinculo: 'manual',
      vinculo_motivo: `fijado desde el panel por ${user.email}`,
    })
    .eq('ad_id', adId)
  if (error) return { error: error.message }

  await registrarActividad({
    email: user.email!,
    accion: 'actualizar',
    nombre: `Anuncio: ${nombre}`,
    detalle: { ad_id: adId, slugs: limpios },
  })
  revalidatePath('/admin/anuncios')
  return { ok: true }
}

/** Vuelve a dejar el vínculo en manos del modelo (lo re-evalúa ahora mismo). */
export async function revincularAutomatico(adId: string, nombre: string): Promise<AnuncioState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }

  try {
    const r = await revincularAnuncio(adId)
    if (!r) return { error: 'El anuncio ya no existe.' }
  } catch (e) {
    return { error: `No se pudo vincular automáticamente: ${(e as Error).message}` }
  }

  await registrarActividad({
    email: user.email!,
    accion: 'actualizar',
    nombre: `Anuncio: ${nombre}`,
    detalle: { ad_id: adId, vinculo: 'auto' },
  })
  revalidatePath('/admin/anuncios')
  return { ok: true }
}
