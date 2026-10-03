'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/admin/guard'
import { registrarActividad } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Reglas de visa por país (tabla doc_reglas_visa). Alimentan la sugerencia de
 * requisitos del Generador; la asesora siempre confirma. Solo admin/editor.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

function limpiarPais(v: unknown): string {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

export async function guardarReglaVisa(
  pais: string,
  requiereVisa: boolean,
  nota: string,
  paisAnterior?: string
): Promise<Resultado> {
  try {
    const { user } = await requireEditor()
    const nombre = limpiarPais(pais)
    if (!nombre) return { ok: false, error: 'Escribe el nombre del país.' }
    const admin = createAdminClient()
    const fila = {
      pais: nombre,
      requiere_visa: Boolean(requiereVisa),
      nota: String(nota ?? '').trim().slice(0, 300) || null,
      actualizado_por: user.email,
      actualizado_en: new Date().toISOString(),
    }
    if (paisAnterior && paisAnterior !== nombre) {
      // Renombrar: se reemplaza la fila (la clave es el nombre).
      await admin.from('doc_reglas_visa').delete().eq('pais', paisAnterior)
    }
    const { error } = await admin.from('doc_reglas_visa').upsert(fila, { onConflict: 'pais' })
    if (error) return { ok: false, error: error.message }
    await registrarActividad({
      email: user.email!,
      accion: 'editar-regla-visa',
      nombre,
      detalle: { requiere_visa: fila.requiere_visa, nota: fila.nota },
    })
    revalidatePath('/admin/documentos/visas')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function eliminarReglaVisa(pais: string): Promise<Resultado> {
  try {
    const { user } = await requireEditor()
    const { error } = await createAdminClient().from('doc_reglas_visa').delete().eq('pais', pais)
    if (error) return { ok: false, error: error.message }
    await registrarActividad({ email: user.email!, accion: 'editar-regla-visa', nombre: pais, detalle: { eliminada: true } })
    revalidatePath('/admin/documentos/visas')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
