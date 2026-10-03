/**
 * Portal seguro de documentos de viajeros (docs/idea-portal-documentos.md).
 *
 * Constantes compartidas por el servidor, el panel y la página pública. Este
 * archivo NO importa nada de Node: lo leen también componentes de cliente.
 */

/** Bucket PRIVADO de Supabase (migración 026): solo el servidor lo toca. */
export const BUCKET_DOCUMENTOS_VIAJEROS = 'documentos-viajeros'

/**
 * Campos de OPORTUNIDAD creados el 2026-10-03 en la carpeta 👥 Pasajeros
 * (subcuenta RMFUo0i4KOVl7eZHEn7s). Los P{n} - Visa Número / Visa Vencimiento
 * se resuelven por NOMBRE (ver lib/documentos/ghl-pasajeros.ts), igual que el
 * resto de campos P1–P8 del Generador.
 */
export const CAMPOS_PORTAL = {
  /** opportunity.link_de_documentos (TEXT): el enlace que C-05 manda al cliente. */
  link: 'QGhEZI6g6dcUFrDcnAsD',
  /** opportunity.solicitar_documentos (Enviar/Reenviar): disparador del workflow C-05. */
  solicitar: 'BKkSYqWHYFufZET1oKl7',
  /** opportunity.documentos_del_cliente (Solicitados/Parciales/Completos). */
  estado: '9TEMrVYyVwNhTVmJFkFr',
} as const

export type EstadoDocumentosGhl = 'Solicitados' | 'Parciales' | 'Completos'

export type TipoDocumento = 'pasaporte' | 'cedula' | 'visa'
export const TIPOS_DOCUMENTO: TipoDocumento[] = ['pasaporte', 'cedula', 'visa']

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  pasaporte: 'Pasaporte',
  cedula: 'Cédula o tarjeta de identidad',
  visa: 'Visa',
}

export const TIPO_EMOJI: Record<TipoDocumento, string> = {
  pasaporte: '🛂',
  cedula: '🪪',
  visa: '📄',
}

/** Qué documentos pide un viaje (lo marca la asesora; se sugiere por destino). */
export interface Requisitos {
  pasaporte: boolean
  cedula: boolean
  visa: boolean
}

export const REQUISITOS_INTERNACIONAL: Requisitos = { pasaporte: true, cedula: false, visa: false }
export const REQUISITOS_NACIONAL: Requisitos = { pasaporte: false, cedula: true, visa: false }

export function tiposRequeridos(r: Requisitos): TipoDocumento[] {
  return TIPOS_DOCUMENTO.filter(t => r[t])
}

/** Días que vive un enlace desde que se crea (se puede reenviar: nace otro). */
export const DIAS_VIGENCIA_ENLACE = 30
/** Retención: los archivos se borran estos días después de la fecha de regreso. */
export const DIAS_RETENCION_TRAS_REGRESO = 30
/** Sin fecha de regreso conocida: tope de seguridad desde la creación. */
export const DIAS_RETENCION_SIN_REGRESO = 180

/**
 * Acceso con código de un solo uso (migración 027): 6 dígitos por WhatsApp o
 * correo, vence en 10 min, 5 intentos por código, 1 envío por minuto y 5 por
 * hora (límites aplicados en SQL), y tope de fallos en la vida del enlace:
 * al llegar, el enlace se desactiva y la asesora recibe una nota.
 */
export const OTP_MINUTOS = 10
export const OTP_INTENTOS_POR_CODIGO = 5
export const OTP_ESPERA_SEGUNDOS = 60
export const MAX_FALLOS_ENLACE = 10
/** Horas que dura el acceso una vez verificado (cookie firmada). */
export const HORAS_ACCESO = 12

/** Tope por archivo (coincide con file_size_limit del bucket). */
export const MAX_BYTES_DOCUMENTO = 10 * 1024 * 1024
/** Tipos que acepta el bucket. HEIC se convierte a JPEG en el navegador antes de subir. */
export const MIMES_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

/** Aviso de vigencia: muchos países exigen el pasaporte vigente 6 meses tras el regreso. */
export const MESES_VIGENCIA_PASAPORTE = 6

/** Máximo de viajeros (campos P1–P8 de la oportunidad). */
export const MAX_VIAJEROS = 8

/** URL pública del portal para un token. */
export function urlPortal(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/documentos/${token}`
}
