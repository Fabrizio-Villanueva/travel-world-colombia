import Anthropic from '@anthropic-ai/sdk'
import type { TipoDocumento } from '@/lib/documentos/config'
import type { DatosDocumento, ResultadoLectura } from '@/lib/documentos/tipos'
import { parsearMrz, parsearMrzTd1, nacionalidadLegible } from '@/lib/documentos/mrz'

/**
 * Lectura automática de documentos (Fase 2 del portal).
 *
 * Una sola llamada de visión por documento (si tiene dos caras, van las dos
 * imágenes en la misma llamada). El modelo devuelve JSON con:
 *  - las líneas MRZ transcritas TAL CUAL (si el documento las tiene), y
 *  - los campos visibles como respaldo.
 * Para pasaportes (y visas con MRZ) manda la MRZ validada con sus dígitos de
 * control (lib/documentos/mrz.ts): es determinística y no depende de que el
 * modelo "interprete" bien. Si la MRZ no cuadra, se usan los campos visibles
 * con la confianza que reporta el modelo. SIEMPRE se confirma con el cliente
 * antes de escribir en GHL; con confianza baja se marca para la asesora.
 */

/**
 * Opus 5.5: lee mejor letra pequeña y documentos con brillo que modelos más
 * baratos, y el costo por documento (~1 imagen + 500 tokens de salida) ronda
 * 1-2 centavos de dólar, dentro de lo estimado en el plan.
 */
const MODELO = 'claude-opus-5-5'

/** Tipos de imagen que acepta la API de visión. HEIC se convierte en el navegador. */
const MIMES_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES_MODELO = 5 * 1024 * 1024
/** PDF: hasta 1,5 MB (escaneo de 1-2 páginas). */
const MAX_BYTES_PDF = 1.5 * 1024 * 1024

let cliente: Anthropic | null = null
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  cliente ??= new Anthropic()
  return cliente
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'legible',
    'tipo_detectado',
    'mrz_linea1',
    'mrz_linea2',
    'mrz_linea3',
    'nombres',
    'apellidos',
    'numero',
    'nacionalidad',
    'fecha_nacimiento',
    'sexo',
    'fecha_vencimiento',
    'pais_emisor',
    'tipo_documento',
    'documento_identidad',
    'confianza',
    'observaciones',
  ],
  properties: {
    legible: {
      type: 'boolean',
      description: 'false si la imagen no muestra un documento de identidad/viaje legible (borrosa, cortada, otra cosa).',
    },
    tipo_detectado: {
      type: 'string',
      enum: ['pasaporte', 'cedula', 'tarjeta_identidad', 'registro_civil', 'visa', 'otro'],
    },
    mrz_linea1: {
      type: 'string',
      description:
        'Primera línea de la zona de lectura mecánica (la franja de letras y "<" al pie del pasaporte o de la visa), transcrita carácter por carácter, idealmente 44 caracteres, sin espacios. Si la franja se ve solo en parte, transcribe lo que se vea (se valida aparte con dígitos de control). Cadena vacía solo si el documento no tiene MRZ.',
    },
    mrz_linea2: { type: 'string', description: 'Segunda línea de la MRZ, igual que la primera. Vacía si no hay.' },
    mrz_linea3: {
      type: 'string',
      description:
        'Tercera línea de la MRZ: solo en documentos tamaño tarjeta (cédula digital: 3 líneas de 30 caracteres en el reverso). Vacía si la MRZ tiene 2 líneas o no hay.',
    },
    nombres: { type: 'string', description: 'Nombres (sin apellidos) tal como aparecen impresos. Vacío si no se ve.' },
    apellidos: { type: 'string', description: 'Apellidos tal como aparecen impresos. Vacío si no se ve.' },
    numero: {
      type: 'string',
      description:
        'Número del documento (pasaporte, cédula o visa) sin puntos ni espacios. En cédulas y tarjetas de identidad es el NUIP / número de identificación personal impreso (no el serial de la tarjeta). En el registro civil es el NUIP (si no tiene, el indicativo serial). En visas de EE. UU. es el "Visa number" impreso en rojo abajo a la derecha (8 dígitos), NO el Control Number. Vacío si no se ve.',
    },
    nacionalidad: { type: 'string', description: 'Nacionalidad como aparece (p. ej. COLOMBIANA). Vacío si no aplica.' },
    fecha_nacimiento: { type: 'string', description: 'YYYY-MM-DD, o vacío si no se ve.' },
    sexo: { type: 'string', enum: ['M', 'F', ''] },
    fecha_vencimiento: { type: 'string', description: 'YYYY-MM-DD, o vacío si no aplica o no se ve.' },
    pais_emisor: { type: 'string', description: 'País que emite el documento o la visa, en español. Vacío si no se ve.' },
    tipo_documento: {
      type: 'string',
      description:
        'Cédula: CC, TI, CE, PPT u otro. Visa: tipo/categoría impresa (p. ej. B1/B2, Schengen C, Residente temporal). Pasaporte: vacío.',
    },
    documento_identidad: {
      type: 'string',
      description: 'En pasaportes: número de cédula impreso (en Colombia aparece junto al número de pasaporte). Vacío si no aplica.',
    },
    confianza: {
      type: 'string',
      enum: ['alta', 'media', 'baja'],
      description: 'Qué tan seguro estás de los campos transcritos. Baja si hay brillo, desenfoque o dudas en dígitos.',
    },
    observaciones: { type: 'string', description: 'Una frase: qué no se ve bien o por qué dudas. Vacío si todo claro.' },
  },
} as const

