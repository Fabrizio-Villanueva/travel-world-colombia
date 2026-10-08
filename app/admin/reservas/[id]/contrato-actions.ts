'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminRole, requireReservas } from '@/lib/admin/guard'
import { registrarActividad } from '@/lib/admin/audit'
import { contratoDesdeGhl } from '@/lib/contratos/desde-ghl'
import {
  anularContrato,
  contratoDeOportunidad,
  crearYEnviarContrato,
  estadoEnlaceContrato,
  problemasParaEnviar,
  reenviarAvisoContrato,
} from '@/lib/contratos/registro'

/**
 * Acciones del recuadro "Contrato" del Generador de Contratos. Los errores
 * vuelven como dato (Next enmascara los `throw` en producción).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string }

export interface EstadoContratoPanel {
  /** Lo que falta en la oportunidad para poder enviar (vacío = listo). */
  problemas: string[]
  ultimo: null | {
    id: string
    estado: 'enviado' | 'visto' | 'firmado' | 'anulado' | 'vencido'
    creadoEn: string
    creadoPor: string
    vistoEn: string | null
    firmadoEn: string | null
    firmante: string | null
    pdfSha256: string | null
  }
}

function fallo<T>(e: unknown): Resultado<T> {
  return { ok: false, error: e instanceof Error ? e.message : 'Algo salió mal. Intenta de nuevo.' }
}

export async function estadoContrato(opportunityId: string): Promise<EstadoContratoPanel> {
  await requireReservas()
  const [c, datos] = await Promise.all([
    contratoDeOportunidad(opportunityId),
    contratoDesdeGhl(opportunityId).catch(() => null),
  ])
  const problemas = datos ? problemasParaEnviar(datos) : ['No se pudo leer la oportunidad en GHL.']
  if (!c) return { problemas, ultimo: null }
  const enlace = estadoEnlaceContrato(c)
  return {
    problemas,
    ultimo: {
      id: c.id,
      estado:
        c.estado === 'firmado' ? 'firmado' : c.estado === 'anulado' ? 'anulado' : enlace === 'vencido' ? 'vencido' : c.visto_en ? 'visto' : 'enviado',
      creadoEn: c.creado_en,
      creadoPor: c.creado_por,
      vistoEn: c.visto_en,
      firmadoEn: c.firmado_en,
      firmante: c.firmante_nombre,
      pdfSha256: c.pdf_sha256,
    },
  }
}

export async function enviarContrato(opportunityId: string): Promise<Resultado<{ url: string }>> {
  try {
    const session = await requireReservas()
    const email = session.user.email ?? 'panel'
    const { url, contrato } = await crearYEnviarContrato(opportunityId, email)
    await registrarActividad({ email, accion: 'enviar-contrato', slug: opportunityId, nombre: `TW-${contrato.reserva}` })
    revalidatePath(`/admin/reservas/${opportunityId}`)
    return { ok: true, datos: { url } }
  } catch (e) {
    return fallo(e)
  }
}

export async function reenviarContrato(opportunityId: string): Promise<Resultado<null>> {
  try {
    await requireReservas()
    await reenviarAvisoContrato(opportunityId)
    return { ok: true, datos: null }
  } catch (e) {
    return fallo(e)
  }
}

export async function anularContratoPanel(opportunityId: string, contratoId: string): Promise<Resultado<null>> {
  try {
    const session = await requireReservas()
    const c = await contratoDeOportunidad(opportunityId)
    if (!c || c.id !== contratoId) throw new Error('El contrato no corresponde a esta reserva.')
    // Un contrato FIRMADO es evidencia legal: anularlo solo lo puede hacer un
    // administrador (auditoría 2026-10-08). El PDF firmado sigue disponible
    // para el equipo aunque quede anulado.
    if (c.estado === 'firmado') await requireAdminRole()
    const email = session.user.email ?? 'panel'
    await anularContrato(contratoId, 'Anulado desde el panel', email)
    await registrarActividad({ email, accion: 'anular-contrato', slug: opportunityId, nombre: `TW-${c.reserva}` })
    revalidatePath(`/admin/reservas/${opportunityId}`)
    return { ok: true, datos: null }
  } catch (e) {
    return fallo(e)
  }
}
