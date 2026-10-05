import { createAdminClient } from '@/lib/supabase/admin'
import {
  actualizarCamposOportunidad,
  crearNota,
  obtenerContacto,
  obtenerOportunidad,
  type OportunidadDetalleGhl,
} from '@/lib/agente/ghl'
import { normalizarValor } from '@/lib/admin/reservas'
import { SITE } from '@/lib/site'
import {
  BUCKET_DOCUMENTOS_VIAJEROS,
  CAMPOS_PORTAL,
  DIAS_VIGENCIA_ENLACE,
  MAX_BYTES_DOCUMENTO,
  MAX_VIAJEROS,
  MESES_VIGENCIA_PASAPORTE,
  MIMES_PERMITIDOS,
  TIPO_VIAJERO_LABEL,
  calcularProgreso,
  documentosDe,
  edadEn,
  esCaraPrincipal,
  etiquetaDocumento,
  tipoViajeroDe,
  tipoViajeroPorEdad,
  urlPortal,
  type Cara,
  type DocumentoRequerido,
  type EstadoDocumentosGhl,
  type Requisitos,
  type TipoDocumento,
  type TipoViajero,
} from '@/lib/documentos/config'
import {
  CAMPOS_FECHA,
  CAMPOS_POR_TIPO,
  type ArchivoPublico,
  type DatosDocumento,
  type PortalDatos,
  type Progreso,
} from '@/lib/documentos/tipos'
import { hashToken, nuevoToken } from '@/lib/documentos/token'
import { escribirViajeroEnGhl, idCampoPasajero } from '@/lib/documentos/ghl-pasajeros'
import { leerDocumento, type ImagenDocumento } from '@/lib/documentos/lectura'

/**
 * Capa de datos del portal de documentos (tablas doc_solicitudes / doc_archivos
 * de la migración 026 y bucket privado `documentos-viajeros`). Todo con
 * service-role desde el servidor; nada de esto se importa en el cliente.
 */

export interface SolicitudRow {
  id: string
  opportunity_id: string
  contact_id: string | null
  token_hash: string
  nombre_viaje: string | null
  destino: string | null
  fecha_salida: string | null
  fecha_regreso: string | null
  telefono_ultimos4: string
  intentos_fallidos: number
  bloqueada_hasta: string | null
  lecturas_ia: number
  otp_hash: string | null
  otp_vence: string | null
  otp_intentos: number
  otp_ultimo_envio_en: string | null
  fallos_totales: number
  requisitos: Requisitos
  viajeros: number
  /** Índice 0 = viajero 1 (migración 029). Faltante = adulto. */
  viajeros_tipo: TipoViajero[] | null
  nombres: (string | null)[]
  estado: 'activa' | 'completa' | 'revocada'
  vence_en: string
  consentimiento_en: string | null
  consentimiento_ip: string | null
  consentimiento_ua: string | null
  ultimo_acceso_en: string | null
  purgada_en: string | null
  creada_por: string
  creada_en: string
  actualizada_en: string
}

export interface ArchivoRow {
  id: string
  solicitud_id: string
  viajero: number
  tipo: TipoDocumento
  cara: Cara
  ruta: string
  mime: string | null
  bytes: number | null
  ip: string | null
  subido_en: string
  metodo: 'mrz' | 'vision' | 'manual' | null
  confianza: 'alta' | 'media' | 'baja' | null
  datos_extraidos: DatosDocumento | null
  revision_requerida: boolean
  datos_confirmados: DatosDocumento | null
  confirmado_en: string | null
  escrito_ghl_en: string | null
  error_ghl: string | null
  avisos: string[]
  borrado_en: string | null
}

const admin = () => createAdminClient()

/* ------------------------------------------------------------------ */
/* Lectura de la oportunidad en GHL                                    */
/* ------------------------------------------------------------------ */

/** Campos de oportunidad que el portal lee (ids verificados por API, 2026-10-03). */
const CAMPO = {
  destino: '9x1Ui70nMDNBivYkPn8A', // Destino de interés
  fechaSalida: 'jo2GTriNmRltzHrzaAW9', // Fecha confirmada de salida
  fechaRegreso: 'Z8NdV55jbCe1WZNiZXc7', // Fecha confirmada de regreso
  numPasajerosContrato: '9Bw35vFZANBqaAkwi5eJ', // Contrato - Numero de Pasajeros (1-8)
  totalPasajeros: 'lhhfannKntvwr27os2LE', // Total Pasajeros - Cantidad
  paxTotal: 'tw0gauUzwJhh6p2P5IHX', // Pax total
  ninosLiquidacion: 'xq4m9N2rjKpQ5LOLgm0w', // Valor Niño - Cantidad
  ninosLead: 'oGeYbm0vGHlrgTSdcetU', // Cantidad de niños
  infantes: '2Zy6gJadgTzSsfnXbCiC', // Valor Infante - Cantidad
} as const

function valorCampo(o: OportunidadDetalleGhl, id: string, dataType = 'TEXT'): string | null {
  const cf = o.customFields?.find(f => f.id === id)
  if (!cf) return null
  const crudo = cf.fieldValue ?? cf.field_value ?? cf.fieldValueString ?? cf.fieldValueDate ?? cf.fieldValueNumber
  const v = normalizarValor(crudo, dataType)
  return Array.isArray(v) ? v.join(', ') : v
}

