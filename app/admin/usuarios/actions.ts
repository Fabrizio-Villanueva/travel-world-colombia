'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminRole, requireEditor } from '@/lib/admin/guard'
import { isSuperadmin, type Role, ROLES } from '@/lib/admin/allowlist'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { registrarActividad } from '@/lib/admin/audit'
import { SITE } from '@/lib/site'

export type InviteState = { error?: string; ok?: string }

/**
 * Invita a un correo al panel: crea la cuenta en Supabase Auth (envía el correo
 * de invitación nativo) y la deja aprobada en la allowlist con el rol elegido.
 * Es la única vía de alta cuando "Enable Sign ups" está apagado en Supabase.
 */
export async function invitarUsuario(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { user } = await requireAdminRole()
  const e = String(formData.get('email') ?? '').trim().toLowerCase()
  const rol = String(formData.get('rol') ?? 'editor') as Role
  const nombre = String(formData.get('nombre') ?? '').trim() || null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'Ingresa un correo válido.' }
  if (!ROLES.includes(rol)) return { error: 'Rol inválido.' }
  if (isSuperadmin(e)) return { error: 'Ese correo ya es superadmin (ADMIN_EMAILS).' }

  const admin = createAdminClient()

  // El enlace del correo pasa por /auth/confirm y aterriza en el formulario de
  // contraseña (misma ruta que usa el flujo de "olvidé mi contraseña").
  const { error } = await admin.auth.admin.inviteUserByEmail(e, {
    redirectTo: `${SITE.url}/auth/confirm?next=/admin/actualizar-password`,
  })
  let yaTeniaCuenta = false
  if (error) {
    if (!/already.*(registered|exists|been invited)/i.test(error.message)) {
      return { error: `No se pudo enviar la invitación: ${error.message}` }
    }
    // Ya tiene cuenta (p. ej. abrió una invitación vieja pero nunca creó la
    // contraseña): Supabase no reenvía invitaciones, así que "reinvitar" no
    // mandaba ningún correo. Le mandamos el enlace de restablecer contraseña,
    // que sí llega y pasa por /auth/confirm.
    const { error: errReset } = await (await createClient()).auth.resetPasswordForEmail(e, {
      redirectTo: `${SITE.url}/auth/confirm?next=/admin/actualizar-password`,
    })
    if (errReset) {
      return { error: `Ese correo ya tiene cuenta y no se pudo enviar el enlace para crear contraseña: ${errReset.message}` }
    }
    yaTeniaCuenta = true
  }

  // Aprobado de una vez: al aceptar la invitación entra directo con su rol.
  const { error: errAllow } = await admin
    .from('admin_allowlist')
    // Sin nombre escrito no pisamos el que ya tuviera (reinvitación).
    .upsert({ email: e, rol, ...(nombre ? { nombre } : {}), aprobado_por: user.email }, { onConflict: 'email' })
  if (errAllow) return { error: `Invitación enviada, pero falló la aprobación: ${errAllow.message}` }

  await registrarActividad({ email: user.email!, accion: 'invitar-usuario', nombre: `${e} → ${rol}` })
  revalidatePath('/admin/usuarios')
  if (yaTeniaCuenta) {
    return { ok: `${e} ya tenía cuenta: le enviamos un enlace para crear una contraseña nueva (rol ${rol}). Sirve una sola vez.` }
  }
  return { ok: `Invitación enviada a ${e} (rol ${rol}). Debe abrir el correo y crear su contraseña.` }
}

/** Aprueba un correo manualmente (rol editor por defecto). Solo admin. */
export async function aprobarUsuario(email: string): Promise<void> {
  const { user } = await requireAdminRole()
  const e = email.trim().toLowerCase()
  if (!e) throw new Error('Correo vacío.')

  const admin = createAdminClient()
  const { error } = await admin
    .from('admin_allowlist')
    .upsert({ email: e, rol: 'editor', aprobado_por: user.email }, { onConflict: 'email' })
  if (error) throw new Error(error.message)

  await registrarActividad({ email: user.email!, accion: 'aprobar-usuario', nombre: e })
  revalidatePath('/admin/usuarios')
}

/** Cambia el nombre visible de un usuario aprobado (admin o editor). */
export async function cambiarNombre(email: string, nombre: string): Promise<void> {
  const { user } = await requireEditor()
  const e = email.trim().toLowerCase()
  const n = nombre.trim()
  if (!e) throw new Error('Correo vacío.')
  if (n.length > 80) throw new Error('El nombre es demasiado largo.')

  const admin = createAdminClient()
  const { error } = await admin.from('admin_allowlist').update({ nombre: n || null }).eq('email', e)
  if (error) throw new Error(error.message)

  await registrarActividad({ email: user.email!, accion: 'cambiar-nombre-usuario', nombre: `${e} → ${n || '(vacío)'}` })
  revalidatePath('/admin/usuarios')
}

/** Cambia el rol de un usuario. Solo admin: gestionar accesos no es de editores. */
export async function cambiarRol(email: string, rol: Role): Promise<void> {
  const { user } = await requireAdminRole()
  const e = email.trim().toLowerCase()
  if (!ROLES.includes(rol)) throw new Error('Rol inválido.')
  if (isSuperadmin(e)) throw new Error('No puedes cambiar el rol de un superadmin.')
  if (e === (user.email ?? '').toLowerCase()) throw new Error('No puedes cambiar tu propio rol.')

  const admin = createAdminClient()
  const { error } = await admin.from('admin_allowlist').update({ rol }).eq('email', e)
  if (error) throw new Error(error.message)

  await registrarActividad({ email: user.email!, accion: 'cambiar-rol', nombre: `${e} → ${rol}` })
  revalidatePath('/admin/usuarios')
}

/** Revoca el acceso de un correo (solo admin; es una eliminación). */
export async function revocarUsuario(email: string): Promise<void> {
  const { user } = await requireAdminRole()
  const e = email.trim().toLowerCase()
  if (isSuperadmin(e)) throw new Error('No puedes revocar a un superadmin (definido en ADMIN_EMAILS).')

  const admin = createAdminClient()
  const { error } = await admin.from('admin_allowlist').delete().eq('email', e)
  if (error) throw new Error(error.message)

  await registrarActividad({ email: user.email!, accion: 'revocar-usuario', nombre: e })
  revalidatePath('/admin/usuarios')
}
