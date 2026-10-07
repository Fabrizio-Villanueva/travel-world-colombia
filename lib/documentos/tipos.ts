import type { Cara, Requisitos, TipoDocumento, TipoViajero } from '@/lib/documentos/config'

/**
 * Tipos que viajan entre servidor y cliente (página pública y panel). Sin
 * imports de Node para que los componentes de cliente los puedan usar.
 */

/**
 * Datos leídos de un documento, planos y como texto. Fechas en YYYY-MM-DD.
 * Cada tipo usa un subconjunto (ver CAMPOS_POR_TIPO); vacío = desconocido.
 */
export interface DatosDocumento {
  nombres?: string
  apellidos?: string
  numero?: string
  nacionalidad?: string
  fecha_nacimiento?: string
  sexo?: string
  fecha_vencimiento?: string
  pais_emisor?: string
  /** CC / TI / CE / PPT / Pasaporte / otro (cédula) · B1/B2, Schengen… (visa). */
  tipo_documento?: string
  /** Número de cédula que trae el pasaporte colombiano en la MRZ (campo personal). */
  documento_identidad?: string
}

export type CampoDocumento = keyof DatosDocumento

/** Qué campos muestra y confirma el cliente para cada tipo de documento. */
export const CAMPOS_POR_TIPO: Record<TipoDocumento, CampoDocumento[]> = {
  pasaporte: [
    'nombres',
    'apellidos',
    'numero',
    'nacionalidad',
    'fecha_nacimiento',
    'sexo',
    'fecha_vencimiento',
    'documento_identidad',
  ],
  cedula: ['tipo_documento', 'numero', 'nombres', 'apellidos', 'fecha_nacimiento'],
  visa: ['pais_emisor', 'tipo_documento', 'numero', 'nombres', 'apellidos', 'fecha_vencimiento'],
  registro_civil: ['numero', 'nombres', 'apellidos', 'fecha_nacimiento', 'sexo'],
}

export const CAMPO_LABEL: Record<CampoDocumento, string> = {
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  numero: 'Número',
  nacionalidad: 'Nacionalidad',
  fecha_nacimiento: 'Fecha de nacimiento',
  sexo: 'Sexo',
  fecha_vencimiento: 'Fecha de vencimiento',
  pais_emisor: 'País que la emite',
  tipo_documento: 'Tipo',
  documento_identidad: 'Número de cédula',
}

export const CAMPOS_FECHA: CampoDocumento[] = ['fecha_nacimiento', 'fecha_vencimiento']

export type Confianza = 'alta' | 'media' | 'baja'
export type MetodoLectura = 'mrz' | 'vision' | 'manual'

/** Un documento tal como lo ve el cliente en el portal (sin rutas internas). */
export interface ArchivoPublico {
  id: string
  viajero: number
  tipo: TipoDocumento
  cara: Cara
  subido_en: string
  metodo: MetodoLectura | null
  confianza: Confianza | null
  datos_extraidos: DatosDocumento | null
  datos_confirmados: DatosDocumento | null
  confirmado_en: string | null
  revision_requerida: boolean
  avisos: string[]
}

/** Lo que el portal muestra una vez verificado el acceso. */
export interface PortalDatos {
  nombre_viaje: string | null
  destino: string | null
  fecha_salida: string | null
  fecha_regreso: string | null
  requisitos: Requisitos
  viajeros: number
  /** Índice 0 = viajero 1. Faltante = adulto. */
  viajeros_tipo: TipoViajero[]
  nombres: (string | null)[]
  consentimiento: boolean
  estado: 'activa' | 'completa' | 'revocada'
  archivos: ArchivoPublico[]
  /** Paso 1: confirmados, o precargados del contacto en GHL si aún no. */
  facturacion: DatosFacturacion
  facturacion_confirmada: boolean
}

/** Resultado de la lectura automática (Fase 2). */
export interface ResultadoLectura {
  metodo: MetodoLectura
  confianza: Confianza
  datos: DatosDocumento
  /** Pedir revisión de la asesora (confianza baja, tipo distinto al esperado, ilegible…). */
  revision: boolean
  observaciones: string
  /** Tipo que parece ser el documento, si difiere del esperado. */
  tipo_detectado?: string
}

/** Progreso de una solicitud: cuántos documentos requeridos ya están confirmados. */
export interface Progreso {
  requeridos: number
  confirmados: number
  subidos: number
  completo: boolean
}

/** Datos de facturación que el cliente confirma en el paso 1 del portal. */
export interface DatosFacturacion {
  nombre: string
  documento: string
  direccion: string
  ciudad: string
  correo: string
  telefono: string
}

export const CAMPOS_FACTURACION: { campo: keyof DatosFacturacion; etiqueta: string; tipo: 'text' | 'email' | 'tel'; obligatorio: boolean }[] = [
  { campo: 'nombre', etiqueta: 'Nombre completo o razón social', tipo: 'text', obligatorio: true },
  { campo: 'documento', etiqueta: 'Cédula o NIT', tipo: 'text', obligatorio: true },
  { campo: 'direccion', etiqueta: 'Dirección', tipo: 'text', obligatorio: true },
  { campo: 'ciudad', etiqueta: 'Ciudad', tipo: 'text', obligatorio: true },
  { campo: 'correo', etiqueta: 'Correo para la factura', tipo: 'email', obligatorio: true },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', obligatorio: true },
]
