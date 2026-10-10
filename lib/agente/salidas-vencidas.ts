/**
 * Salidas que un texto (el de un anuncio de Meta) menciona y que ya pasaron.
 *
 * Los anuncios se quedan publicados más tiempo que sus fechas: el de Disney
 * seguía ofreciendo "Salida el 04 de octubre de 2026" después del 04-oct, y Sol
 * la ofreció porque lo único que sabe de un producto fuera del catálogo es el
 * texto del anuncio. Esto detecta esas fechas para avisarle a Sol que NO las
 * ofrezca. Función pura: sin red ni base de datos.
 *
 * Reconoce "30 de noviembre de 2026", "4 de octubre", "04 oct", "1° de
 * diciembre" y meses sueltos ("viajar en septiembre"). Sin año, una fecha se
 * da por vencida solo si cayó en los últimos `MESES_ATRAS` meses: "enero"
 * leído en octubre es el enero que viene, no el que pasó.
 */

const MESES: Record<string, number> = {
  ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3, may: 4, mayo: 4,
  jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, septiembre: 8, setiembre: 8,
  oct: 9, octubre: 9, nov: 10, noviembre: 10, dic: 11, diciembre: 11,
}

const MESES_ATRAS = 4

const NOMBRE_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|')
/** "30 de noviembre de 2026", "4 oct", "1° de diciembre del 2026" */
const RE_DIA_MES = new RegExp(`\\b(\\d{1,2})\\s*[°º]?\\s*(?:de\\s+)?(${NOMBRE_MES})\\.?(?:\\s+(?:de|del)?\\s*(\\d{4}))?\\b`, 'gi')
/** "en septiembre", "para septiembre de 2026", "salidas de octubre" (mes sin día) */
const MESES_COMPLETOS = 'septiembre|setiembre|noviembre|diciembre|octubre|febrero|agosto|enero|marzo|abril|junio|julio|mayo'
const RE_MES_SUELTO = new RegExp(`\\b(?:en|para|de|desde)\\s+(${MESES_COMPLETOS})(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`, 'gi')

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Inicio del día en Bogotá como "YYYY-MM-DD" (comparación de texto = comparación de fecha). */
function isoBogota(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Sin año: ¿la fecha cayó en los últimos MESES_ATRAS meses (antes de hoy)? */
function vencidaSinAnio(mes: number, dia: number, hoy: string): boolean {
  const [a, m] = hoy.split('-').map(Number)
  const anio = mes + 1 <= m ? a : a - 1 // la ocurrencia más reciente de ese mes
  const fecha = iso(anio, mes, dia)
  const mesesAtras = (a - anio) * 12 + (m - 1 - mes)
  return fecha < hoy && mesesAtras < MESES_ATRAS
}

export function salidasVencidas(texto: string | undefined, ahora: Date = new Date()): string[] {
  if (!texto) return []
  const hoy = isoBogota(ahora)
  const plano = normalizar(texto)
  const vencidas: string[] = []
  const tomadas: Array<[number, number]> = []

  for (const m of plano.matchAll(RE_DIA_MES)) {
    const dia = Number(m[1])
    const mes = MESES[m[2]]
    if (mes === undefined || dia < 1 || dia > 31) continue
    tomadas.push([m.index!, m.index! + m[0].length])
    const vencida = m[3] ? iso(Number(m[3]), mes, dia) < hoy : vencidaSinAnio(mes, dia, hoy)
    if (vencida) vencidas.push(texto.slice(m.index!, m.index! + m[0].length).trim())
  }

  for (const m of plano.matchAll(RE_MES_SUELTO)) {
    const ini = m.index!
    if (tomadas.some(([a, b]) => ini < b && ini + m[0].length > a)) continue
    const mes = MESES[m[1]]
    if (mes === undefined) continue
    // Un mes entero vence cuando ya pasó su último día.
    const ultimoDia = new Date(Date.UTC(2001, mes + 1, 0)).getUTCDate()
    const vencida = m[2]
      ? iso(Number(m[2]), mes, ultimoDia) < hoy
      : vencidaSinAnio(mes, ultimoDia, hoy)
    if (vencida) vencidas.push(texto.slice(ini, ini + m[0].length).trim())
  }

  return [...new Set(vencidas)]
}
