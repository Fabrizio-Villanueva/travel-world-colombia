'use server'

import { requireReservas } from '@/lib/admin/guard'
import { registrarActividad } from '@/lib/admin/audit'
import { tipoViajeroDe, MAX_VIAJEROS, type Requisitos, type TipoViajero } from '@/lib/documentos/config'
import {
  actualizarSolicitud,
  archivosDe,
  contextoOportunidad,
  enviarEnlace,
  progresoDe,
  reenviarAviso,
  reescribirEnGhl,
  revocarSolicitud,
  solicitudDeOportunidad,
  urlFirmada,
  type ArchivoRow,
  type SolicitudRow,
} from '@/lib/documentos/solicitudes'
import { sugerirRequisitos, type Sugerencia } from '@/lib/documentos/visas'
import type { ArchivoPublico, Progreso } from '@/lib/documentos/tipos'

/**
 * Acciones de la pestaña "Documentos" del Generador de Contratos. Separadas de
 * actions.ts (que tiene trabajo en curso de otra sesión). Mismo patrón: los
 * errores vuelven como dato.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string }

/** Solicitud tal como la ve el panel (sin el hash del token ni los dígitos). */
export type SolicitudPanel = Omit<SolicitudRow, 'token_hash' | 'telefono_ultimos4'>

export interface ArchivoPanel extends ArchivoPublico {
  escrito_ghl_en: string | null
  error_ghl: string | null
  mime: string | null
  bytes: number | null
}

export interface EstadoDocumentos {
  solicitud: SolicitudPanel | null
  archivos: ArchivoPanel[]
  progreso: Progreso | null
  /** Enlace vigente, tal como quedó en el campo "Link de documentos" de GHL. */
  link: string | null
  telefonoMascara: string | null
  destino: string | null
  viajerosSugeridos: number
  /** Tipo de cada viajero (índice 0 = viajero 1): el guardado, o el sugerido por la liquidación. */
  tiposViajero: TipoViajero[]
  /** true si tiposViajero sale de la liquidación (aún no hay enlace). */
  tiposSugeridos: boolean
  nombres: (string | null)[]
  sugerencia: Sugerencia
}

function aPanel(a: ArchivoRow): ArchivoPanel {
  return {
    id: a.id,
    viajero: a.viajero,
    tipo: a.tipo,
    cara: a.cara ?? 'unica',
    subido_en: a.subido_en,
    metodo: a.metodo,
    confianza: a.confianza,
    datos_extraidos: a.datos_extraidos,
    datos_confirmados: a.datos_confirmados,
    confirmado_en: a.confirmado_en,
    revision_requerida: a.revision_requerida,
    avisos: a.avisos ?? [],
    escrito_ghl_en: a.escrito_ghl_en,
    error_ghl: a.error_ghl,
    mime: a.mime,
    bytes: a.bytes,
  }
}

function sinSecretos(s: SolicitudRow): SolicitudPanel {
  const { token_hash: _h, telefono_ultimos4: _t, ...resto } = s
  void _h
  void _t
  return resto
}

/** Estado completo de la pestaña: lo carga la página del Generador y se refresca tras cada acción. */
export async function cargarEstadoDocumentos(opportunityId: string): Promise<EstadoDocumentos> {
  await requireReservas()
  const [ctx, solicitud] = await Promise.all([contextoOportunidad(opportunityId), solicitudDeOportunidad(opportunityId)])
  const [archivos, sugerencia] = await Promise.all([
    solicitud ? archivosDe(solicitud.id) : Promise.resolve([] as ArchivoRow[]),
    sugerirRequisitos(ctx.destino),
  ])
  return {
    solicitud: solicitud ? sinSecretos(solicitud) : null,
    archivos: archivos.map(aPanel),
    progreso: solicitud ? progresoDe(solicitud, archivos) : null,
    link: solicitud ? ctx.linkGhl : null,
    telefonoMascara: ctx.telefonoMascara,
    destino: ctx.destino,
    viajerosSugeridos: solicitud?.viajeros ?? ctx.viajerosSugeridos,
    tiposViajero: solicitud
      ? Array.from({ length: MAX_VIAJEROS }, (_, i) => tipoViajeroDe(solicitud.viajeros_tipo, i + 1))
      : ctx.tiposSugeridos,
    tiposSugeridos: !solicitud,
    nombres: ctx.nombres,
    sugerencia,
  }
}

