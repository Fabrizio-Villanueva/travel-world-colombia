import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRole, type Role } from '@/lib/admin/allowlist'
import type { User } from '@supabase/supabase-js'

export interface AdminSession { user: User; rol: Role }

/**
 * Sesión admin: usuario autenticado + su rol, o null si no hay sesión o no
 * está aprobado. Revalida el JWT (getUser) y consulta la allowlist (env o
 * tabla). Defensa en profundidad además del gate del proxy.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const rol = await getRole(user.email)
  if (!rol) return null
  return { user, rol }
}

/** Solo el usuario (compat). null si no aprobado. */
export async function getAdminUser(): Promise<User | null> {
  return (await getAdminSession())?.user ?? null
}

/** Cualquier rol aprobado (para lectura). Lanza si no está autorizado. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new Error('No autorizado')
  return session
}

/** admin o editor (puede modificar). Lanza si es lector/representante o no aprobado. */
export async function requireEditor(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (session.rol !== 'admin' && session.rol !== 'editor') {
    throw new Error(`Tu rol (${session.rol}) no permite modificar.`)
  }
  return session
}

/**
 * Acceso a la sección Reservas: admin, editor o representante (el rol que
 * existe justamente para esto). El lector queda fuera: la sección escribe en
 * el CRM y no tiene modo de solo-lectura.
 */
export async function requireReservas(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (session.rol === 'lector') {
    throw new Error('Tu rol (lector) no permite gestionar reservas.')
  }
  return session
}

/** Solo admin (eliminar, revocar, otorgar admin). Lanza en cualquier otro caso. */
export async function requireAdminRole(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (session.rol !== 'admin') throw new Error('Solo un administrador puede hacer esto.')
  return session
}

/**
 * Guard de PÁGINA del panel (auditoría 2026-10-08). Antes, las páginas de solo
 * lectura dependían únicamente del proxy para la regla "representante solo ve
 * Reservas"; ahora cada página la impone también en servidor (defensa en
 * profundidad, igual que las actions).
 *
 * - Sin sesión aprobada → /admin/login.
 * - `representante` fuera de Reservas → /admin/reservas (salvo que `roles` lo incluya).
 * - Si se pasan `roles` y el rol no está → /admin (p. ej. Usuarios y Actividad: solo admin).
 */
export async function requirePagina(opts: { roles?: Role[] } = {}): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const permitidos = opts.roles
  if (session.rol === 'representante' && !permitidos?.includes('representante')) redirect('/admin/reservas')
  if (permitidos && !permitidos.includes(session.rol)) redirect('/admin')
  return session
}