const INSTRUCCIONES = `Eres un lector de documentos de identidad y viaje para una agencia de viajes colombiana.
Recibes la foto de UN documento: pasaporte, cédula de ciudadanía / tarjeta de identidad (Colombia u otro país), registro civil de nacimiento o visa.
Si llegan dos imágenes, son el FRENTE y el REVERSO del mismo documento: combina los datos de ambas.
Tu trabajo es TRANSCRIBIR, nunca inventar: si un dato no se lee, déjalo vacío.
Reglas:
- Si el documento tiene zona de lectura mecánica (dos o tres líneas de letras, dígitos y "<"; en la cédula digital colombiana está en el reverso), transcríbela carácter por carácter: distingue la letra O del dígito 0 por el contexto (en fechas y números de control solo hay dígitos). Esa franja es lo más importante.
- Fechas siempre en formato YYYY-MM-DD. Los documentos colombianos imprimen día-mes-año; los pasaportes suelen imprimir el mes en letras.
- Números sin puntos, guiones ni espacios.
- Nombres y apellidos tal como están impresos (mayúsculas está bien).
- No describas a la persona ni la foto; no opines. Solo los campos del esquema.`

interface SalidaModelo {
  legible: boolean
  tipo_detectado: 'pasaporte' | 'cedula' | 'tarjeta_identidad' | 'registro_civil' | 'visa' | 'otro'
  mrz_linea1: string
  mrz_linea2: string
  mrz_linea3: string
  nombres: string
  apellidos: string
  numero: string
  nacionalidad: string
  fecha_nacimiento: string
  sexo: string
  fecha_vencimiento: string
  pais_emisor: string
  tipo_documento: string
  documento_identidad: string
  confianza: 'alta' | 'media' | 'baja'
  observaciones: string
}

