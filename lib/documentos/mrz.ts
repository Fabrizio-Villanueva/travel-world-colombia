/**
 * Lectura DETERMINÍSTICA de la zona de lectura mecánica (MRZ) de pasaportes
 * (TD3: 2 líneas × 44 caracteres) y visas de formato pasaporte (MRV-A).
 *
 * El modelo de visión solo TRANSCRIBE las dos líneas; aquí se validan los
 * dígitos de control (ICAO 9303, pesos 7-3-1) y se extraen los campos. Si los
 * tres controles de la línea 2 (número, nacimiento, vencimiento) cuadran, el
 * dato es confiable sin depender de la interpretación del modelo.
 */

export interface Mrz {
  tipo: 'P' | 'V'
  paisEmisor: string
  apellidos: string
  nombres: string
  numero: string
  nacionalidad: string
  /** YYYY-MM-DD o '' si no se pudo armar. */
  fechaNacimiento: string
  sexo: 'M' | 'F' | ''
  fechaVencimiento: string
  /** Campo personal (en el pasaporte colombiano: la cédula). */
  numeroPersonal: string
  controles: { numero: boolean; nacimiento: boolean; vencimiento: boolean; compuesto: boolean | null }
  /** Los controles de número, nacimiento y vencimiento cuadran. */
  valido: boolean
}

function valor(c: string): number {
  if (c === '<') return 0
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  return c.charCodeAt(0) - 55 // A=10 … Z=35
}

export function digitoControl(s: string): number {
  const pesos = [7, 3, 1]
  let suma = 0
  for (let i = 0; i < s.length; i++) suma += valor(s[i]) * pesos[i % 3]
  return suma % 10
}

function controlOk(campo: string, digito: string): boolean {
  if (!/^\d$/.test(digito)) return false
  return digitoControl(campo) === Number(digito)
}

/** Deja solo A-Z, 0-9 y '<' (el modelo a veces mete espacios o minúsculas). */
function limpiar(linea: string): string {
  return linea.toUpperCase().replace(/[^A-Z0-9<]/g, '')
}

/** Confusiones típicas de OCR en posiciones que deben ser dígitos. */
const A_DIGITO: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' }
function numerico(s: string): string {
  return s.replace(/[A-Z]/g, c => A_DIGITO[c] ?? c)
}

/** YYMMDD → YYYY-MM-DD. `futuro` decide el siglo (vencimientos son 20xx). */
function fechaIso(yymmdd: string, futuro: boolean): string {
  const s = numerico(yymmdd)
  if (!/^\d{6}$/.test(s)) return ''
  const yy = Number(s.slice(0, 2))
  const mm = Number(s.slice(2, 4))
  const dd = Number(s.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  let siglo = 2000
  if (!futuro) {
    const actualYY = new Date().getFullYear() % 100
    siglo = yy > actualYY ? 1900 : 2000
  }
  return `${siglo + yy}-${s.slice(2, 4)}-${s.slice(4, 6)}`
}

function nombreLegible(s: string): string {
  return s.replace(/</g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parsea una MRZ TD3 (pasaporte) o MRV-A (visa). Devuelve null si las líneas
 * no tienen la forma esperada. Acepta líneas con pequeños errores de
 * transcripción: las rellena/recorta a 44 y corrige confusiones O/0 en los
 * campos numéricos antes de validar.
 */
export function parsearMrz(lineas: string[] | null | undefined): Mrz | null {
  if (!lineas) return null
  const limpias = lineas.map(limpiar).filter(l => l.length >= 30)
  if (limpias.length < 2) return null
  // Si el modelo partió una línea en dos, se intenta reunir las 2 más largas.
  const [l1raw, l2raw] = limpias.length === 2 ? limpias : [...limpias].sort((a, b) => b.length - a.length).slice(0, 2)
  const orden = l1raw.startsWith('P') || l1raw.startsWith('V') ? [l1raw, l2raw] : [l2raw, l1raw]
  const l1 = orden[0].padEnd(44, '<').slice(0, 44)
  const l2 = orden[1].padEnd(44, '<').slice(0, 44)

  const tipo = l1[0]
  if (tipo !== 'P' && tipo !== 'V') return null

  const paisEmisor = l1.slice(2, 5).replace(/</g, '')
  const [apellidosRaw, ...nombresRaw] = l1.slice(5).split('<<')
  const apellidos = nombreLegible(apellidosRaw)
  const nombres = nombreLegible(nombresRaw.join(' '))

  const numeroCampo = l2.slice(0, 9)
  const numeroCtrl = numerico(l2[9])
  const nacionalidad = l2.slice(10, 13).replace(/</g, '')
  const nacCampo = numerico(l2.slice(13, 19))
  const nacCtrl = numerico(l2[19])
  const sexoRaw = l2[20]
  const venCampo = numerico(l2.slice(21, 27))
  const venCtrl = numerico(l2[27])

  const controles = {
    numero: controlOk(numeroCampo, numeroCtrl),
    nacimiento: controlOk(nacCampo, nacCtrl),
    vencimiento: controlOk(venCampo, venCtrl),
    compuesto: null as boolean | null,
  }

  let numeroPersonal = ''
  if (tipo === 'P') {
    const personal = l2.slice(28, 42)
    const personalCtrl = numerico(l2[42])
    const compuestoCtrl = numerico(l2[43])
    // El control del campo personal puede ser '<' cuando el campo va vacío.
    const personalOk = personal.replace(/</g, '') === '' || controlOk(personal, personalCtrl)
    const compuestoOk = controlOk(
      numeroCampo + numeroCtrl + nacCampo + nacCtrl + venCampo + venCtrl + personal + personalCtrl,
      compuestoCtrl
    )
    controles.compuesto = personalOk && compuestoOk
    numeroPersonal = personal.replace(/</g, '')
  }

  const sexo: Mrz['sexo'] = sexoRaw === 'M' || sexoRaw === 'F' ? sexoRaw : ''

  return {
    tipo,
    paisEmisor,
    apellidos,
    nombres,
    numero: numeroCampo.replace(/</g, ''),
    nacionalidad,
    fechaNacimiento: fechaIso(nacCampo, false),
    sexo,
    fechaVencimiento: fechaIso(venCampo, true),
    numeroPersonal,
    controles,
    valido: controles.numero && controles.nacimiento && controles.vencimiento,
  }
}

/** Gentilicio en español para los códigos ICAO más comunes en la agencia. */
const NACIONALIDADES: Record<string, string> = {
  COL: 'Colombiana',
  VEN: 'Venezolana',
  ECU: 'Ecuatoriana',
  PER: 'Peruana',
  MEX: 'Mexicana',
  USA: 'Estadounidense',
  ESP: 'Española',
  ARG: 'Argentina',
  CHL: 'Chilena',
  BRA: 'Brasileña',
  PAN: 'Panameña',
  CRI: 'Costarricense',
  DOM: 'Dominicana',
  CAN: 'Canadiense',
  ITA: 'Italiana',
  FRA: 'Francesa',
  DEU: 'Alemana',
  GBR: 'Británica',
  CUB: 'Cubana',
}

export function nacionalidadLegible(codigo: string): string {
  return NACIONALIDADES[codigo] ?? codigo
}
