import { createAdminClient } from '@/lib/supabase/admin'

/** Acciones registrables en la bitácora del panel. */
export type AccionAudit =
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'activar'
  | 'ocultar'
  | 'destacar'
  | 'quitar-destacado'
  | 'aprobar-usuario'
  | 'invitar-usuario'
  | 'revocar-usuario'
  | 'cambiar-rol'
  | 'cambiar-nombre-usuario'
  | 'guardar-reserva'
  // Portal de documentos de viajeros (datos sensibles: cada vista queda registrada).
  | 'enviar-enlace-documentos'
  | 'revocar-enlace-documentos'
  | 'ver-documento'
  | 'editar-regla-visa'

interface RegistroActividad {
  email: string
  accion: AccionAudit
  slug?: string
  nombre?: string
  detalle?: Record<string, unknown>
}

/**
 * Inserta una entrada en `audit_log` con el correo del usuario que hizo el
 * cambio. Usa el cliente service-role (omite RLS). Nunca lanza: un fallo al
 * registrar la actividad no debe tumbar la mutación que la originó.
 */
export async function registrarActividad({
  email,
  accion,
  slug,
  nombre,
  detalle,
}: RegistroActividad): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_log').insert({
      user_email: email,
      accion,
      destino_slug: slug ?? null,
      destino_nombre: nombre ?? null,
      detalle: detalle ?? null,
    })
    if (error) console.error('[audit] no se pudo registrar la actividad:', error.message)
  } catch (e) {
    console.error('[audit] error inesperado registrando actividad:', e)
  }
}
