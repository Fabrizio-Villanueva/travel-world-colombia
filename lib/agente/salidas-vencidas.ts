/**
 * Salidas que un texto (el de un anuncio de Meta, o un mensaje de Sol) menciona
 * y que ya pasaron.
 *
 * Los anuncios se quedan publicados más tiempo que sus fechas: el de Disney
 * seguía ofreciendo "Salida el 04 de octubre de 2026" después del 04-oct, y Sol
 * la ofreció porque lo único que sabe de un producto fuera del catálogo es el
 * texto del anuncio. Esto detecta esas fechas para avisarle a Sol que NO las
 * ofrezca. Función pura: sin red ni base de datos.
 *
 * Reconoce "30 de noviembre de 2026", "4 de octubre", "04 oct", "1° de
 * diciembre", listas de días ("1 y 4 de octubre", "3, 10 y 17 de enero"), meses
 * sueltos ("viajar en septiembre") y mes con año aunque el año lleve punto de
 * miles ("marzo de 2.026", como lo escribe el anuncio del Norwegian Luna: así
 * se le escapó a Sol el 11-oct). Sin año, una fecha se da por vencida solo si
 * cayó en los últimos `MESES_ATRAS` meses: "enero" leído en octubre es el
 * enero que viene, no el que pasó.
 */

const MESES: Record<string, number> = {
  ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3, may: 4, mayo: 4,
  jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, septiembre: 8, setiembre: 8,
  oct: 9, octubre: 9, nov: 10, noviembre: 10, dic: 11, diciembre: 11,
}

const MESES_ATRAS = 4

const NOMBRE_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|')
/** Año de 4 cifras, también con punto de miles ("2.026"). */
const ANIO = String.raw`(\d\.?\d{3})`
/**
 * "30 de noviembre de 2026", "4 oct", "1° de diciembre del 2026" y listas
 * ("1 y 4 de octubre"): el grupo 1 trae los días anteriores de la lista.
 */
const RE_DIA_MES = new RegExp(
  String.raw`\b((?:\d{1,2}\s*(?:,|y|e)\s*)*)(\d{1,2})\s*[°º]?\s*(?:de\s+)?(${NOMBRE_MES})\.?(?:\s+(?:de|del)?\s*${ANIO})?\b`,
  'gi'
)
/** "en septiembre", "para septiembre de 2026", "salidas de octubre", "marzo de 2026", "marzo 2026" (mes sin día) */
const MESES_COMPLETOS = 'septiembre|setiembre|noviembre|diciembre|octubre|febrero|agosto|enero|marzo|abril|junio|julio|mayo'
const RE_MES_SUELTO = new RegExp(
  String.raw`\b(?:(?:en|para|de|desde)\s+(${MESES_COMPLETOS})(?:\s+(?:(?:de|del)\s+)?${ANIO})?|(${MESES_COMPLETOS})\s+(?:(?:de|del)\s+)?${ANIO})\b`,
  'gi'
)

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** "2.026" → 2026 */
const anio = (s: string) => Number(s.replace('.', ''))

/** Inicio del día en Bogotá como "YYYY-MM-DD" (comparación de texto = comparación de fecha). */
function isoBogota(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

function iso(a: number, mes: number, dia: number): string {
  return `${a}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Sin año: ¿la fecha cayó en los últimos MESES_ATRAS meses (antes de hoy)? */
function vencidaSinAnio(mes: number, dia: number, hoy: string): boolean {
  const [a, m] = hoy.split('-').map(Number)
  const anioFecha = mes + 1 <= m ? a : a - 1 // la ocurrencia más reciente de ese mes
  const fecha = iso(anioFecha, mes, dia)
  const mesesAtras = (a - anioFecha) * 12 + (m - 1 - mes)
  return fecha < hoy && mesesAtras < MESES_ATRAS
}

export function salidasVencidas(texto: string | undefined, ahora: Date = new Date()): string[] {
  if (!texto) return []
  const hoy = isoBogota(ahora)
  // NFD + quitar diacríticos no cambia la longitud de los caracteres base que
  // importan aquí; los índices de `plano` sirven para recortar `texto`.
  const plano = normalizar(texto)
  const vencidas: string[] = []
  const tomadas: Array<[number, number]> = []

  for (const m of plano.matchAll(RE_DIA_MES)) {
    const mes = MESES[m[3]]
    if (mes === undefined) continue
    const previos = [...(m[1] ?? '').matchAll(/\d{1,2}/g)].map(x => Number(x[0]))
    const dias = [...previos, Number(m[2])]
    if (dias.some(d => d < 1 || d > 31)) continue
    tomadas.push([m.index!, m.index! + m[0].length])
    const original = texto.slice(m.index!, m.index! + m[0].length).trim()
    // En una lista se nombra cada día por separado ("1 de octubre", "4 de octubre").
    const colaMes = original.slice(original.search(new RegExp(String.raw`\d{1,2}\s*[°º]?\s*(?:de\s+)?\p{L}+\.?(?:\s+(?:de|del)?\s*\d\.?\d{3})?$`, 'u')))
      .replace(/^\d{1,2}\s*[°º]?\s*/, '')
    for (const dia of dias) {
      const vencida = m[4] ? iso(anio(m[4]), mes, dia) < hoy : vencidaSinAnio(mes, dia, hoy)
      if (vencida) vencidas.push(dias.length > 1 ? `${dia} ${colaMes}` : original)
    }
  }

  for (const m of plano.matchAll(RE_MES_SUELTO)) {
    const ini = m.index!
    if (tomadas.some(([a, b]) => ini < b && ini + m[0].length > a)) continue
    const mes = MESES[m[1] ?? m[3]]
    const anioTexto = m[2] ?? m[4]
    if (mes === undefined) continue
    // Un mes entero vence cuando ya pasó su último día.
    const ultimoDia = new Date(Date.UTC(2001, mes + 1, 0)).getUTCDate()
    const vencida = anioTexto
      ? iso(anio(anioTexto), mes, ultimoDia) < hoy
      : vencidaSinAnio(mes, ultimoDia, hoy)
    if (vencida) vencidas.push(texto.slice(ini, ini + m[0].length).trim())
  }

  return [...new Set(vencidas)]
}
