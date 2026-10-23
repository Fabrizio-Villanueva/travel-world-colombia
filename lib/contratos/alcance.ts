/**
 * Alcance del viaje (23-oct-2026): Nacional o Internacional, inferido de lo
 * que la asesora ya escribió (destino, rutas de vuelo, tipo de contrato).
 * El hotel no cuenta: "Hotel Madrid" puede estar en Bogotá. Función pura: el Generador la corre en vivo en el navegador y el
 * valor sale prellenado (azul); si la asesora elige otro, el suyo manda.
 *
 * Internacional = cláusula TRAVELKIT en el contrato + guía al firmar.
 */

export type Alcance = 'Nacional' | 'Internacional'

/** Datos de la base que el servidor le pasa al Generador. */
export interface PistasAlcance {
  /** Países de la tabla de visas (Colombia es el único nacional). */
  paises: string[]
  /** Viajes del catálogo con su país. */
  viajes: { nombre: string; nacional: boolean }[]
}

/** Sin tildes, minúsculas, sin puntuación (igual que lib/documentos/visas.ts). */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lugares y aeropuertos (código IATA) de Colombia que aparecen en destinos y
 * rutas reales del pipeline Reservaciones (medido el 23-oct-2026).
 */
const COLOMBIA = [
  'colombia', 'nacional',
  'bogota', 'medellin', 'cali', 'cartagena', 'barranquilla', 'santa marta', 'san andres', 'providencia',
  'cucuta', 'bucaramanga', 'pereira', 'armenia', 'manizales', 'monteria', 'yopal', 'florencia', 'leticia',
  'riohacha', 'valledupar', 'villavicencio', 'pasto', 'neiva', 'ibague', 'popayan', 'quibdo', 'apartado',
  'tumaco', 'bahia solano', 'nuqui', 'capurgana', 'covenas', 'tolu', 'rincon del mar', 'san gil', 'barichara',
  'villa de leyva', 'guatape', 'doradal', 'eje cafetero', 'quindio', 'salento', 'filandia', 'guajira',
  'cabo de la vela', 'amazonas', 'cano cristales', 'la macarena', 'mompox', 'palomino', 'minca', 'tayrona',
  'santander', 'antioquia', 'hacienda napoles', 'boyaca', 'nariño', 'narino', 'huila', 'meta', 'casanare',
  'bog', 'mde', 'eoh', 'clo', 'ctg', 'baq', 'smr', 'adz', 'pva', 'cuc', 'bga', 'pei', 'axm', 'mzl', 'mtr',
  'eyp', 'flr', 'let', 'rch', 'vup', 'vvc', 'pso', 'nva', 'ibe', 'ppn', 'uib', 'apo', 'tco', 'bsc', 'nqu',
]

/**
 * Señales de viaje al exterior que no son nombres de país de la tabla:
 * ciudades, aeropuertos, regiones y productos (cruceros, asistencia).
 */