export interface ContextoOportunidad {
  opportunityId: string
  contactId: string | null
  nombreViaje: string | null
  destino: string | null
  fechaSalida: string | null
  fechaRegreso: string | null
  /** Celular del contacto (crudo) y su máscara para mostrar. */
  telefono: string | null
  telefonoMascara: string | null
  ultimos4: string | null
  viajerosSugeridos: number
  /**
   * Tipo sugerido por viajero según la liquidación: primero los adultos,
   * luego los niños (menores) y al final los infantes. La asesora confirma.
   */
  tiposSugeridos: TipoViajero[]
  /** Nombres ya escritos en P1–P8 (índice 0 = P1). */
  nombres: (string | null)[]
  /** Lo que hoy dice la tarjeta en los campos del portal. */
  linkGhl: string | null
  estadoGhl: string | null
}

export async function contextoOportunidad(opportunityId: string): Promise<ContextoOportunidad> {
  const o = await obtenerOportunidad(opportunityId)
  if (!o) throw new Error('La oportunidad no existe en GHL.')
  const contactId =
    (o as { contactId?: string }).contactId ?? (o as { contact?: { id?: string } }).contact?.id ?? null
  const contacto = contactId ? await obtenerContacto(contactId) : null

  const telefono = contacto?.phone ?? null
  const digitos = (telefono ?? '').replace(/\D/g, '')
  const ultimos4 = digitos.length >= 4 ? digitos.slice(-4) : null

  const n = (id: string) => {
    const v = valorCampo(o, id)
    const num = v === null ? NaN : Number(v)
    return Number.isInteger(num) && num >= 1 ? Math.min(num, MAX_VIAJEROS) : null
  }

  const nombres: (string | null)[] = []
  for (let i = 1; i <= MAX_VIAJEROS; i++) {
    const id = await idCampoPasajero(`P${i} - Nombre y Apellido`)
    nombres.push(id ? valorCampo(o, id) : null)
  }
  const conNombre = nombres.reduce((max, v, i) => (v ? i + 1 : max), 0)
  const viajerosSugeridos =
    n(CAMPO.numPasajerosContrato) ?? n(CAMPO.totalPasajeros) ?? n(CAMPO.paxTotal) ?? Math.max(1, conNombre)
  const ninos = n(CAMPO.ninosLiquidacion) ?? n(CAMPO.ninosLead) ?? 0
  const infantes = n(CAMPO.infantes) ?? 0
  const tiposSugeridos: TipoViajero[] = Array.from({ length: MAX_VIAJEROS }, (_, i) => {
    const desdeFinal = viajerosSugeridos - i // 1 = último viajero
    if (desdeFinal >= 1 && desdeFinal <= infantes) return 'infante'
    if (desdeFinal > infantes && desdeFinal <= infantes + ninos) return 'menor'
    return 'adulto'
  })

  return {
    opportunityId,
    contactId,
    nombreViaje: o.name ?? null,
    destino: valorCampo(o, CAMPO.destino),
    fechaSalida: valorCampo(o, CAMPO.fechaSalida, 'DATE'),
    fechaRegreso: valorCampo(o, CAMPO.fechaRegreso, 'DATE'),
    telefono,
    telefonoMascara: ultimos4 ? `••• ••• ${ultimos4}` : null,
    ultimos4,
    viajerosSugeridos,
    tiposSugeridos,
    nombres,
    linkGhl: valorCampo(o, CAMPOS_PORTAL.link),
    estadoGhl: valorCampo(o, CAMPOS_PORTAL.estado),
  }
}

/* ------------------------------------------------------------------ */
/* Solicitudes                                                         */
/* ------------------------------------------------------------------ */

function limpiarRequisitos(r: Partial<Requisitos> | null | undefined): Requisitos {
  return { pasaporte: Boolean(r?.pasaporte), cedula: Boolean(r?.cedula), visa: Boolean(r?.visa) }
}

function limpiarTiposViajero(tipos: unknown): TipoViajero[] {
  const lista = Array.isArray(tipos) ? tipos : []
  return Array.from({ length: MAX_VIAJEROS }, (_, i) => tipoViajeroDe(lista as string[], i + 1))
}

/** Documentos que pide un viajero de esta solicitud. */
export function documentosDelViajero(s: Pick<SolicitudRow, 'viajeros_tipo' | 'requisitos'>, viajero: number): DocumentoRequerido[] {
  return documentosDe(tipoViajeroDe(s.viajeros_tipo, viajero), s.requisitos)
}

function limpiarViajeros(n: unknown): number {
  const v = Number(n)
  return Number.isInteger(v) ? Math.min(Math.max(v, 1), MAX_VIAJEROS) : 1
}

