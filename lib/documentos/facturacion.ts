import { createAdminClient } from '@/lib/supabase/admin'
import { actualizarCampos, listarCamposTodosLosModelos, obtenerContacto } from '@/lib/agente/ghl'
import { FACTURACION } from '@/lib/contratos/desde-ghl'
import { CAMPOS_FACTURACION, type DatosFacturacion } from '@/lib/documentos/tipos'
import type { SolicitudRow } from '@/lib/documentos/solicitudes'

/**
 * Paso 1 del portal de documentos: el cliente confirma sus datos de
 * facturación. Se precargan de los campos de facturación del CONTACTO en GHL
 * (los mismos que imprime el contrato) y, al confirmar, se escriben ahí.
 */

const VACIO: DatosFacturacion = { nombre: '', documento: '', direccion: '', ciudad: '', correo: '', telefono: '' }

async function idsFacturacion(): Promise<Map<keyof DatosFacturacion, string>> {
  const campos = await listarCamposTodosLosModelos()
  const porKey = new Map<string, string>()
  for (const c of campos) if (c.model !== 'opportunity' && c.fieldKey) porKey.set(c.fieldKey, c.id)
  const ids = new Map<keyof DatosFacturacion, string>()
  for (const [campo, key] of Object.entries(FACTURACION) as [keyof DatosFacturacion, string][]) {
    const id = porKey.get(key)
    if (id) ids.set(campo, id)
  }
  return ids
}

/** Lo confirmado si ya lo hay; si no, lo que hoy tiene el contacto en GHL. */
export async function facturacionDe(s: SolicitudRow): Promise<DatosFacturacion> {
  if (s.facturacion) return { ...VACIO, ...s.facturacion }
  if (!s.contact_id) return VACIO
  try {
    const [contacto, ids] = await Promise.all([obtenerContacto(s.contact_id), idsFacturacion()])
    if (!contacto) return VACIO
    const valores = new Map((contacto.customFields ?? []).map(f => [f.id, f.value]))
    const de = (campo: keyof DatosFacturacion) => {
      const id = ids.get(campo)
      const v = id ? valores.get(id) : undefined
      return v == null ? '' : String(v).trim()
    }
    return {
      nombre: de('nombre') || [contacto.firstName, contacto.lastName].filter(Boolean).join(' '),
      documento: de('documento'),
      direccion: de('direccion'),
      ciudad: de('ciudad'),
      correo: de('correo') || contacto.email || '',
      telefono: de('telefono') || contacto.phone || '',
    }
  } catch (e) {
    console.error('[documentos] no se pudo precargar la facturación:', e)
    return VACIO
  }
}

/** Limpia y valida lo que manda el portal. Lanza con un mensaje para el cliente. */
export function sanearFacturacion(crudo: unknown): DatosFacturacion {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>
  const d = { ...VACIO }
  for (const { campo, etiqueta, obligatorio } of CAMPOS_FACTURACION) {
    const v = typeof o[campo] === 'string' ? (o[campo] as string).replace(/\s+/g, ' ').trim().slice(0, 160) : ''
    if (obligatorio && !v) throw new Error(`Falta: ${etiqueta}.`)
    d[campo] = v
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) throw new Error('Revisa el correo: no parece válido.')
  if (d.telefono.replace(/\D/g, '').length < 7) throw new Error('Revisa el teléfono: faltan dígitos.')
  return d
}

/** Guarda lo confirmado (base + contacto en GHL). */
export async function confirmarFacturacion(s: SolicitudRow, crudo: unknown): Promise<DatosFacturacion> {
  const datos = sanearFacturacion(crudo)
  const { error } = await createAdminClient()
    .from('doc_solicitudes')
    .update({ facturacion: datos, facturacion_confirmada_en: new Date().toISOString() })
    .eq('id', s.id)
  if (error) throw new Error('No se pudo guardar. Intenta de nuevo.')

  if (s.contact_id) {
    try {
      const ids = await idsFacturacion()
      const campos = [...ids.entries()].map(([campo, id]) => ({ id, field_value: datos[campo] }))
      if (campos.length) await actualizarCampos(s.contact_id, campos)
    } catch (e) {
      // Lo confirmado ya quedó en la base y la asesora lo ve en el panel: no
      // se le muestra el error al cliente.
      console.error('[documentos] no se pudo escribir la facturación en GHL:', e)
    }
  }
  return datos
}