const EXTERIOR = [
  'internacional', 'crucero', 'cruise', 'europa', 'asia', 'bahamas', 'asistencia',
  'miami', 'orlando', 'new york', 'nueva york', 'newark', 'fort lauderdale', 'los angeles', 'las vegas',
  'vancouver', 'toronto', 'cancun', 'punta cana', 'curacao', 'madrid', 'barcelona', 'paris', 'roma',
  'londres', 'lisboa', 'amsterdam', 'florencia italia', 'venecia', 'croacia', 'dubai', 'estambul',
  'san salvador', 'santo domingo', 'la habana', 'lima', 'cusco', 'quito', 'buenos aires', 'santiago de chile',
  'viru viru', 'santa cruz de la sierra', 'la paz', 'uyuni', 'ciudad de mexico', 'cdmx', 'disney', 'tampa',
  'rio de janeiro', 'sao paulo', 'atenas', 'santorini', 'el cairo', 'dubrovnik', 'montego bay',
  'mia', 'mco', 'jfk', 'ewr', 'fll', 'lax', 'yvr', 'yyz', 'cun', 'puj', 'cur', 'aua', 'pty', 'blb', 'mad',
  'bcn', 'cdg', 'fco', 'lhr', 'lis', 'ams', 'ist', 'dxb', 'cai', 'sal', 'sdq', 'hav', 'lim', 'cuz', 'uio',
  'eze', 'scl', 'vvi', 'lpb', 'mex', 'gru', 'gig', 'tpa', 'dbv',
  // Países que no siempre están en la tabla de visas ni en el catálogo.
  'argentina', 'bolivia', 'brasil', 'chile', 'ecuador', 'peru', 'venezuela', 'paraguay', 'uruguay', 'mexico',
  'panama', 'costa rica', 'guatemala', 'honduras', 'el salvador', 'nicaragua', 'belice', 'cuba', 'jamaica',
  'republica dominicana', 'puerto rico', 'aruba', 'curazao', 'estados unidos', 'usa', 'canada', 'espana',
  'francia', 'italia', 'portugal', 'alemania', 'inglaterra', 'reino unido', 'grecia', 'turquia', 'egipto',
  'marruecos', 'emiratos', 'japon', 'china', 'tailandia', 'india', 'australia', 'suiza', 'holanda',
  'paises bajos', 'croacia',
]

/**
 * Origen de casi todos los viajes: por sí solo no prueba que el viaje sea
 * nacional (BOG-La Paz es Bolivia). Hace falta otro lugar de Colombia.
 */
const ORIGEN = new Set(['bogota', 'bog'])

/** ¿Aparece la frase como palabras completas dentro del texto? */
const contiene = (texto: string, frase: string) => ` ${texto} `.includes(` ${frase} `)

/** Palabras de relleno que no cuentan al comparar nombres de viajes. */
const RELLENO = new Set(['y', 'de', 'del', 'la', 'las', 'el', 'los', 'en', 'por', 'a'])

/** ¿El texto trae todas las palabras significativas del nombre del viaje? */
function nombraViaje(texto: string, nombre: string): boolean {
  const palabras = normalizar(nombre).split(' ').filter(p => p && !RELLENO.has(p))
  return palabras.length > 0 && palabras.every(p => contiene(texto, p))
}

/**
 * Infiere el alcance. Basta una señal del exterior para que sea Internacional
 * (una ruta BOG-MIA sale de Colombia pero es internacional; un crucero desde
 * Cartagena también). Sin señales del exterior y con un lugar de Colombia
 * (que no sea solo Bogotá, el origen), Nacional. null = no hay con qué
 * saberlo: mejor vacío que un Nacional que deje sin cláusula a quien viaja fuera.
 */
export function inferirAlcance(textos: (string | null | undefined)[], pistas: PistasAlcance): Alcance | null {
  const texto = normalizar(textos.filter(Boolean).join(' '))
  if (!texto) return null

  const paisesFuera = pistas.paises.map(normalizar).filter(p => p && p !== 'colombia')
  const viajes = pistas.viajes.filter(v => nombraViaje(texto, v.nombre))

  const fuera =
    EXTERIOR.some(p => contiene(texto, p)) ||
    paisesFuera.some(p => contiene(texto, p)) ||
    viajes.some(v => !v.nacional)
  if (fuera) return 'Internacional'

  const dentro = COLOMBIA.some(p => !ORIGEN.has(p) && contiene(texto, p)) || viajes.some(v => v.nacional)
  return dentro ? 'Nacional' : null
}

/** Campos de la oportunidad de los que se infiere (nombres exactos de GHL). */
export const CAMPOS_PISTA_ALCANCE = [
  'Destino de interés',
  'T1 - Ruta',
  'T2 - Ruta',
  'T3 - Ruta',
  'T4 - Ruta',
  'Tipo de Contrato',
]