/** Última solicitud no revocada de la oportunidad (la que ve el panel). */
export async function solicitudDeOportunidad(opportunityId: string): Promise<SolicitudRow | null> {
  const { data } = await admin()
    .from('doc_solicitudes')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .neq('estado', 'revocada')
    .order('creada_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as SolicitudRow | null) ?? null
}

export async function solicitudPorId(id: string): Promise<SolicitudRow | null> {
  const { data } = await admin().from('doc_solicitudes').select('*').eq('id', id).maybeSingle()
  return (data as SolicitudRow | null) ?? null
}

export async function solicitudPorToken(token: string): Promise<SolicitudRow | null> {
  const { data } = await admin()
    .from('doc_solicitudes')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  return (data as SolicitudRow | null) ?? null
}

/** Pone el disparador de C-05: vacía el campo y escribe la acción (GHL ve un cambio). */
async function dispararSolicitar(opportunityId: string, accion: 'Enviar' | 'Reenviar'): Promise<void> {
  await actualizarCamposOportunidad(opportunityId, [{ id: CAMPOS_PORTAL.solicitar, field_value: '' }])
  await actualizarCamposOportunidad(opportunityId, [{ id: CAMPOS_PORTAL.solicitar, field_value: accion }])
}

export interface EnlaceCreado {
  url: string
  solicitud: SolicitudRow
  accion: 'Enviar' | 'Reenviar'
}

/**
 * Crea el enlace de documentos de una oportunidad o, si ya tiene uno vigente,
 * lo REGENERA (token nuevo: el anterior deja de servir; los archivos ya
 * subidos se conservan). Escribe en GHL el enlace, el estado y el disparador
 * "Solicitar documentos" que C-05 convierte en WhatsApp + correo.
 */
export async function enviarEnlace(
  opportunityId: string,
  creadaPor: string,
  opciones: { viajeros: number; requisitos: Partial<Requisitos>; viajerosTipo?: TipoViajero[] }
): Promise<EnlaceCreado> {
  const ctx = await contextoOportunidad(opportunityId)
  if (!ctx.ultimos4) {
    throw new Error(
      'El contacto no tiene celular en GHL. El cliente recibe su código de acceso por WhatsApp: agrega el teléfono en el paso Contacto y vuelve a intentar.'
    )
  }
  const requisitos = limpiarRequisitos(opciones.requisitos)
  if (!requisitos.pasaporte && !requisitos.cedula && !requisitos.visa) {
    throw new Error('Marca al menos un documento (pasaporte, cédula o visa).')
  }
  const viajeros = limpiarViajeros(opciones.viajeros)

  const token = nuevoToken()
  const vence = new Date(Date.now() + DIAS_VIGENCIA_ENLACE * 86_400_000)
  const comunes = {
    token_hash: hashToken(token),
    contact_id: ctx.contactId,
    nombre_viaje: ctx.nombreViaje,
    destino: ctx.destino,
    fecha_salida: ctx.fechaSalida,
    fecha_regreso: ctx.fechaRegreso,
    telefono_ultimos4: ctx.ultimos4,
    intentos_fallidos: 0,
    bloqueada_hasta: null,
    otp_hash: null,
    otp_vence: null,
    otp_intentos: 0,
    fallos_totales: 0,
    requisitos,
    viajeros,
    viajeros_tipo: limpiarTiposViajero(opciones.viajerosTipo ?? ctx.tiposSugeridos),
    nombres: ctx.nombres.slice(0, viajeros),
    vence_en: vence.toISOString(),
    actualizada_en: new Date().toISOString(),
  }

  const existente = await solicitudDeOportunidad(opportunityId)
  let solicitud: SolicitudRow
  let accion: 'Enviar' | 'Reenviar'
  if (existente) {
    const { data, error } = await admin()
      .from('doc_solicitudes')
      .update({ ...comunes, estado: existente.estado === 'completa' ? 'completa' : 'activa' })
      .eq('id', existente.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    solicitud = data as SolicitudRow
    accion = 'Reenviar'
  } else {
    const { data, error } = await admin()
      .from('doc_solicitudes')
      .insert({ ...comunes, opportunity_id: opportunityId, estado: 'activa', creada_por: creadaPor })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    solicitud = data as SolicitudRow
    accion = 'Enviar'
  }

  const url = urlPortal(SITE.url, token)
  const archivos = await archivosDe(solicitud.id)
  const estadoGhl = estadoParaGhl(progresoDe(solicitud, archivos))
  await actualizarCamposOportunidad(opportunityId, [
    { id: CAMPOS_PORTAL.link, field_value: url },
    { id: CAMPOS_PORTAL.estado, field_value: estadoGhl },
  ])
  await dispararSolicitar(opportunityId, accion)

  return { url, solicitud, accion }
}

/**
 * Vuelve a disparar el aviso al cliente (C-05) SIN cambiar el enlace: para
 * cuando el cliente no lo encontró o la asesora quiere insistir. El enlace ya
 * está en la tarjeta ("Link de documentos"); solo se mueve el disparador.
 */
export async function reenviarAviso(opportunityId: string): Promise<void> {
  const s = await solicitudDeOportunidad(opportunityId)
  if (!s || s.estado === 'revocada') throw new Error('No hay un enlace vigente: envía uno nuevo.')
  await dispararSolicitar(opportunityId, 'Reenviar')
}

/** Cambia requisitos/viajeros de una solicitud vigente (el portal lo refleja al instante). */
export async function actualizarSolicitud(
  id: string,
  cambios: { viajeros?: number; requisitos?: Partial<Requisitos>; viajerosTipo?: TipoViajero[] }
): Promise<SolicitudRow> {
  const patch: Record<string, unknown> = { actualizada_en: new Date().toISOString() }
  if (cambios.viajerosTipo) patch.viajeros_tipo = limpiarTiposViajero(cambios.viajerosTipo)
  if (cambios.viajeros !== undefined) patch.viajeros = limpiarViajeros(cambios.viajeros)
  if (cambios.requisitos) patch.requisitos = limpiarRequisitos(cambios.requisitos)
  const { data, error } = await admin().from('doc_solicitudes').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  const solicitud = data as SolicitudRow
  await sincronizarEstado(solicitud)
  return (await solicitudPorId(id)) ?? solicitud
}

/** Revoca el enlace: deja de abrir y se limpia el campo en GHL. Los archivos se conservan hasta la purga. */
export async function revocarSolicitud(id: string): Promise<void> {
  const s = await solicitudPorId(id)
  if (!s) return
  await admin()
    .from('doc_solicitudes')
    .update({ estado: 'revocada', actualizada_en: new Date().toISOString() })
    .eq('id', id)
  await actualizarCamposOportunidad(s.opportunity_id, [{ id: CAMPOS_PORTAL.link, field_value: '' }])
}

/* ------------------------------------------------------------------ */
/* Acceso del cliente                                                  */
/* ------------------------------------------------------------------ */

export type EstadoEnlace = 'ok' | 'no-existe' | 'vencido' | 'revocado'

export function estadoEnlace(s: SolicitudRow | null): EstadoEnlace {
  if (!s) return 'no-existe'
  if (s.estado === 'revocada') return 'revocado'
  if (new Date(s.vence_en).getTime() < Date.now()) return 'vencido'
  return 'ok'
}

export async function registrarConsentimiento(id: string, ip: string, ua: string): Promise<void> {
  await admin()
    .from('doc_solicitudes')
    .update({
      consentimiento_en: new Date().toISOString(),
      consentimiento_ip: ip.slice(0, 64),
      consentimiento_ua: ua.slice(0, 300),
    })
    .eq('id', id)
    .is('consentimiento_en', null)
}

/* ------------------------------------------------------------------ */
/* Archivos                                                            */
/* ------------------------------------------------------------------ */

export async function archivosDe(solicitudId: string): Promise<ArchivoRow[]> {
  const { data } = await admin()
    .from('doc_archivos')
    .select('*')
    .eq('solicitud_id', solicitudId)
    .is('borrado_en', null)
    .order('viajero')
    .order('tipo')
    .order('cara')
  return (data ?? []) as ArchivoRow[]
}

export function aPublico(a: ArchivoRow): ArchivoPublico {
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
  }
}

export async function portalDatos(s: SolicitudRow): Promise<PortalDatos> {
  const archivos = await archivosDe(s.id)
  return {
    nombre_viaje: s.nombre_viaje,
    destino: s.destino,
    fecha_salida: s.fecha_salida,
    fecha_regreso: s.fecha_regreso,
    requisitos: s.requisitos,
    viajeros: s.viajeros,
    viajeros_tipo: limpiarTiposViajero(s.viajeros_tipo),
    nombres: s.nombres ?? [],
    consentimiento: Boolean(s.consentimiento_en),
    estado: s.estado,
    archivos: archivos.map(aPublico),
  }
}

function extensionDe(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/heic':
      return 'heic'
    case 'image/heif':
      return 'heif'
    case 'application/pdf':
      return 'pdf'
    default:
      return 'bin'
  }
}