function limpiarTexto(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function limpiarNumero(s: string | undefined): string {
  return (s ?? '').replace(/[\s.\-]/g, '').toUpperCase()
}

function fechaOk(s: string | undefined): string {
  const t = (s ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''
}

/** Resultado "manual": no se pudo leer; el cliente escribe los datos a mano. */
function manual(observaciones: string): ResultadoLectura {
  return { metodo: 'manual', confianza: 'baja', datos: {}, revision: true, observaciones }
}

export interface ImagenDocumento {
  bytes: Buffer
  mime: string
  /** frente | reverso | unica (para decirle al modelo qué es cada imagen). */
  cara: string
}

/**
 * Lee un documento (una o dos imágenes: frente y reverso). `tipoEsperado` es
 * lo que el viaje pidió para esa casilla; si el documento parece otra cosa se
 * marca para revisión (no se rechaza: a veces la casilla está mal marcada y la
 * asesora lo resuelve).
 */
export async function leerDocumento(
  imagenes: ImagenDocumento[],
  tipoEsperado: TipoDocumento
): Promise<ResultadoLectura> {
  if (imagenes.length === 0) return manual('No hay imagen para leer.')
  const bloques: Anthropic.ContentBlockParam[] = []
  for (const img of imagenes) {
    if (img.bytes.length > MAX_BYTES_MODELO) {
      return manual('La imagen es muy pesada para leerla automáticamente. Escribe los datos a mano, por favor.')
    }
    const esPdf = img.mime === 'application/pdf'
    // PDF: solo los livianos (un escaneo de 1-2 páginas). Un PDF pesado puede
    // traer decenas de páginas y cada una cuesta como una imagen (auditoría #3).
    if (esPdf && img.bytes.length > MAX_BYTES_PDF) {
      return manual('Ese PDF es muy pesado para leerlo automáticamente. Mejor toma una foto del documento, o escribe los datos a mano.')
    }
    if (!esPdf && !MIMES_IMAGEN.has(img.mime)) {
      return manual('Ese formato de imagen no se puede leer automáticamente (toma la foto con la cámara o súbela en JPG).')
    }
    const data = img.bytes.toString('base64')
    if (imagenes.length > 1) bloques.push({ type: 'text', text: img.cara === 'reverso' ? 'REVERSO:' : 'FRENTE:' })
    bloques.push(
      esPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : {
            type: 'image',
            source: { type: 'base64', media_type: img.mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data },
          }
    )
  }

  const respuesta = await anthropic().messages.create({
    model: MODELO,
    max_tokens: 2000,
    system: INSTRUCCIONES,
    messages: [
      {
        role: 'user',
        content: [
          ...bloques,
          {
            type: 'text',
            text: `El viaje pide: ${tipoEsperado}. Transcribe el documento ${imagenes.length > 1 ? '(frente y reverso)' : 'de la imagen'} según el esquema.`,
          },
        ],
      },
    ],
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: ESQUEMA as never },
    },
  })

  if (respuesta.stop_reason === 'refusal') {
    return manual('No fue posible leer este documento automáticamente. Escribe los datos a mano, por favor.')
  }
  const texto = respuesta.content.find(b => b.type === 'text')
  if (!texto || texto.type !== 'text') return manual('No se obtuvo lectura del documento.')

  let salida: SalidaModelo
  try {
    salida = JSON.parse(texto.text) as SalidaModelo
  } catch {
    return manual('La lectura automática devolvió un formato inesperado.')
  }

  if (!salida.legible) {
    return manual(
      salida.observaciones || 'La foto no se ve con claridad. Intenta con más luz, sin brillo y con el documento completo.'
    )
  }

  const tipoCoincide =
    (tipoEsperado === 'pasaporte' && salida.tipo_detectado === 'pasaporte') ||
    (tipoEsperado === 'cedula' && (salida.tipo_detectado === 'cedula' || salida.tipo_detectado === 'tarjeta_identidad')) ||
    (tipoEsperado === 'visa' && salida.tipo_detectado === 'visa') ||
    (tipoEsperado === 'registro_civil' && salida.tipo_detectado === 'registro_civil')

  // 1) MRZ determinística (pasaportes y visas con franja).
  const mrz = parsearMrz([salida.mrz_linea1, salida.mrz_linea2])
  if (mrz && mrz.valido && (tipoEsperado === 'pasaporte' || tipoEsperado === 'visa')) {
    const datos: DatosDocumento =
      tipoEsperado === 'pasaporte'
        ? {
            nombres: mrz.nombres || limpiarTexto(salida.nombres),
            apellidos: mrz.apellidos || limpiarTexto(salida.apellidos),
            numero: mrz.numero,
            nacionalidad: nacionalidadLegible(mrz.nacionalidad),
            fecha_nacimiento: mrz.fechaNacimiento || fechaOk(salida.fecha_nacimiento),
            sexo: mrz.sexo || (salida.sexo === 'M' || salida.sexo === 'F' ? salida.sexo : ''),
            fecha_vencimiento: mrz.fechaVencimiento || fechaOk(salida.fecha_vencimiento),
            documento_identidad: mrz.numeroPersonal || limpiarNumero(salida.documento_identidad),
          }
        : {
            pais_emisor: limpiarTexto(salida.pais_emisor) || mrz.paisEmisor,
            tipo_documento: limpiarTexto(salida.tipo_documento),
            numero: mrz.numero,
            nombres: mrz.nombres || limpiarTexto(salida.nombres),
            apellidos: mrz.apellidos || limpiarTexto(salida.apellidos),
            fecha_vencimiento: mrz.fechaVencimiento || fechaOk(salida.fecha_vencimiento),
          }
    return {
      metodo: 'mrz',
      confianza: 'alta',
      datos,
      revision: !tipoCoincide,
      observaciones: tipoCoincide ? '' : `Parece ${salida.tipo_detectado}, no ${tipoEsperado}.`,
      tipo_detectado: salida.tipo_detectado,
    }
  }

  // 1b) MRZ TD1 de la cédula digital (reverso): nombres y fechas verificados.
  // El número se toma del impreso (NUIP) y se coteja con la franja.
  const td1 = tipoEsperado === 'cedula' ? parsearMrzTd1([salida.mrz_linea1, salida.mrz_linea2, salida.mrz_linea3]) : null
  if (td1 && td1.valido) {
    const numeroImpreso = limpiarNumero(salida.numero)
    const numeroEnFranja =
      Boolean(numeroImpreso) && (td1.numero === numeroImpreso || td1.numerosOpcionales.some(n => n.includes(numeroImpreso)))
    const datos: DatosDocumento = {
      tipo_documento:
        limpiarTexto(salida.tipo_documento) || (salida.tipo_detectado === 'tarjeta_identidad' ? 'TI' : 'CC'),
      numero: numeroImpreso,
      nombres: td1.nombres || limpiarTexto(salida.nombres),
      apellidos: td1.apellidos || limpiarTexto(salida.apellidos),
      fecha_nacimiento: td1.fechaNacimiento || fechaOk(salida.fecha_nacimiento),
    }
    return {
      metodo: 'mrz',
      confianza: numeroEnFranja ? 'alta' : 'media',
      datos,
      revision: !tipoCoincide || !numeroImpreso,
      observaciones: [
        tipoCoincide ? '' : `Parece ${salida.tipo_detectado}, no ${tipoEsperado}.`,
        numeroImpreso ? '' : 'No se leyó el número del documento: escríbelo, por favor.',
      ]
        .filter(Boolean)
        .join(' '),
      tipo_detectado: salida.tipo_detectado,
    }
  }

  // 2) Campos visibles leídos por el modelo.
  const datos: DatosDocumento =
    tipoEsperado === 'pasaporte'
      ? {
          nombres: limpiarTexto(salida.nombres),
          apellidos: limpiarTexto(salida.apellidos),
          numero: limpiarNumero(salida.numero),
          nacionalidad: limpiarTexto(salida.nacionalidad),
          fecha_nacimiento: fechaOk(salida.fecha_nacimiento),
          sexo: salida.sexo === 'M' || salida.sexo === 'F' ? salida.sexo : '',
          fecha_vencimiento: fechaOk(salida.fecha_vencimiento),
          documento_identidad: limpiarNumero(salida.documento_identidad),
        }
      : tipoEsperado === 'registro_civil'
        ? {
            numero: limpiarNumero(salida.numero),
            nombres: limpiarTexto(salida.nombres),
            apellidos: limpiarTexto(salida.apellidos),
            fecha_nacimiento: fechaOk(salida.fecha_nacimiento),
            sexo: salida.sexo === 'M' || salida.sexo === 'F' ? salida.sexo : '',
          }
        : tipoEsperado === 'cedula'
        ? {
            tipo_documento: limpiarTexto(salida.tipo_documento) || (salida.tipo_detectado === 'tarjeta_identidad' ? 'TI' : 'CC'),
            numero: limpiarNumero(salida.numero),
            nombres: limpiarTexto(salida.nombres),
            apellidos: limpiarTexto(salida.apellidos),
            fecha_nacimiento: fechaOk(salida.fecha_nacimiento),
          }
        : {
            pais_emisor: limpiarTexto(salida.pais_emisor),
            tipo_documento: limpiarTexto(salida.tipo_documento),
            numero: limpiarNumero(salida.numero),
            nombres: limpiarTexto(salida.nombres),
            apellidos: limpiarTexto(salida.apellidos),
            fecha_vencimiento: fechaOk(salida.fecha_vencimiento),
          }

  const sinDatos = Object.values(datos).every(v => !v)
  if (sinDatos) return manual(salida.observaciones || 'No se pudieron leer los datos. Escríbelos a mano, por favor.')

  const confianza = salida.confianza ?? 'media'
  const observaciones = [
    tipoCoincide ? '' : `Parece ${salida.tipo_detectado}, no ${tipoEsperado}.`,
    mrz && !mrz.valido ? 'La franja MRZ no cuadró con sus dígitos de control.' : '',
    limpiarTexto(salida.observaciones),
  ]
    .filter(Boolean)
    .join(' ')

  return {
    metodo: 'vision',
    confianza,
    datos,
    revision: confianza === 'baja' || !tipoCoincide,
    observaciones,
    tipo_detectado: salida.tipo_detectado,
  }
}
