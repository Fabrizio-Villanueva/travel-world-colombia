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

export type TipoDocumento = 'pasaporte' | 'cedula' | 'visa' | 'registro_civil'

/** Lo que la asesora marca por VIAJE (el detalle por viajero sale de documentosDe). */
export type Requisito = 'pasaporte' | 'cedula' | 'visa'
export const REQUISITOS_TIPOS: Requisito[] = ['pasaporte', 'cedula', 'visa']
/** Alias de REQUISITOS_TIPOS (nombre que usa el panel). */
export const TIPOS_DOCUMENTO = REQUISITOS_TIPOS

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  pasaporte: 'Pasaporte',
  cedula: 'Cédula o tarjeta de identidad',
  visa: 'Visa',
  registro_civil: 'Registro civil de nacimiento',
}

export const TIPO_EMOJI: Record<TipoDocumento, string> = {
  pasaporte: '🛂',
  cedula: '🪪',
  visa: '📄',
  registro_civil: '📜',
}

/** Qué documentos pide un viaje (lo marca la asesora; se sugiere por destino). */
export interface Requisitos {
  pasaporte: boolean
  cedula: boolean
  visa: boolean
}

export const REQUISITOS_INTERNACIONAL: Requisitos = { pasaporte: true, cedula: false, visa: false }
export const REQUISITOS_NACIONAL: Requisitos = { pasaporte: false, cedula: true, visa: false }

export function tiposRequeridos(r: Requisitos): Requisito[] {
  return REQUISITOS_TIPOS.filter(t => r[t])
}

/* ------------------------------------------------------------------ */
/* Tipos de viajero y documentos por viajero (v2, 05-oct)              */
/* ------------------------------------------------------------------ */

/**
 * Adulto (18+), menor (7–17) e infante (0–6), con la regla colombiana: a los 7
 * años se expide la tarjeta de identidad y a los 18 la cédula. Lo marca la
 * asesora en la pestaña Documentos (prellenado con la liquidación).
 */
export type TipoViajero = 'adulto' | 'menor' | 'infante'
export const TIPOS_VIAJERO: TipoViajero[] = ['adulto', 'menor', 'infante']
export const TIPO_VIAJERO_LABEL: Record<TipoViajero, string> = {
  adulto: 'Adulto',
  menor: 'Menor',
  infante: 'Infante',
}
export const TIPO_VIAJERO_EDADES: Record<TipoViajero, string> = {
  adulto: '18 años o más',
  menor: '7 a 17 años',
  infante: '0 a 6 años',
}

/** Cara de un documento: los de dos lados se suben en dos fotos. */
export type Cara = 'frente' | 'reverso' | 'unica'
export const CARA_LABEL: Record<Cara, string> = { frente: 'Frente', reverso: 'Reverso', unica: 'Foto' }

export interface DocumentoRequerido {
  tipo: TipoDocumento
  /** ['frente', 'reverso'] o ['unica']. La primera es la principal (lleva la lectura). */
  caras: Cara[]
}

const DOS_CARAS: Cara[] = ['frente', 'reverso']
const UNA_CARA: Cara[] = ['unica']

export function tipoViajeroDe(tipos: readonly (string | null | undefined)[] | null | undefined, viajero: number): TipoViajero {
  const t = tipos?.[viajero - 1]
  return t === 'menor' || t === 'infante' ? t : 'adulto'
}

/**
 * Documentos que pide un viajero según su tipo y lo que marcó la asesora:
 *  - Nacional ("cédula"): adulto → cédula (2 caras); menor → tarjeta de
 *    identidad (2 caras); infante → registro civil (1 foto).
 *  - Internacional ("pasaporte"): pasaporte (página de datos) para todos; menores
 *    e infantes además el registro civil (prueba de parentesco).
 *  - Visa: una foto, para quien la necesite el viaje.
 */
export function documentosDe(tipoViajero: TipoViajero, r: Requisitos): DocumentoRequerido[] {
  const out: DocumentoRequerido[] = []
  if (r.pasaporte) out.push({ tipo: 'pasaporte', caras: UNA_CARA })
  if (r.cedula) {
    out.push(tipoViajero === 'infante' ? { tipo: 'registro_civil', caras: UNA_CARA } : { tipo: 'cedula', caras: DOS_CARAS })
  }
  if (r.pasaporte && tipoViajero !== 'adulto' && !out.some(d => d.tipo === 'registro_civil')) {
    out.push({ tipo: 'registro_civil', caras: UNA_CARA })
  }
  if (r.visa) out.push({ tipo: 'visa', caras: UNA_CARA })
  return out
}