export interface SubidaPreparada {
  archivoId: string
  ruta: string
  tokenSubida: string
}

/**
 * Reserva el espacio para una cara de un documento y devuelve una URL de
 * subida firmada (el navegador sube directo al bucket privado, sin pasar por
 * la función de Vercel ni exponer llaves). Si ya había una foto en esa cara,
 * se borra: una cara = una foto. Subir de nuevo cualquier cara invalida la
 * lectura anterior del documento (se vuelve a leer con las fotos nuevas).
 */
export async function prepararSubida(
  s: SolicitudRow,
  viajero: number,
  tipo: TipoDocumento,
  cara: Cara,
  mime: string,
  bytes: number,
  ip: string
): Promise<SubidaPreparada> {
  if (!Number.isInteger(viajero) || viajero < 1 || viajero > s.viajeros) throw new Error('Viajero inválido.')
  const doc = documentosDelViajero(s, viajero).find(d => d.tipo === tipo)
  if (!doc) throw new Error('Este viaje no pide ese documento para este viajero.')
  if (!doc.caras.includes(cara)) throw new Error('Ese lado del documento no aplica.')
  if (!(MIMES_PERMITIDOS as readonly string[]).includes(mime)) {
    throw new Error('Formato no permitido: sube una foto (JPG, PNG, WebP) o un PDF.')
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES_DOCUMENTO) {
    throw new Error('El archivo supera 10 MB.')
  }

  // Filas de otro formato (p. ej. una cédula vieja de una sola foto) estorban: se van.
  const db = admin()
  const { data: previas } = await db
    .from('doc_archivos')
    .select('id, ruta, cara')
    .eq('solicitud_id', s.id)
    .eq('viajero', viajero)
    .eq('tipo', tipo)
  const sobran = ((previas ?? []) as { id: string; ruta: string; cara: Cara }[]).filter(
    f => f.cara === cara || !doc.caras.includes(f.cara)
  )
  if (sobran.length > 0) {
    await db.storage.from(BUCKET_DOCUMENTOS_VIAJEROS).remove(sobran.map(f => f.ruta))
    await db
      .from('doc_archivos')
      .delete()
      .in(
        'id',
        sobran.map(f => f.id)
      )
  }
  if (!esCaraPrincipal(cara)) {
    // Reverso nuevo: la lectura/confirmación del frente ya no vale.
    await db
      .from('doc_archivos')
      .update({
        metodo: null,
        confianza: null,
        datos_extraidos: null,
        revision_requerida: false,
        datos_confirmados: null,
        confirmado_en: null,
        escrito_ghl_en: null,
        error_ghl: null,
        avisos: [],
      })
      .eq('solicitud_id', s.id)
      .eq('viajero', viajero)
      .eq('tipo', tipo)
      .neq('cara', 'reverso')
  }

  const ruta = `${s.id}/v${viajero}-${tipo}-${cara}-${crypto.randomUUID()}.${extensionDe(mime)}`
  const { data, error } = await db
    .from('doc_archivos')
    .insert({ solicitud_id: s.id, viajero, tipo, cara, ruta, mime, bytes, ip: ip.slice(0, 64) })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const firmada = await db.storage.from(BUCKET_DOCUMENTOS_VIAJEROS).createSignedUploadUrl(ruta)
  if (firmada.error || !firmada.data) {
    await db.from('doc_archivos').delete().eq('id', data.id)
    throw new Error(firmada.error?.message ?? 'No se pudo preparar la subida.')
  }
  return { archivoId: data.id as string, ruta, tokenSubida: firmada.data.token }
}

