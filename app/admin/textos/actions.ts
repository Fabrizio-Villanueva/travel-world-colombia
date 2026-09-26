'use server'

import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'
import { CATALOGO_TEXTOS, MAX_TEXTO } from '@/lib/textos'

export type TextosState = { error?: string; ok?: boolean; cambios?: number }

/**
 * Guarda la plantilla global de textos. Solo se persisten los que difieren del
 * original; un texto igual al original (o vacío, salvo los que son vacíos de
 * origen) borra su fila, que es lo mismo que "Restaurar".
 *
 * Los textos se ven en la home y en TODAS las páginas de producto: se
 * revalida el layout completo para que el cambio sea inmediato.
 */
export async function guardarTextos(_prev: TextosState, formData: FormData): Promise<TextosState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()
  const ahora = new Date().toISOString()
  const upserts: { clave: string; valor: string; actualizado_en: string; actualizado_por: string }[] = []
  const restaurar: string[] = []
  const cambiados: string[] = []

  for (const t of CATALOGO_TEXTOS) {
    const crudo = formData.get(t.clave)
    if (typeof crudo !== 'string') continue
    // Se conservan los saltos de línea (los títulos los usan); se recortan extremos.
    const valor = crudo.replace(/\r\n/g, '\n').trim()
    if (valor.length > MAX_TEXTO[t.tipo]) {
      return { error: `"${t.seccion} · ${t.tipo}" supera los ${MAX_TEXTO[t.tipo]} caracteres.` }
    }
    if (valor === '' || valor === t.original) {
      restaurar.push(t.clave)
    } else {
      upserts.push({ clave: t.clave, valor, actualizado_en: ahora, actualizado_por: user.email ?? '' })
    }
  }

  // Qué cambió de verdad (para la bitácora): comparar contra lo guardado.
  const { data: previos } = await admin.from('textos_sitio').select('clave, valor')
  const antes = new Map((previos ?? []).map(p => [p.clave as string, p.valor as string]))
  for (const u of upserts) if (antes.get(u.clave) !== u.valor) cambiados.push(u.clave)
  for (const c of restaurar) if (antes.has(c)) cambiados.push(c)

  if (upserts.length) {
    const { error } = await admin.from('textos_sitio').upsert(upserts)
    if (error) return { error: error.message }
  }
  if (restaurar.length) {
    const { error } = await admin.from('textos_sitio').delete().in('clave', restaurar)
    if (error) return { error: error.message }
  }

  if (cambiados.length) {
    await registrarActividad({
      email: user.email!,
      accion: 'actualizar',
      nombre: 'Textos del sitio',
      detalle: { claves: cambiados },
    })
  }

  revalidatePath('/', 'layout')
  return { ok: true, cambios: cambiados.length }
}