/** Nombre del documento para ese viajero (la "cédula" de un menor es su tarjeta de identidad). */
export function etiquetaDocumento(tipo: TipoDocumento, tipoViajero: TipoViajero): string {
  if (tipo === 'cedula') return tipoViajero === 'menor' ? 'Tarjeta de identidad' : 'Cédula de ciudadanía'
  return TIPO_LABEL[tipo]
}

/** La cara que guarda la lectura y la confirmación de un documento. */
export function esCaraPrincipal(cara: Cara): boolean {
  return cara !== 'reverso'
}

/**
 * Progreso común (servidor, panel y portal): un documento cuenta cuando su
 * cara principal está confirmada (confirmar exige antes todas sus caras).
 */
export function calcularProgreso(
  viajeros: number,
  tiposViajero: readonly (string | null | undefined)[] | null | undefined,
  requisitos: Requisitos,
  archivos: readonly { viajero: number; tipo: TipoDocumento; cara?: Cara | null; confirmado_en: string | null }[]
): { requeridos: number; confirmados: number; subidos: number; completo: boolean } {
  let requeridos = 0
  let confirmados = 0
  let subidos = 0
  for (let n = 1; n <= viajeros; n++) {
    for (const d of documentosDe(tipoViajeroDe(tiposViajero, n), requisitos)) {
      requeridos++
      const propios = archivos.filter(a => a.viajero === n && a.tipo === d.tipo)
      if (propios.length > 0) subidos++
      if (propios.some(a => esCaraPrincipal(a.cara ?? 'unica') && a.confirmado_en)) confirmados++
    }
  }
  return { requeridos, confirmados, subidos, completo: requeridos > 0 && confirmados >= requeridos }
}

/** Edad cumplida en una fecha (ISO YYYY-MM-DD). */
export function edadEn(nacimiento: string, fecha: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const [ny, nm, nd] = nacimiento.split('-').map(Number)
  const [fy, fm, fd] = fecha.split('-').map(Number)
  let edad = fy - ny
  if (fm < nm || (fm === nm && fd < nd)) edad--
  return edad >= 0 && edad < 130 ? edad : null
}

export function tipoViajeroPorEdad(edad: number): TipoViajero {
  return edad >= 18 ? 'adulto' : edad >= 7 ? 'menor' : 'infante'
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

/**
 * Opciones del campo de oportunidad `P{n} - Tipo de documento` (SINGLE_OPTIONS,
 * creado con scripts/ghl-crear-campos-documentos-panel.mjs). El texto debe ser
 * IDÉNTICO al de GHL: si se edita aquí, editarlo también allá.
 */
export const OPCIONES_TIPO_DOCUMENTO_GHL = {
  CC: 'Cédula de ciudadanía (CC)',
  TI: 'Tarjeta de identidad (TI)',
  RC: 'Registro civil (RC)',
  PA: 'Pasaporte (PA)',
  CE: 'Cédula de extranjería (CE)',
  PPT: 'Permiso de protección temporal (PPT)',
} as const

/**
 * Qué tipo de documento queda en `P{n} - Tipo de documento` al confirmar uno.
 * En viajes internacionales manda el pasaporte (es el documento de viaje): la
 * cédula/TI/registro civil no lo pisan. null = este documento no lo define.
 */
export function tipoDocumentoGhl(
  tipo: TipoDocumento,
  subtipo: string | undefined,
  requisitos: Requisitos
): string | null {
  if (tipo === 'pasaporte') return OPCIONES_TIPO_DOCUMENTO_GHL.PA
  if (tipo === 'visa' || requisitos.pasaporte) return null
  if (tipo === 'registro_civil') return OPCIONES_TIPO_DOCUMENTO_GHL.RC
  const s = (subtipo ?? '').toUpperCase()
  if (s === 'TI') return OPCIONES_TIPO_DOCUMENTO_GHL.TI
  if (s === 'CE') return OPCIONES_TIPO_DOCUMENTO_GHL.CE
  if (s === 'PPT') return OPCIONES_TIPO_DOCUMENTO_GHL.PPT
  if (s === 'PASAPORTE') return OPCIONES_TIPO_DOCUMENTO_GHL.PA
  return OPCIONES_TIPO_DOCUMENTO_GHL.CC
}