/** Borra todas las caras de un documento (objetos + filas). */
async function eliminarArchivoDeCasilla(solicitudId: string, viajero: number, tipo: TipoDocumento): Promise<void> {
  const db = admin()
  const { data } = await db
    .from('doc_archivos')
    .select('id, ruta')
    .eq('solicitud_id', solicitudId)
    .eq('viajero', viajero)
    .eq('tipo', tipo)
  const filas = (data ?? []) as { id: string; ruta: string }[]
  if (filas.length === 0) return
  await db.storage.from(BUCKET_DOCUMENTOS_VIAJEROS).remove(filas.map(f => f.ruta))
  await db
    .from('doc_archivos')
    .delete()
    .in(
      'id',
      filas.map(f => f.id)
    )
}

/** Todas las caras vigentes de un documento (frente/única primero). */
async function carasDe(s: SolicitudRow, viajero: number, tipo: TipoDocumento): Promise<ArchivoRow[]> {
  const { data } = await admin()
    .from('doc_archivos')
    .select('*')
    .eq('solicitud_id', s.id)
    .eq('viajero', viajero)
    .eq('tipo', tipo)
    .is('borrado_en', null)
  return ((data ?? []) as ArchivoRow[]).sort((x, y) => Number(esCaraPrincipal(y.cara)) - Number(esCaraPrincipal(x.cara)))
}

/** null si el documento ya tiene todas sus caras; si no, el mensaje para el cliente. */
async function carasFaltantes(s: SolicitudRow, a: ArchivoRow): Promise<string | null> {
  const doc = documentosDelViajero(s, a.viajero).find(d => d.tipo === a.tipo)
  // Documento que ya no se pide, o fila vieja de una sola foto: no se exige más.
  if (!doc || a.cara === 'unica') return null
  const presentes = new Set((await carasDe(s, a.viajero, a.tipo)).map(x => x.cara))
  const falta = doc.caras.find(c => !presentes.has(c))
  if (!falta) return null
  const nombre = etiquetaDocumento(a.tipo, tipoViajeroDe(s.viajeros_tipo, a.viajero)).toLowerCase()
  return falta === 'reverso'
    ? `Falta la foto del reverso de la ${nombre}.`
    : `Falta la foto del frente de la ${nombre}.`
}

export async function archivoDe(s: SolicitudRow, archivoId: string): Promise<ArchivoRow | null> {
  const { data } = await admin()
    .from('doc_archivos')
    .select('*')
    .eq('id', archivoId)
    .eq('solicitud_id', s.id)
    .is('borrado_en', null)
    .maybeSingle()
  return (data as ArchivoRow | null) ?? null
}

/** El cliente quiere repetir el documento: se borran todas sus caras (objetos + filas). */
export async function eliminarArchivo(s: SolicitudRow, archivoId: string): Promise<void> {
  const a = await archivoDe(s, archivoId)
  if (!a) return
  // "Otra foto" reinicia el documento completo (frente y reverso).
  await eliminarArchivoDeCasilla(s.id, a.viajero, a.tipo)
  await sincronizarEstado(s)
}

/**
 * Descarga las caras del documento y corre la lectura automática (Fase 2).
 * Se llama con la cara principal (frente o única) cuando ya están todas.
 */
