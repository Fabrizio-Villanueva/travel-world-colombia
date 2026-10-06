'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminRole } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { ESCENARIOS_BASE } from '@/lib/agente/v2/escenarios'
import { correrEscenario, crearCorrida, enviarMensajeChat } from '@/lib/agente/v2/laboratorio'

/** Laboratorio de Sol: SOLO administradores. Nada de esto sale por WhatsApp. */

export type LabState = { error?: string; ok?: string; corridaId?: string }

async function admin(): Promise<{ email: string } | { error: string }> {
  try {
    const { user } = await requireAdminRole()
    return { email: user.email ?? '' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function cargarEscenariosBase(): Promise<LabState> {
  const s = await admin()
  if ('error' in s) return s
  const db = createAdminClient()
  const { data } = await db.from('sol_lab_escenarios').select('nombre')
  const existentes = new Set((data ?? []).map(e => e.nombre as string))
  const nuevos = ESCENARIOS_BASE.filter(e => !existentes.has(e.nombre)).map((e, i) => ({ ...e, orden: existentes.size + i }))
  if (nuevos.length) {
    const { error } = await db.from('sol_lab_escenarios').insert(nuevos)
    if (error) return { error: error.message }
  }
  revalidatePath('/admin/sol/laboratorio')
  return { ok: `${nuevos.length} escenarios cargados.` }
}

export async function nuevoChat(): Promise<LabState> {
  const s = await admin()
  if ('error' in s) return s
  try {
    const corridaId = await crearCorrida('chat', `Chat de prueba · ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`, s.email)
    revalidatePath('/admin/sol/laboratorio')
    return { corridaId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function enviarChat(corridaId: string, texto: string): Promise<LabState> {
  const s = await admin()
  if ('error' in s) return s
  if (!texto.trim()) return { error: 'Escribe un mensaje.' }
  try {
    await enviarMensajeChat(corridaId, texto.trim())
  } catch (e) {
    return { error: (e as Error).message }
  }
  revalidatePath(`/admin/sol/laboratorio/${corridaId}`)
  return { ok: 'ok' }
}

export async function correrEscenarioAccion(escenarioId: string): Promise<LabState> {
  const s = await admin()
  if ('error' in s) return s
  try {
    const corridaId = await correrEscenario(escenarioId, s.email)
    revalidatePath('/admin/sol/laboratorio')
    return { corridaId }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function votar(corridaId: string, turno: number, voto: 1 | -1, comentario: string): Promise<LabState> {
  const s = await admin()
  if ('error' in s) return s
  const { error } = await createAdminClient()
    .from('sol_lab_valoraciones')
    .upsert(
      { corrida_id: corridaId, turno, voto, comentario: comentario.trim() || null, por: s.email, en: new Date().toISOString() },
      { onConflict: 'corrida_id,turno,por' }
    )
  if (error) return { error: error.message }
  revalidatePath(`/admin/sol/laboratorio/${corridaId}`)
  return { ok: 'Guardado' }
}
