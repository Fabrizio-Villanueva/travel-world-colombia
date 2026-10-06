'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminRole } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'

export type ABState = { error?: string; ok?: string }

/** Porcentaje de leads nuevos a Sol v2 y el botón de regreso. SOLO admin. */
export async function guardarAB(_prev: ABState, fd: FormData): Promise<ABState> {
  let email: string
  try {
    email = (await requireAdminRole()).user.email ?? ''
  } catch (e) {
    return { error: (e as Error).message }
  }
  const porcentaje = Number(fd.get('porcentaje'))
  if (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100) return { error: 'El porcentaje va de 0 a 100.' }
  const activa = fd.get('activa') === 'on'

  const { error } = await createAdminClient()
    .from('sol_ab_config')
    .upsert({ id: 1, porcentaje, activa, actualizado_en: new Date().toISOString(), actualizado_por: email })
  if (error) return { error: error.message }
  await registrarActividad({ email, accion: 'actualizar', nombre: 'Sol: prueba A/B', detalle: { porcentaje, activa } })
  revalidatePath('/admin/sol/ab')
  return { ok: activa ? `Listo: ${porcentaje} % de los leads nuevos van a Sol v2.` : 'Sol v2 APAGADA: todos vuelven a la Sol actual desde el próximo mensaje.' }
}