export async function procesarArchivo(s: SolicitudRow, archivoId: string): Promise<ArchivoPublico> {
  const a = await archivoDe(s, archivoId)
  if (!a) throw new Error('El archivo no existe.')
  if (!esCaraPrincipal(a.cara ?? 'unica')) throw new Error('El documento se lee desde su frente.')
  // Un documento se lee UNA vez (auditoría #3): repetir la llamada devuelve lo ya leído.
  if (a.metodo) return aPublico(a)
  const falta = await carasFaltantes(s, a)
  if (falta) throw new Error(falta)
  const db = admin()

  // Cupo de lecturas con IA por enlace: 3 por documento requerido (fotos
  // repetidas) + 3 de margen, mínimo 6. Una lectura de frente + reverso cuenta
  // como una. Atómico en SQL. Sin cupo, el cliente escribe los datos a mano.
  const cupo = Math.max(6, progresoDe(s, []).requeridos * 3 + 3)
  const { data: hayCupo } = await db.rpc('doc_sumar_lectura_ia', { p_id: s.id, p_max: cupo })
  if (hayCupo !== true) {
    const { data } = await db
      .from('doc_archivos')
      .update({
        metodo: 'manual',
        confianza: 'baja',
        datos_extraidos: {},
        revision_requerida: true,
        avisos: ['Ya se usaron todas las lecturas automáticas de este enlace. Escribe los datos a mano, por favor.'],
      })
      .eq('id', a.id)
      .select('*')
      .single()
    return aPublico(data as ArchivoRow)
  }

  const imagenes: ImagenDocumento[] = []
  for (const c of await carasDe(s, a.viajero, a.tipo)) {
    const descarga = await db.storage.from(BUCKET_DOCUMENTOS_VIAJEROS).download(c.ruta)
    if (descarga.error || !descarga.data) {
      throw new Error('La foto no terminó de subir. Intenta de nuevo.')
    }
    imagenes.push({
      bytes: Buffer.from(await descarga.data.arrayBuffer()),
      mime: c.mime ?? descarga.data.type ?? 'application/octet-stream',
      cara: c.cara,
    })
  }

  let resultado
  try {
    resultado = await leerDocumento(imagenes, a.tipo)
  } catch (e) {
    console.error('[documentos] lectura falló:', e)
    resultado = {
      metodo: 'manual' as const,
      confianza: 'baja' as const,
      datos: {},
      revision: true,
      observaciones: 'La lectura automática no estuvo disponible. Escribe los datos a mano, por favor.',
    }
  }

  const avisos = calcularAvisos(a.tipo, resultado.datos, s, a.viajero)
  if (resultado.observaciones) avisos.unshift(resultado.observaciones)

  const { data } = await db
    .from('doc_archivos')
    .update({
      metodo: resultado.metodo,
      confianza: resultado.confianza,
      datos_extraidos: resultado.datos,
      revision_requerida: resultado.revision,
      avisos,
      bytes: imagenes[0]?.bytes.length ?? a.bytes,
    })
    .eq('id', a.id)
    .select('*')
    .single()
  return aPublico(data as ArchivoRow)
}

/** Deja solo los campos del tipo, recortados y con fechas válidas. */
export function sanearDatos(tipo: TipoDocumento, crudo: unknown): DatosDocumento {
  const entrada = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>
  const out: DatosDocumento = {}
  for (const campo of CAMPOS_POR_TIPO[tipo]) {
    const v = entrada[campo]
    if (typeof v !== 'string') continue
    let limpio = v.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (CAMPOS_FECHA.includes(campo)) {
      limpio = /^\d{4}-\d{2}-\d{2}$/.test(limpio) && !Number.isNaN(Date.parse(limpio)) ? limpio : ''
    }
    if (campo === 'sexo') limpio = limpio.toUpperCase() === 'M' || limpio.toUpperCase() === 'F' ? limpio.toUpperCase() : ''
    if (campo === 'numero' || campo === 'documento_identidad') limpio = limpio.replace(/[\s.\-]/g, '').toUpperCase()
    if (limpio) out[campo] = limpio
  }
  return out
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function sumarMeses(iso: string, meses: number): Date {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + meses)
  return d
}

/** Avisos de vigencia (Fase 3): pasaporte a menos de 6 meses del regreso, visa vencida antes del regreso. */
export function calcularAvisos(tipo: TipoDocumento, datos: DatosDocumento, s: SolicitudRow, viajero: number): string[] {
  const avisos: string[] = []
  const hoy = new Date().toISOString().slice(0, 10)
  // Tipo de viajero vs. fecha de nacimiento (a la fecha de salida, o hoy).
  const edad = datos.fecha_nacimiento ? edadEn(datos.fecha_nacimiento, s.fecha_salida ?? hoy) : null
  const marcado = tipoViajeroDe(s.viajeros_tipo, viajero)
  if (edad !== null && tipoViajeroPorEdad(edad) !== marcado) {
    avisos.push(
      `Según la fecha de nacimiento (${edad} año${edad === 1 ? '' : 's'}), este viajero sería ${TIPO_VIAJERO_LABEL[tipoViajeroPorEdad(edad)].toLowerCase()}, no ${TIPO_VIAJERO_LABEL[marcado].toLowerCase()}. Tu asesora lo revisa.`
    )
  }
  const vence = datos.fecha_vencimiento
  if (!vence) return avisos
  const referencia = s.fecha_regreso ?? s.fecha_salida
  if (tipo === 'pasaporte') {
    if (vence < hoy) {
      avisos.push(`El pasaporte está vencido (venció el ${fmtFecha(vence)}). Hay que renovarlo antes del viaje.`)
    } else if (referencia && sumarMeses(vence, 0) < sumarMeses(referencia, MESES_VIGENCIA_PASAPORTE)) {
      avisos.push(
        `El pasaporte vence el ${fmtFecha(vence)}, antes de ${MESES_VIGENCIA_PASAPORTE} meses después del ${s.fecha_regreso ? 'regreso' : 'viaje'} (${fmtFecha(referencia)}). Muchos países exigen esa vigencia: confirma con tu asesora si debes renovarlo.`
      )
    }
  } else if (tipo === 'visa') {
    if (vence < hoy) avisos.push(`La visa está vencida (venció el ${fmtFecha(vence)}).`)
    else if (referencia && vence < referencia) {
      avisos.push(`La visa vence el ${fmtFecha(vence)}, antes del ${s.fecha_regreso ? 'regreso' : 'viaje'} (${fmtFecha(referencia)}).`)
    }
  }
  return avisos
}