async function solicitudPropia(opportunityId: string): Promise<SolicitudRow> {
  const s = await solicitudDeOportunidad(opportunityId)
  if (!s) throw new Error('Esta oportunidad no tiene un enlace de documentos.')
  return s
}

/** Crea (o regenera) el enlace, lo escribe en GHL y dispara "Solicitar documentos" para C-05. */
export async function enviarEnlaceDocumentos(
  opportunityId: string,
  opciones: { viajeros: number; requisitos: Requisitos; viajerosTipo: TipoViajero[] }
): Promise<Resultado<{ url: string; accion: 'Enviar' | 'Reenviar'; estado: EstadoDocumentos }>> {
  try {
    const { user } = await requireReservas()
    const r = await enviarEnlace(opportunityId, user.email!, opciones)
    await registrarActividad({
      email: user.email!,
      accion: 'enviar-enlace-documentos',
      nombre: opportunityId,
      detalle: {
        accion: r.accion,
        viajeros: r.solicitud.viajeros,
        tipos: (r.solicitud.viajeros_tipo ?? []).slice(0, r.solicitud.viajeros),
        requisitos: r.solicitud.requisitos,
      },
    })
    return { ok: true, datos: { url: r.url, accion: r.accion, estado: await cargarEstadoDocumentos(opportunityId) } }
  } catch (e) {
    console.error('enviarEnlaceDocumentos:', e)
    return { ok: false, error: (e as Error).message }
  }
}

/** Vuelve a avisar al cliente (dispara C-05) con el MISMO enlace. */
export async function enviarAvisoDocumentos(opportunityId: string): Promise<Resultado<EstadoDocumentos>> {
  try {
    const { user } = await requireReservas()
    await reenviarAviso(opportunityId)
    await registrarActividad({
      email: user.email!,
      accion: 'enviar-enlace-documentos',
      nombre: opportunityId,
      detalle: { accion: 'Aviso (mismo enlace)' },
    })
    return { ok: true, datos: await cargarEstadoDocumentos(opportunityId) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Cambia viajeros/requisitos sin regenerar el enlace. */
export async function actualizarRequisitosDocumentos(
  opportunityId: string,
  cambios: { viajeros?: number; requisitos?: Requisitos; viajerosTipo?: TipoViajero[] }
): Promise<Resultado<EstadoDocumentos>> {
  try {
    const { user } = await requireReservas()
    const s = await solicitudPropia(opportunityId)
    await actualizarSolicitud(s.id, cambios)
    await registrarActividad({ email: user.email!, accion: 'actualizar', nombre: `documentos ${opportunityId}`, detalle: cambios })
    return { ok: true, datos: await cargarEstadoDocumentos(opportunityId) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function revocarEnlaceDocumentos(opportunityId: string): Promise<Resultado<EstadoDocumentos>> {
  try {
    const { user } = await requireReservas()
    const s = await solicitudPropia(opportunityId)
    await revocarSolicitud(s.id)
    await registrarActividad({ email: user.email!, accion: 'revocar-enlace-documentos', nombre: opportunityId })
    return { ok: true, datos: await cargarEstadoDocumentos(opportunityId) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** URL firmada de 5 minutos para ver un documento. Cada vista queda en la bitácora. */
export async function verDocumento(opportunityId: string, archivoId: string): Promise<Resultado<string>> {
  try {
    const { user } = await requireReservas()
    const s = await solicitudPropia(opportunityId)
    const a = (await archivosDe(s.id)).find(x => x.id === archivoId)
    if (!a) throw new Error('El documento ya no existe (pudo ser reemplazado o borrado por retención).')
    const url = await urlFirmada(a.ruta)
    await registrarActividad({
      email: user.email!,
      accion: 'ver-documento',
      nombre: opportunityId,
      detalle: { archivo: a.id, viajero: a.viajero, tipo: a.tipo, cara: a.cara },
    })
    return { ok: true, datos: url }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Reintenta escribir en P1–P12 un documento confirmado cuya escritura en GHL falló. */
export async function reintentarEscrituraGhl(opportunityId: string, archivoId: string): Promise<Resultado<EstadoDocumentos>> {
  try {
    await requireReservas()
    const s = await solicitudPropia(opportunityId)
    await reescribirEnGhl(s, archivoId)
    return { ok: true, datos: await cargarEstadoDocumentos(opportunityId) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