/**
 * El cliente confirmó (o corrigió) los datos: se guardan, se escriben en los
 * campos P{n} de la oportunidad y se recalcula el estado del viaje.
 */
export async function confirmarArchivo(
  s: SolicitudRow,
  archivoId: string,
  datosCrudos: unknown
): Promise<{ archivo: ArchivoPublico; progreso: Progreso }> {
  const a = await archivoDe(s, archivoId)
  if (!a) throw new Error('El archivo no existe.')
  if (!esCaraPrincipal(a.cara ?? 'unica')) throw new Error('Confirma el documento desde su frente.')
  const faltaCara = await carasFaltantes(s, a)
  if (faltaCara) throw new Error(faltaCara)
  const datos = sanearDatos(a.tipo, datosCrudos)
  const obligatorios: Record<TipoDocumento, (keyof DatosDocumento)[]> = {
    pasaporte: ['nombres', 'apellidos', 'numero', 'fecha_nacimiento', 'fecha_vencimiento'],
    cedula: ['numero', 'nombres', 'apellidos'],
    visa: ['numero', 'fecha_vencimiento'],
    registro_civil: ['nombres', 'apellidos', 'fecha_nacimiento'],
  }
  const faltan = obligatorios[a.tipo].filter(c => !datos[c])
  if (faltan.length > 0) throw new Error('Faltan datos obligatorios: revisa los campos marcados.')

  // Avisos de vigencia con los datos confirmados (sin las observaciones de lectura).
  const avisos = calcularAvisos(a.tipo, datos, s, a.viajero)

  const db = admin()
  let escrito: string | null = null
  let errorGhl: string | null = null
  try {
    await escribirViajeroEnGhl(s.opportunity_id, a.viajero, a.tipo, datos)
    escrito = new Date().toISOString()
  } catch (e) {
    errorGhl = (e as Error).message.slice(0, 300)
    console.error('[documentos] no se pudo escribir en GHL:', e)
  }

  const { data } = await db
    .from('doc_archivos')
    .update({
      datos_confirmados: datos,
      confirmado_en: new Date().toISOString(),
      escrito_ghl_en: escrito,
      error_ghl: errorGhl,
      avisos,
    })
    .eq('id', a.id)
    .select('*')
    .single()

  const progreso = await sincronizarEstado(s)
  return { archivo: aPublico(data as ArchivoRow), progreso }
}

/** Reintento desde el panel cuando la escritura en GHL falló. */
export async function reescribirEnGhl(s: SolicitudRow, archivoId: string): Promise<void> {
  const a = await archivoDe(s, archivoId)
  if (!a?.datos_confirmados) throw new Error('Ese documento aún no está confirmado.')
  await escribirViajeroEnGhl(s.opportunity_id, a.viajero, a.tipo, a.datos_confirmados)
  await admin()
    .from('doc_archivos')
    .update({ escrito_ghl_en: new Date().toISOString(), error_ghl: null })
    .eq('id', a.id)
}

/* ------------------------------------------------------------------ */
/* Progreso y estado en GHL                                            */
/* ------------------------------------------------------------------ */

export function progresoDe(s: SolicitudRow, archivos: ArchivoRow[]): Progreso {
  return calcularProgreso(s.viajeros, s.viajeros_tipo, s.requisitos, archivos)
}

export function estadoParaGhl(p: Progreso): EstadoDocumentosGhl {
  if (p.completo) return 'Completos'
  if (p.confirmados > 0) return 'Parciales'
  return 'Solicitados'
}

/**
 * Recalcula el progreso y lo refleja en GHL ("Documentos del cliente") y en la
 * solicitud (activa/completa). Al completarse deja una nota en el contacto con
 * el enlace al panel (nunca las imágenes).
 */
export async function sincronizarEstado(s: SolicitudRow): Promise<Progreso> {
  const actual = (await solicitudPorId(s.id)) ?? s
  const archivos = await archivosDe(actual.id)
  const p = progresoDe(actual, archivos)
  const estadoGhl = estadoParaGhl(p)

  try {
    await actualizarCamposOportunidad(actual.opportunity_id, [{ id: CAMPOS_PORTAL.estado, field_value: estadoGhl }])
  } catch (e) {
    console.error('[documentos] no se pudo actualizar el estado en GHL:', e)
  }

  if (actual.estado !== 'revocada') {
    const nuevo = p.completo ? 'completa' : 'activa'
    if (nuevo !== actual.estado) {
      await admin()
        .from('doc_solicitudes')
        .update({ estado: nuevo, actualizada_en: new Date().toISOString() })
        .eq('id', actual.id)
      if (nuevo === 'completa' && actual.contact_id) {
        const revision = archivos.filter(a => a.revision_requerida || (a.avisos ?? []).length > 0).length
        const texto =
          `📄 Documentos del viaje "${actual.nombre_viaje ?? actual.opportunity_id}": completos ` +
          `(${p.confirmados}/${p.requeridos}). Datos escritos en P1–P${actual.viajeros}.` +
          (revision ? ` ⚠️ ${revision} con aviso o para revisar.` : '') +
          ` Ver en el panel: ${SITE.url}/admin/reservas/${actual.opportunity_id}`
        crearNota(actual.contact_id, texto).catch(e => console.error('[documentos] nota GHL:', e))
      }
    }
  }
  return p
}

/** URL firmada (5 minutos) para que el panel vea un documento. */
export async function urlFirmada(ruta: string): Promise<string> {
  const { data, error } = await admin().storage.from(BUCKET_DOCUMENTOS_VIAJEROS).createSignedUrl(ruta, 300)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo firmar la URL.')
  return data.signedUrl
}

/** Listado para /admin/documentos. */
export async function listarSolicitudes(limite = 100): Promise<(SolicitudRow & { progreso: Progreso })[]> {
  const db = admin()
  const { data } = await db.from('doc_solicitudes').select('*').order('creada_en', { ascending: false }).limit(limite)
  const solicitudes = (data ?? []) as SolicitudRow[]
  if (solicitudes.length === 0) return []
  const { data: arch } = await db
    .from('doc_archivos')
    .select('*')
    .in(
      'solicitud_id',
      solicitudes.map(s => s.id)
    )
    .is('borrado_en', null)
  const porSolicitud = new Map<string, ArchivoRow[]>()
  for (const a of (arch ?? []) as ArchivoRow[]) {
    if (!porSolicitud.has(a.solicitud_id)) porSolicitud.set(a.solicitud_id, [])
    porSolicitud.get(a.solicitud_id)!.push(a)
  }
  return solicitudes.map(s => ({ ...s, progreso: progresoDe(s, porSolicitud.get(s.id) ?? []) }))
}

/* ------------------------------------------------------------------ */
/* Vista del panel por viajero (enlace "P{n} - Documentos (panel)")    */
/* ------------------------------------------------------------------ */

export interface CaraFirmada {
  id: string
  cara: Cara
  mime: string | null
  /** URL firmada de 5 minutos (null si el objeto ya no existe). */
  url: string | null
}

export interface DocumentoViajeroPanel {
  tipo: TipoDocumento
  etiqueta: string
  principal: ArchivoRow | null
  caras: CaraFirmada[]
  /** Caras que el viaje pide y aún no están. */
  faltan: Cara[]
}

export interface ViajeroPanel {
  solicitud: SolicitudRow
  viajero: number
  tipoViajero: TipoViajero
  nombre: string | null
  documentos: DocumentoViajeroPanel[]
}

/**
 * Documentos de un viajero con las fotos firmadas por 5 minutos. Usa la
 * solicitud más reciente de la oportunidad, aunque esté desactivada (las fotos
 * siguen guardadas hasta la purga). null si no hay solicitud o el viajero no existe.
 */
export async function documentosViajeroPanel(opportunityId: string, viajero: number): Promise<ViajeroPanel | null> {
  if (!Number.isInteger(viajero) || viajero < 1 || viajero > MAX_VIAJEROS) return null
  const { data } = await admin()
    .from('doc_solicitudes')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('creada_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  const s = (data as SolicitudRow | null) ?? null
  if (!s) return null
  const archivos = (await archivosDe(s.id)).filter(a => a.viajero === viajero)
  const tipoViajero = tipoViajeroDe(s.viajeros_tipo, viajero)
  const requeridos = viajero <= s.viajeros ? documentosDe(tipoViajero, s.requisitos) : []
  // Lo que pide el viaje, más lo que haya subido aunque ya no se pida.
  const tipos = [...requeridos.map(d => d.tipo), ...archivos.map(a => a.tipo)].filter((t, i, arr) => arr.indexOf(t) === i)

  const documentos: DocumentoViajeroPanel[] = []
  for (const tipo of tipos) {
    const propios = archivos
      .filter(a => a.tipo === tipo)
      .sort((x, y) => Number(esCaraPrincipal(y.cara)) - Number(esCaraPrincipal(x.cara)))
    const caras: CaraFirmada[] = []
    for (const a of propios) {
      let url: string | null = null
      try {
        url = await urlFirmada(a.ruta)
      } catch {
        url = null
      }
      caras.push({ id: a.id, cara: a.cara, mime: a.mime, url })
    }
    const pedidas = requeridos.find(d => d.tipo === tipo)?.caras ?? []
    const legado = propios.some(a => a.cara === 'unica')
    documentos.push({
      tipo,
      etiqueta: etiquetaDocumento(tipo, tipoViajero),
      principal: propios.find(a => esCaraPrincipal(a.cara)) ?? null,
      caras,
      faltan: legado ? [] : pedidas.filter(c => !propios.some(a => a.cara === c)),
    })
  }
  return { solicitud: s, viajero, tipoViajero, nombre: s.nombres?.[viajero - 1] ?? null, documentos }
}
