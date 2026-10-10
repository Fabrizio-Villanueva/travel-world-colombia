'use client'

import { useMemo, useState } from 'react'
import { Loader2, Check, ChevronLeft, ChevronRight, FileSignature, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { RE_CUOTA, esCampoCuota, type CampoReserva, type ValorCampo } from '@/lib/admin/reservas'
import { DIVISAS, divisaDe, enDivisa, type Divisa } from '@/lib/contratos/divisa'
import { guardarReserva } from '../actions'

/**
 * Wizard de reserva: un paso por carpeta del catálogo. Los campos numerados
 * (P1–P20 pasajeros, T1–T4 trayectos, Pago 1–4) se muestran como grupos
 * repetibles controlados por un contador — el representante nunca ve 48
 * campos planos.
 */

interface Props {
  opportunityId: string
  campos: CampoReserva[]
  valoresIniciales: Record<string, ValorCampo>
  prefill: Record<string, ValorCampo>
}

/** Prefijo de grupo: "P3 - Nombre" → "P3" · "Pago 2 - Fecha" → "Pago 2". */
function prefijoDe(nombre: string): string | null {
  const m = nombre.match(/^(.+?) - /)
  return m ? m[1] : null
}

/** Número del grupo repetible, si lo es: P3→3, T2→2, Pago 4→4. */
function numeroRepetible(prefijo: string): { serie: 'P' | 'T' | 'Pago'; n: number } | null {
  let m = prefijo.match(/^P(\d{1,2})$/)
  if (m) return { serie: 'P', n: Number(m[1]) }
  m = prefijo.match(/^T(\d)$/)
  if (m) return { serie: 'T', n: Number(m[1]) }
  m = prefijo.match(/^Pago (\d)$/)
  if (m) return { serie: 'Pago', n: Number(m[1]) }
  return null
}

const SERIE_LABEL = { P: 'Pasajero', T: 'Trayecto', Pago: 'Pago' } as const
const SERIE_MAX = { P: 20, T: 4, Pago: 4 } as const

/** Nombre visible de cada paso (la llave interna viene del catálogo). */
const ETIQUETA_PASO: Record<string, string> = {
  Facturacion: 'Datos de Facturación',
  'Generales del Viaje': 'Generales del Viaje',
  Inclusiones: 'Inclusiones y Exclusiones',
  'Plan de Pagos': 'Plan de Pagos',
  // Pedido del cliente (08-oct-2026): la llave interna no cambia (el catálogo
  // TMS y PASOS_NO_APLICAN la usan), solo lo que se ve.
  'Liquidación Porción Terrestre': 'Liquidación Porción Terrestre o Plan Turístico',
}
const etiquetaPaso = (p: string) => ETIQUETA_PASO[p] ?? p

/**
 * Etiquetas visibles distintas del nombre del campo en GHL (el nombre GHL no
 * se toca: el catálogo y el contrato lo buscan por nombre exacto).
 */
const ETIQUETA_CAMPO: Record<string, string> = {
  'Destino de interés': 'Destino',
  // Era "Tipo de pago" (texto libre). El cliente pidió (08-oct-2026) que se
  // llame así y que el contrato lo imprima en el Plan de pagos.
  'Pago 1 - Tipo de Pago': 'Depósito mínimo requerido para confirmar reserva',
}
const PLACEHOLDER_CAMPO: Record<string, string> = {
  'Pago 1 - Tipo de Pago': 'Ej.: 30% · 3.000.000 · 100% de los tiquetes',
}
const NOMBRE_DEPOSITO_MINIMO = 'Pago 1 - Tipo de Pago'
const MAX_CUOTAS = 6
const PASO_PAGOS = 'Plan de Pagos'

/** Suma AAAA-MM-DD + meses (negativo para restar), en UTC para no correr el día. */
function sumarMeses(iso: string, meses: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + meses, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const MAX_PAGOS = 4
const fechaCo = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/**
 * Pasos que solo se abren con clic en su pestaña: "Guardar y seguir" nunca
 * salta a ellos. Operaciones (envío de documentos) es de quien opera la
 * reserva, no parte del flujo de la asesora, que termina en Inclusiones y
 * sigue en el recuadro "Contrato para firma" (arriba del wizard).
 */
const PASOS_APARTE = new Set(['Operaciones'])

/**
 * Pasos que no aplican según el "Tipo de Contrato": se ven atenuados y
 * "Guardar y seguir" los salta, pero siguen abiertos con clic (por si el
 * negocio trae algo fuera de lo común). El contrato solo imprime las filas
 * con datos, así que dejarlos vacíos no deja huecos en el PDF.
 */
const PASOS_NO_APLICAN: Record<string, string[]> = {
  // Nombres vigentes (08-oct-2026, scripts/ghl-opciones-tipo-contrato.mjs)…
  'Tiquetes Aéreos': ['Liquidación Porción Terrestre'],
  'Asistencia en Viajes': ['Vuelos', 'Liquidación Vuelos'],
  Excursiones: ['Vuelos', 'Liquidación Vuelos'],
  // …y los anteriores, que las oportunidades viejas aún tienen guardados.
  'Ticketes Aéreos': ['Liquidación Porción Terrestre'],
  'Solo Asistencia': ['Vuelos', 'Liquidación Vuelos'],
  'Solo Excursiones': ['Vuelos', 'Liquidación Vuelos'],
}

/* ------------------------------------------------------------------ */
/* Autosumas: la aritmética del contrato se calcula sola.              */
/* Regla de convivencia: un valor calculado (auto) se recalcula cuando */
/* cambian sus insumos; si el representante escribe encima, ese campo  */
/* pasa a manual y no se vuelve a tocar.                               */
/* ------------------------------------------------------------------ */

/** Filas de la liquidación terrestre (cada una: Tarifa por pax × Cantidad = Valor Total).
 *  TRM no es fila: es la tasa de cambio (sus cantidad/valores están ocultos). */
const FILAS_LIQUIDACION = ['ADL Sencillo', 'ADL Doble', 'ADL Multiple', 'Valor Niño', 'Valor Infante']
/** Filas que suman al total de pasajeros (TRM no es gente). */
const FILAS_PASAJEROS = ['ADL Sencillo', 'ADL Doble', 'ADL Multiple', 'Valor Niño', 'Valor Infante']

function recalcular(
  vals: Record<string, ValorCampo>,
  autosPrevios: Set<string>,
  idDe: (nombre: string) => string | undefined
): { valores: Record<string, ValorCampo>; autos: Set<string> } {
  const v = { ...vals }
  const autos = new Set(autosPrevios)

  const leer = (nombre: string): number | null => {
    const id = idDe(nombre)
    const x = id ? v[id] : undefined
    if (typeof x !== 'string' || x.trim() === '') return null
    const n = Number(x)
    return Number.isFinite(n) ? n : null
  }

  const poner = (nombre: string, valor: number | null) => {
    const id = idDe(nombre)
    if (!id) return
    const esManual = v[id] !== undefined && v[id] !== '' && !autos.has(id)
    if (esManual) return // el humano ya lo escribió: se respeta
    if (valor === null) {
      // Sin insumos: si lo habíamos calculado nosotros, se limpia (nada de totales huérfanos).
      if (autos.has(id)) {
        delete v[id]
        autos.delete(id)
      }
      return
    }
    v[id] = String(Math.round(valor * 100) / 100)
    autos.add(id)
  }

  const mul = (a: number | null, b: number | null) => (a !== null && b !== null ? a * b : null)
  const suma = (terminos: (number | null)[]) => {
    const presentes = terminos.filter((t): t is number => t !== null)
    return presentes.length ? presentes.reduce((a, b) => a + b, 0) : null
  }

  // 1. Vuelos: valor × cantidad.
  poner('Valor total Adultos Vuelos', mul(leer('Valor Adulto Vuelos'), leer('Cantidad Adultos Vuelos')))
  poner('Valor total Niños Vuelos', mul(leer('Valor Niño Vuelos'), leer('Cantidad Niños Vuelos')))

  // 2. Filas de liquidación: tarifa (o valor plan) × cantidad.
  for (const f of FILAS_LIQUIDACION) {
    const base = leer(`${f} - Tarifa por pax`) ?? leer(`${f} - Valor Plan`)
    poner(`${f} - Valor Total`, mul(base, leer(`${f} - Cantidad`)))
  }

  // 3. Totales por columna + vuelos.
  poner('Total Pasajeros - Cantidad', suma(FILAS_PASAJEROS.map(f => leer(`${f} - Cantidad`))))
  poner('Total Pasajeros - Valor Plan', suma(FILAS_PASAJEROS.map(f => leer(`${f} - Valor Plan`))))
  poner(
    'Total Pasajeros - Valor Total',
    suma([
      ...FILAS_PASAJEROS.map(f => leer(`${f} - Valor Total`)),
      leer('Valor total Adultos Vuelos'),
      leer('Valor total Niños Vuelos'),
    ])
  )

  // 4. Plan de pagos, por divisa (10-oct-2026): cada pago hereda el total del
  //    pago anterior en su misma divisa (el primero en pesos toma el total del
  //    viaje; el primero en dólares, el valor en dólares de la TRM) y su saldo
  //    descuenta solo los abonos de esa divisa: un pago en pesos no le resta
  //    al saldo en dólares.
  const totalPor: Record<Divisa, number | null> = {
    COP: leer('Total Pasajeros - Valor Total'),
    USD: leer('TRM - Valor Total'),
  }
  const abonadoPor: Record<Divisa, number> = { COP: 0, USD: 0 }
  for (let n = 1; n <= MAX_PAGOS; n++) {
    const d = divisaDe(texto(v, idDe(`Pago ${n} - Divisa`)), leer(`Pago ${n} - Abono`))
    poner(`Pago ${n} - Total Plan`, totalPor[d])
    const total = leer(`Pago ${n} - Total Plan`)
    if (total !== null) totalPor[d] = total
    const abono = leer(`Pago ${n} - Abono`)
    if (abono !== null) abonadoPor[d] += abono
    poner(`Pago ${n} - Saldo en Pesos`, total !== null && abono !== null ? total - abonadoPor[d] : null)
  }

  return { valores: v, autos }
}

/** Texto de un campo (vacío → undefined). */
function texto(v: Record<string, ValorCampo>, id: string | undefined): string | undefined {
  const x = id ? v[id] : undefined
  return typeof x === 'string' && x.trim() !== '' ? x : undefined
}

const card: React.CSSProperties = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: 12,
}

export function Wizard({ opportunityId, campos, valoresIniciales, prefill }: Props) {
  const pasos = useMemo(() => {
    const vistos: string[] = []
    for (const c of campos) if (!vistos.includes(c.folder)) vistos.push(c.folder)
    return vistos
  }, [campos])

  const porNombre = useMemo(() => new Map(campos.map(c => [c.name, c.ghlId])), [campos])
  const idDe = (nombre: string) => porNombre.get(nombre)

  // Pagos y cuotas anteriores al 10-oct-2026 no tienen divisa: se infiere por
  // el tamaño de los montos y se muestra como sugerida (amarillo) hasta que la
  // asesora guarde el paso.
  const prefillTodo = useMemo(() => {
    const base = { ...prefill, ...valoresIniciales }
    const monto = (nombre: string) => {
      const x = texto(base, idDe(nombre))
      const n = x === undefined ? NaN : Number(x)
      return Number.isFinite(n) ? n : null
    }
    const inferidas: Record<string, ValorCampo> = {}
    const inferir = (campoDivisa: string, montos: string[]) => {
      const id = idDe(campoDivisa)
      if (!id || texto(base, id) !== undefined) return
      const valores = montos.map(monto)
      if (valores.every(x => x === null)) return
      inferidas[id] = divisaDe(undefined, ...valores)
    }
    for (let k = 1; k <= MAX_PAGOS; k++) inferir(`Pago ${k} - Divisa`, [`Pago ${k} - Abono`, `Pago ${k} - Total Plan`])
    for (let k = 1; k <= MAX_CUOTAS; k++) inferir(`Cuota ${k} - Divisa`, [`Cuota ${k} - Importe`])
    return { ...prefill, ...inferidas }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Estado inicial: valores guardados + prefill, con las autosumas ya corridas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inicial = useMemo(() => recalcular({ ...prefillTodo, ...valoresIniciales }, new Set(), idDe), [])

  const [paso, setPaso] = useState(0)
  const [valores, setValores] = useState<Record<string, ValorCampo>>(inicial.valores)
  // Campos calculados por las autosumas: se recalculan al cambiar sus insumos
  // y se pintan azules; si el representante escribe encima, pasan a manuales.
  const [autos, setAutos] = useState<Set<string>>(inicial.autos)
  // Ids cuyo valor vino sugerido del contacto y aún no se guarda: se pintan
  // distinto para que el representante los revise en vez de confiar a ciegas.
  const [sugeridos, setSugeridos] = useState<Set<string>>(
    () => new Set(Object.keys(prefillTodo).filter(id => valoresIniciales[id] === undefined))
  )
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  // Los contadores de pasajeros y trayectos NO son controles sueltos: son los
  // campos reales del contrato ("Contrato - Numero de Pasajeros/Trayectos").
  // Cambiarlos aquí o en el paso Contrato es lo mismo, y se guardan con
  // cualquier paso. Pagos no tiene campo equivalente → contador local.
  const idNumPasajeros = useMemo(
    () => campos.find(c => c.name === 'Contrato - Numero de Pasajeros')?.ghlId,
    [campos]
  )
  const idNumTrayectos = useMemo(
    () => campos.find(c => c.name === 'Contrato - Numero de Trayectos')?.ghlId,
    [campos]
  )

  // Mayor grupo con datos: el piso de cada contador cuando el campo está vacío.
  const conDatos = useMemo(() => {
    const con = { P: 1, T: 1, Pago: 1 }
    for (const c of campos) {
      const rep = prefijoDe(c.name) ? numeroRepetible(prefijoDe(c.name)!) : null
      if (rep && (valoresIniciales[c.ghlId] !== undefined || prefill[c.ghlId] !== undefined)) {
        con[rep.serie] = Math.max(con[rep.serie], rep.n)
      }
    }
    return con
  }, [campos, valoresIniciales, prefill])

  const [cuentaPago, setCuentaPago] = useState(() => conDatos.Pago)

  // ── Cuotas pendientes (plan de pagos por cuotas, oct-2026) ──
  // Los campos "Cuota N - Importe / Fecha de vencimiento / Divisa" viven en
  // GHL como 6 ranuras fijas; aquí se ven como filas que se agregan y se quitan.
  const cuotaIds = useMemo(() => {
    const m = new Map<number, { importe?: string; vence?: string; divisa?: string }>()
    for (const c of campos) {
      const r = RE_CUOTA.exec(c.name)
      if (!r) continue
      const n = Number(r[1])
      const e = m.get(n) ?? {}
      if (r[2] === 'Importe') e.importe = c.ghlId
      else if (r[2] === 'Divisa') e.divisa = c.ghlId
      else e.vence = c.ghlId
      m.set(n, e)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e).slice(0, MAX_CUOTAS)
  }, [campos])
  const [cuentaCuotas, setCuentaCuotas] = useState(() => {
    const tiene = (id?: string) => id !== undefined && valoresIniciales[id] !== undefined && valoresIniciales[id] !== ''
    let n = 0
    cuotaIds.forEach((e, i) => {
      if (tiene(e.importe) || tiene(e.vence)) n = i + 1
    })
    return n
  })
  // Ranuras que quedaron vacías al quitar una cuota: se vacían en GHL al guardar.
  const [porBorrar, setPorBorrar] = useState<Set<string>>(new Set())

  function agregarCuota() {
    if (cuentaCuotas < cuotaIds.length) setCuentaCuotas(cuentaCuotas + 1)
  }

  /** Quita la cuota k (0-based): las siguientes suben un puesto y la última ranura se vacía. */
  function quitarCuota(k: number) {
    const v = { ...valores }
    const borrar = new Set(porBorrar)
    for (let i = k; i < cuentaCuotas; i++) {
      const actual = cuotaIds[i]
      const siguiente = i + 1 < cuentaCuotas ? cuotaIds[i + 1] : undefined
      for (const campo of ['importe', 'vence', 'divisa'] as const) {
        const id = actual[campo]
        if (!id) continue
        const idSig = siguiente?.[campo]
        const nuevo = idSig ? v[idSig] : undefined
        if (nuevo === undefined || nuevo === '') {
          delete v[id]
          borrar.add(id)
        } else {
          v[id] = nuevo
          borrar.delete(id)
        }
      }
    }
    setValores(v)
    setPorBorrar(borrar)
    setCuentaCuotas(cuentaCuotas - 1)
  }

  function leerCuenta(id: string | undefined, tope: number, piso: number): number {
    const v = id ? valores[id] : undefined
    const n = typeof v === 'string' ? Number(v) : NaN
    const base = Number.isInteger(n) && n >= 1 ? n : piso
    return Math.min(Math.max(base, 1), tope)
  }

  // Sin "Numero de Pasajeros" escrito, los pasajeros visibles salen de la
  // liquidación (total de pasajeros) o del Pax total, si ya están.
  const paxLiquidacion = [idDe('Total Pasajeros - Cantidad'), idDe('Pax total')]
    .map(id => (id ? Number(valores[id]) : NaN))
    .find(n => Number.isInteger(n) && n >= 1)
  const cuenta: Record<'P' | 'T' | 'Pago', number> = {
    P: leerCuenta(idNumPasajeros, SERIE_MAX.P, Math.max(conDatos.P, paxLiquidacion ?? 1)),
    T: leerCuenta(idNumTrayectos, SERIE_MAX.T, conDatos.T),
    Pago: cuentaPago,
  }

  function ponerCuenta(serie: 'P' | 'T' | 'Pago', n: number) {
    if (serie === 'Pago') return setCuentaPago(n)
    const id = serie === 'P' ? idNumPasajeros : idNumTrayectos
    if (id) poner(id, String(n))
  }

  const idTipoContrato = idDe('Tipo de Contrato')
  const tipoContrato = idTipoContrato ? valores[idTipoContrato] : undefined
  const noAplican = new Set(typeof tipoContrato === 'string' ? (PASOS_NO_APLICAN[tipoContrato] ?? []) : [])
  const enFlujo = (p: string) => !PASOS_APARTE.has(p) && !noAplican.has(p)

  const carpetaActual = pasos[paso]
  const camposDelPaso = campos.filter(c => c.folder === carpetaActual)

  // Último paso del flujo de la asesora (sin las pestañas aparte): ahí se le
  // indica que el contrato se envía desde el recuadro "Contrato para firma".
  const ultimoDelFlujo = [...pasos].reverse().find(enFlujo)

  // Grupos del paso: los repetibles visibles según el contador + los sueltos.
  const { grupos, sueltos, series } = useMemo(() => {
    const grupos = new Map<string, CampoReserva[]>()
    const sueltos: CampoReserva[] = []
    const series = new Set<'P' | 'T' | 'Pago'>()
    for (const c of camposDelPaso) {
      if (esCampoCuota(c.name)) continue // las cuotas tienen su propio bloque (abajo)
      const pref = prefijoDe(c.name)
      const rep = pref ? numeroRepetible(pref) : null
      if (rep) {
        series.add(rep.serie)
        if (rep.n > cuenta[rep.serie]) continue // fuera del contador: oculto
      }
      if (pref && camposDelPaso.filter(x => prefijoDe(x.name) === pref).length >= 2) {
        if (!grupos.has(pref)) grupos.set(pref, [])
        grupos.get(pref)!.push(c)
      } else {
        sueltos.push(c)
      }
    }
    return { grupos, sueltos, series }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camposDelPaso, cuenta.P, cuenta.T, cuenta.Pago])

  function poner(id: string, v: ValorCampo) {
    // Editar a mano un campo calculado lo vuelve manual: las autosumas dejan
    // de tocarlo. Después del cambio, la aritmética se recorre completa.
    const autosSinEste = new Set(autos)
    autosSinEste.delete(id)
    const r = recalcular({ ...valores, [id]: v }, autosSinEste, idDe)
    setValores(r.valores)
    setAutos(r.autos)
    setSugeridos(prev => {
      if (!prev.has(id)) return prev
      const s = new Set(prev)
      s.delete(id)
      return s
    })
  }

  async function guardarPaso(avanzar: boolean) {
    setGuardando(true)
    setAviso(null)
    try {
      // Se guarda TODO lo visible del paso con valor (PUT idempotente, GHL
      // hace merge): así los sugeridos revisados también quedan escritos.
      const visibles = [...grupos.values()].flat().concat(sueltos)
      if (carpetaActual === PASO_PAGOS) {
        for (const e of cuotaIds.slice(0, cuentaCuotas)) {
          for (const id of [e.importe, e.vence, e.divisa]) {
            const c = campos.find(x => x.ghlId === id)
            if (c) visibles.push(c)
          }
        }
      }
      const lote: Record<string, ValorCampo> = {}
      for (const c of visibles) {
        const v = valores[c.ghlId]
        if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) lote[c.ghlId] = v
      }
      // La divisa que se ve en pantalla se guarda aunque nadie la haya tocado,
      // en cada pago y cuota con datos: el contrato no tiene que adivinarla.
      if (carpetaActual === PASO_PAGOS) {
        for (let k = 1; k <= cuentaPago; k++) {
          const id = idDe(`Pago ${k} - Divisa`)
          const conDatos = [`Pago ${k} - Abono`, `Pago ${k} - Total Plan`, `Pago ${k} - Fecha de Pago`].some(n => texto(valores, idDe(n)))
          if (id && conDatos && lote[id] === undefined) lote[id] = divisaPago(k)
        }
        for (const e of cuotaIds.slice(0, cuentaCuotas)) {
          const conDatos = texto(valores, e.importe) || texto(valores, e.vence)
          if (e.divisa && conDatos && lote[e.divisa] === undefined) lote[e.divisa] = divisaCuota(e)
        }
      }
      // Los contadores (campos reales del contrato) viajan con cualquier paso:
      // el representante pudo ajustarlos desde el encabezado.
      for (const id of [idNumPasajeros, idNumTrayectos]) {
        const v = id ? valores[id] : undefined
        if (id && typeof v === 'string' && v !== '') lote[id] = v
      }
      // Cuotas quitadas: sus ranuras se vacían en GHL (borrado explícito).
      const limpiar = carpetaActual === PASO_PAGOS ? [...porBorrar].filter(id => lote[id] === undefined) : []
      const r = await guardarReserva(opportunityId, lote, limpiar)
      if (!r.ok) {
        setAviso({ ok: false, texto: `No se pudo guardar: ${r.error}` })
        return
      }
      if (limpiar.length > 0) setPorBorrar(new Set())
      setSugeridos(prev => {
        const s = new Set(prev)
        for (const id of Object.keys(lote)) s.delete(id)
        return s
      })
      setAviso({ ok: true, texto: r.guardados ? `${r.guardados} campos guardados en GHL.` : 'Nada nuevo que guardar.' })
      if (avanzar) {
        const siguiente = pasos.findIndex((p, i) => i > paso && enFlujo(p))
        if (siguiente !== -1 && pasos.slice(paso + 1, siguiente).every(p => !PASOS_APARTE.has(p))) setPaso(siguiente)
      }
    } catch (e) {
      // Un throw aquí ya no viene de la lógica de guardado (eso vuelve como
      // dato): casi siempre es que el navegador tiene una versión vieja del
      // panel tras un despliegue y la acción del servidor ya no existe.
      const m = (e as Error).message ?? ''
      setAviso({
        ok: false,
        texto: /Server (Components|Action|Functions)|Failed to find/i.test(m)
          ? 'El panel se actualizó mientras tenías esta página abierta. Recarga la página (F5) y vuelve a guardar — no se perdió nada de lo ya guardado.'
          : `No se pudo guardar: ${m}`,
      })
    } finally {
      setGuardando(false)
    }
  }

  // Lectura numérica de un campo (para las validaciones de cuotas).
  const num = (id?: string): number | null => {
    const x = id ? valores[id] : undefined
    if (typeof x !== 'string' || x.trim() === '') return null
    const n = Number(x)
    return Number.isFinite(n) ? n : null
  }
  const cuotasVisibles = cuotaIds.slice(0, cuentaCuotas)

  // Divisa de cada pago: la guardada o, si falta, la que dicen sus montos.
  const divisaPago = (k: number): Divisa =>
    divisaDe(texto(valores, idDe(`Pago ${k} - Divisa`)), num(idDe(`Pago ${k} - Abono`)), num(idDe(`Pago ${k} - Total Plan`)))

  // Saldo por divisa: el del último pago visible en esa divisa (el campo Saldo
  // o, si está vacío, total del plan menos sus abonos).
  const saldoPor: Record<Divisa, number | null> = { COP: null, USD: null }
  {
    const totalPor: Record<Divisa, number | null> = { COP: null, USD: null }
    const abonadoPor: Record<Divisa, number> = { COP: 0, USD: 0 }
    for (let k = 1; k <= cuentaPago; k++) {
      const t = num(idDe(`Pago ${k} - Total Plan`))
      const a = num(idDe(`Pago ${k} - Abono`))
      if (t === null && a === null) continue
      const d = divisaPago(k)
      if (t !== null) totalPor[d] = t
      abonadoPor[d] += a ?? 0
      const total = totalPor[d]
      saldoPor[d] = num(idDe(`Pago ${k} - Saldo en Pesos`)) ?? (total !== null ? total - abonadoPor[d] : null)
    }
  }
  // Una cuota nueva arranca en la divisa que todavía tiene saldo.
  const divisaPendiente: Divisa = DIVISAS.find(d => (saldoPor[d] ?? 0) > 0) ?? 'COP'
  const divisaCuota = (e: { divisa?: string }): Divisa => {
    const guardada = texto(valores, e.divisa)
    return guardada ? divisaDe(guardada) : divisaPendiente
  }
  // Cuadre por divisa: saldo pendiente = cuotas programadas en esa divisa.
  const cuadre = DIVISAS.map(d => {
    const programado = cuotasVisibles
      .filter(e => divisaCuota(e) === d)
      .reduce((t, e) => t + Math.max(num(e.importe) ?? 0, 0), 0)
    const saldo = saldoPor[d]
    const diferencia = saldo !== null ? Math.round((saldo - programado) * 100) / 100 : null
    return { d, saldo, programado, diferencia }
  }).filter(r => r.saldo !== null || r.programado > 0)
  const fechaIda = valores[idDe('Fecha confirmada de salida') ?? '']
  // Tope: un mes antes del viaje (aviso de saldos del contrato).
  const limiteCuotas = typeof fechaIda === 'string' && fechaIda ? sumarMeses(fechaIda, -1) : null
  const depositoMinimo = valores[idDe(NOMBRE_DEPOSITO_MINIMO) ?? '']

  /**
   * Un pago: la divisa manda. Total, abono y saldo se rotulan en esa divisa,
   * la TRM solo aparece en dólares (o si ya traía una) y, en dólares, se ve
   * cuánto son el abono y el saldo en pesos a la TRM de ese pago.
   */
  // Se llama como función (no como <Componente/>): definido aquí dentro, React
  // lo remontaría en cada tecla y el campo perdería el foco.
  function grupoPago(clave: string, n: number, items: CampoReserva[]) {
    const d = divisaPago(n)
    const trm = num(idDe(`Pago ${n} - TRM`))
    const abono = num(idDe(`Pago ${n} - Abono`))
    const saldo = num(idDe(`Pago ${n} - Saldo en Pesos`))
    const sufijo = (c: CampoReserva) => c.name.replace(/^.+? - /, '')
    const etiqueta: Record<string, string> = {
      'Total Plan': `Total (${d})`,
      Abono: `Abono (${d})`,
      'Saldo en Pesos': `Saldo (${d})`,
      TRM: 'TRM (pesos por dólar)',
    }
    const visibles = items.filter(c => !(sufijo(c) === 'TRM' && d === 'COP' && trm === null))
    return (
      <fieldset key={clave} className="mt-4 rounded-lg p-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
        <legend className="px-2 font-inter text-xs font-semibold" style={{ color: 'var(--orange)' }}>
          Pago {n}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map(c => {
            const esDivisa = sufijo(c) === 'Divisa'
            return (
              <Campo
                key={c.ghlId}
                campo={c}
                valor={esDivisa ? (texto(valores, c.ghlId) ?? d) : valores[c.ghlId]}
                sugerido={sugeridos.has(c.ghlId)}
                auto={autos.has(c.ghlId)}
                onChange={poner}
                etiqueta={etiqueta[sufijo(c)]}
                sinVacio={esDivisa}
              />
            )
          })}
        </div>
        {d === 'USD' && trm !== null && (abono !== null || saldo !== null) && (
          <p className="mt-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            A la TRM de este pago ({pesos.format(trm)}):
            {abono !== null && <> abono = <strong style={{ color: 'var(--text-primary)' }}>{pesos.format(abono * trm)}</strong></>}
            {abono !== null && saldo !== null && ' ·'}
            {saldo !== null && <> saldo = <strong style={{ color: 'var(--text-primary)' }}>{pesos.format(saldo * trm)}</strong></>}
          </p>
        )}
      </fieldset>
    )
  }

  // Los contadores de avance miran solo los campos que el contrato imprime:
  // el objetivo del wizard es un contrato completo, no llenar el catálogo TMS.
  function llenosEn(carpeta: string): number {
    return campos.filter(
      c =>
        c.folder === carpeta &&
        c.enContrato &&
        valores[c.ghlId] !== undefined &&
        valores[c.ghlId] !== '' &&
        !sugeridos.has(c.ghlId)
    ).length
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pasos */}
      <div className="flex flex-wrap gap-1.5">
        {pasos.map((p, i) => {
          const activo = i === paso
          const llenos = llenosEn(p)
          const total = campos.filter(c => c.folder === p && c.enContrato).length
          const noAplica = noAplican.has(p)
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPaso(i)}
              title={noAplica ? `No aplica para "${tipoContrato}"` : undefined}
              className={`rounded-full px-3 py-1.5 font-inter text-xs transition-colors${PASOS_APARTE.has(p) ? ' ml-3' : ''}`}
              style={{
                background: activo ? 'var(--orange)' : 'white',
                color: activo ? 'var(--orange-contrast)' : 'var(--text-dim)',
                border: '1px solid ' + (activo ? 'var(--orange)' : 'var(--border)'),
                borderStyle: PASOS_APARTE.has(p) ? 'dashed' : 'solid',
                fontWeight: activo ? 600 : 400,
                opacity: noAplica && !activo ? 0.45 : 1,
                textDecoration: noAplica && !activo ? 'line-through' : undefined,
              }}
            >
              {i + 1}. {etiquetaPaso(p)}
              {noAplica ? (
                <span className="ml-1 opacity-70">(no aplica)</span>
              ) : (
                llenos > 0 && <span className="ml-1 opacity-70">({llenos}/{total})</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="p-5" style={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-inter text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {etiquetaPaso(carpetaActual)}
          </h2>

          {noAplican.has(carpetaActual) && (
            <span className="rounded-full px-3 py-1 font-inter text-xs" style={{ background: 'var(--bg-alt)', color: 'var(--text-dim)' }}>
              No aplica para «{String(tipoContrato)}»: puedes dejarlo vacío
            </span>
          )}

          {/* Contadores de grupos repetibles del paso */}
          <div className="flex gap-3">
            {[...series].map(s => (
              <label key={s} className="flex items-center gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                {s === 'P' ? '¿Cuántos pasajeros?' : s === 'T' ? '¿Cuántos trayectos?' : '¿Cuántos pagos?'}
                <select
                  value={cuenta[s]}
                  onChange={e => ponerCuenta(s, Number(e.target.value))}
                  className="rounded-md px-2 py-1 font-inter text-xs"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {Array.from({ length: SERIE_MAX[s] }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        {carpetaActual === 'Contacto' && (
          <p className="mb-4 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            Verifica el teléfono y el correo: el contrato se envía a estos datos y sin ellos
            correctos no llega. El teléfono va con indicativo (ej. +57 320 000 0000).
          </p>
        )}

        {sugeridos.size > 0 && (
          <p className="mb-4 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fffbeb', color: '#92400e' }}>
            Los campos en amarillo vienen sugeridos del CRM (calificación de Sol / datos previos).
            Revísalos: al guardar el paso quedan escritos en la oportunidad.
          </p>
        )}

        {autos.size > 0 && camposDelPaso.some(c => autos.has(c.ghlId)) && (
          <p className="mb-4 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            Los campos en azul se calculan solos (tarifa × cantidad, totales y saldos).
            Si escribes encima, tu valor manda y no se recalcula.
          </p>
        )}

        {/* Campos sueltos que el contrato imprime: la cara principal del paso. */}
        {sueltos.filter(c => c.enContrato).length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sueltos.filter(c => c.enContrato).map(c => (
              <Campo key={c.ghlId} campo={c} valor={valores[c.ghlId]} sugerido={sugeridos.has(c.ghlId)} auto={autos.has(c.ghlId)} onChange={poner} />
            ))}
          </div>
        )}

        {/* Grupos (pasajeros, trayectos, pagos, filas de liquidación) */}
        {[...grupos.entries()].map(([pref, items]) => {
          const rep = numeroRepetible(pref)
          // TRM es la tasa de cambio, no una fila de pasajeros: título claro.
          const titulo = rep ? `${SERIE_LABEL[rep.serie]} ${rep.n}` : pref === 'TRM' ? 'Tasa de cambio (TRM)' : pref
          if (rep?.serie === 'Pago') return grupoPago(pref, rep.n, items)
          return (
            <fieldset
              key={pref}
              className="mt-4 rounded-lg p-4"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-alt)' }}
            >
              <legend className="px-2 font-inter text-xs font-semibold" style={{ color: 'var(--orange)' }}>
                {titulo}
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(c => (
                  <Campo key={c.ghlId} campo={c} valor={valores[c.ghlId]} sugerido={sugeridos.has(c.ghlId)} auto={autos.has(c.ghlId)} onChange={poner} />
                ))}
              </div>
            </fieldset>
          )
        })}

        {/* Plan de pagos por cuotas: filas que se agregan y se quitan, total
            programado, depósito mínimo a la vista y validaciones (no bloquean:
            el importe acordado nunca se cambia solo). */}
        {carpetaActual === PASO_PAGOS && cuotaIds.length > 0 && (
          <fieldset className="mt-4 rounded-lg p-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
            <legend className="px-2 font-inter text-xs font-semibold" style={{ color: 'var(--orange)' }}>
              Cuotas pendientes
            </legend>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
              <span>
                Depósito mínimo requerido para confirmar reserva:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {typeof depositoMinimo === 'string' && depositoMinimo ? depositoMinimo : 'sin definir (campo del Pago 1)'}
                </strong>
              </span>
              {cuadre.some(r => r.programado > 0) && (
                <span>
                  Total programado en cuotas:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {cuadre.filter(r => r.programado > 0).map(r => enDivisa(r.programado, r.d)).join(' + ')}
                  </strong>
                </span>
              )}
            </div>

            {cuentaCuotas === 0 && (
              <p className="mb-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                Sin cuotas registradas: el contrato se genera igual, solo con los pagos de arriba.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {cuotasVisibles.map((e, i) => {
                const importe = num(e.importe)
                const vence = e.vence ? valores[e.vence] : undefined
                const importeMalo = importe !== null && importe <= 0
                const tarde = typeof vence === 'string' && vence && limiteCuotas ? vence > limiteCuotas : false
                const d = divisaCuota(e)
                return (
                  <div key={i} className="grid grid-cols-[auto_6rem_1fr_1fr_auto] items-end gap-3">
                    <span className="pb-2 font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
                      Cuota {i + 1}
                    </span>
                    <label className="block">
                      <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Divisa</span>
                      <select
                        value={d}
                        onChange={ev => e.divisa && poner(e.divisa, ev.target.value)}
                        disabled={!e.divisa}
                        className="w-full rounded-md px-3 py-2 font-inter text-sm outline-none"
                        style={{
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          background: e.divisa && sugeridos.has(e.divisa) ? '#fffbeb' : 'white',
                        }}
                      >
                        {DIVISAS.map(x => (
                          <option key={x} value={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Importe ({d})</span>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        value={(e.importe ? (valores[e.importe] as string) : '') ?? ''}
                        onChange={ev => e.importe && poner(e.importe, ev.target.value)}
                        className="w-full rounded-md px-3 py-2 font-inter text-sm outline-none"
                        style={{ border: `1px solid ${importeMalo ? '#dc2626' : 'var(--border)'}`, color: 'var(--text-primary)', background: 'white' }}
                      />
                      {importeMalo && (
                        <span className="mt-1 block font-inter text-xs" style={{ color: '#b91c1c' }}>El importe debe ser mayor que cero.</span>
                      )}
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Fecha de vencimiento</span>
                      <input
                        type="date"
                        value={(typeof vence === 'string' ? vence : '') ?? ''}
                        onChange={ev => e.vence && poner(e.vence, ev.target.value)}
                        className="w-full rounded-md px-3 py-2 font-inter text-sm outline-none"
                        style={{ border: `1px solid ${tarde ? '#d97706' : 'var(--border)'}`, color: 'var(--text-primary)', background: 'white' }}
                      />
                      {tarde && limiteCuotas && (
                        <span className="mt-1 block font-inter text-xs" style={{ color: '#92400e' }}>
                          Vence después del límite ({fechaCo(limiteCuotas)}, un mes antes del viaje).
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => quitarCuota(i)}
                      title="Quitar esta cuota"
                      aria-label={`Quitar cuota ${i + 1}`}
                      className="mb-0.5 rounded-md p-2"
                      style={{ border: '1px solid var(--border)', color: '#b91c1c', background: 'white' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={agregarCuota}
                disabled={cuentaCuotas >= cuotaIds.length}
                className="flex items-center gap-1 rounded-md px-3 py-2 font-inter text-xs font-semibold disabled:opacity-40"
                style={{ border: '1px solid var(--border-orange)', color: 'var(--orange)', background: 'white' }}
              >
                <Plus size={14} /> Agregar cuota
              </button>
              {cuentaCuotas >= cuotaIds.length && (
                <span className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Máximo {cuotaIds.length} cuotas.</span>
              )}
            </div>

            {/* Un cuadre por divisa: el saldo en dólares se programa en
                cuotas en dólares y el de pesos en cuotas en pesos. */}
            {cuentaCuotas > 0 &&
              cuadre.map(({ d, saldo, programado, diferencia }) => {
                const ok = diferencia === 0
                return (
                  <p
                    key={d}
                    className="mt-3 flex items-start gap-2 rounded-md px-3 py-2 font-inter text-xs"
                    style={ok ? { background: '#ecfdf5', color: '#047857' } : { background: '#fffbeb', color: '#92400e' }}
                  >
                    {ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                    <span>
                      <strong>{d}:</strong>{' '}
                      {saldo === null
                        ? `cuotas por ${enDivisa(programado, d)}, pero ningún pago en ${d} tiene total ni saldo.`
                        : `saldo ${enDivisa(saldo, d)} · cuotas ${enDivisa(programado, d)}`}
                      {diferencia === null
                        ? ''
                        : ok
                          ? '. Las cuentas cuadran.'
                          : diferencia > 0
                            ? `. Faltan ${enDivisa(diferencia, d)} por programar.`
                            : `. Las cuotas superan el saldo en ${enDivisa(Math.abs(diferencia), d)}.`}
                      {!ok && ' Los importes no se ajustan solos: revísalos tú.'}
                    </span>
                  </p>
                )
              })}
            {porBorrar.size > 0 && (
              <p className="mt-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                Las cuotas quitadas se borran en GHL al guardar el paso.
              </p>
            )}
          </fieldset>
        )}

        {/* Campos operativos (catálogo TMS): no salen en el contrato, van plegados
            para que el formulario calque el documento. */}
        {sueltos.some(c => !c.enContrato) && (
          <details className="mt-4 rounded-lg" style={{ border: '1px dashed var(--border)' }}>
            <summary
              className="cursor-pointer px-4 py-3 font-inter text-xs font-semibold"
              style={{ color: 'var(--text-dim)' }}
            >
              Campos de operación ({sueltos.filter(c => !c.enContrato).length}) — no salen en el
              contrato
            </summary>
            <div className="grid grid-cols-1 gap-4 p-4 pt-1 sm:grid-cols-2">
              {sueltos.filter(c => !c.enContrato).map(c => (
                <Campo key={c.ghlId} campo={c} valor={valores[c.ghlId]} sugerido={sugeridos.has(c.ghlId)} auto={autos.has(c.ghlId)} onChange={poner} />
              ))}
            </div>
          </details>
        )}

        {/* Acciones */}
        <div className="mt-6 flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button
            type="button"
            disabled={paso === 0 || guardando}
            onClick={() => setPaso(paso - 1)}
            className="flex items-center gap-1 rounded-md px-3 py-2 font-inter text-sm disabled:opacity-40"
            style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            <ChevronLeft size={15} /> Anterior
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={() => guardarPaso(false)}
            className="flex items-center gap-2 rounded-md px-4 py-2 font-inter text-sm font-semibold disabled:opacity-60"
            style={{ border: '1px solid var(--border-orange)', color: 'var(--orange)' }}
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Guardar paso
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={() => guardarPaso(true)}
            className="flex items-center gap-1 rounded-md px-4 py-2 font-inter text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
          >
            Guardar y seguir <ChevronRight size={15} />
          </button>

          {aviso && (
            <span className="font-inter text-sm" style={{ color: aviso.ok ? '#15803d' : '#b91c1c' }}>
              {aviso.texto}
            </span>
          )}
        </div>
      </div>

      {carpetaActual === ultimoDelFlujo && (
        <a
          href="#contrato-para-firma"
          className="mt-4 flex items-start gap-3 rounded-xl p-4 font-inter text-sm"
          style={{ ...card, borderColor: 'var(--border-orange)' }}
        >
          <FileSignature size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--orange)' }} />
          <span style={{ color: 'var(--text-primary)' }}>
            <strong>¿Todo guardado?</strong> Revisa el contrato con <em>Vista previa</em> y envíalo con{' '}
            <em>Enviar contrato para firma</em> en el recuadro <strong>Contrato para firma</strong>, arriba ↑
          </span>
        </a>
      )}
    </div>
  )
}


/** Un campo del formulario, según su dataType de GHL. */
function Campo({
  campo, valor, sugerido, auto, onChange, etiqueta: etiquetaFija, sinVacio,
}: {
  campo: CampoReserva
  valor: ValorCampo | undefined
  sugerido: boolean
  auto: boolean
  onChange: (id: string, v: ValorCampo) => void
  /** Etiqueta que depende del contexto (p. ej. "Abono (USD)"). */
  etiqueta?: string
  /** Lista sin la opción vacía "—" (la divisa siempre tiene valor). */
  sinVacio?: boolean
}) {
  // La etiqueta sin el prefijo del grupo ("P3 - Documento" → "Documento").
  // 'Destino de interés' se muestra como 'Destino' en el paso Contrato (el
  // nombre GHL no se toca: el catálogo TMS lo busca por nombre exacto).
  const etiqueta = etiquetaFija ?? ETIQUETA_CAMPO[campo.name] ?? campo.name.replace(/^.+? - /, '')
  const base: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    background: auto ? '#eff6ff' : sugerido ? '#fffbeb' : 'white',
  }
  const clase = 'w-full rounded-md px-3 py-2 font-inter text-sm outline-none'

  return (
    <label className="block">
      <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
        {etiqueta}
      </span>

      {campo.dataType === 'LARGE_TEXT' ? (
        <textarea
          rows={3}
          value={(valor as string) ?? ''}
          onChange={e => onChange(campo.ghlId, e.target.value)}
          className={clase}
          style={base}
        />
      ) : campo.dataType === 'SINGLE_OPTIONS' ? (
        <select
          value={(valor as string) ?? ''}
          onChange={e => onChange(campo.ghlId, e.target.value)}
          className={clase}
          style={base}
        >
          {!sinVacio && <option value="">—</option>}
          {(campo.options ?? []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : campo.dataType === 'MULTIPLE_OPTIONS' ? (
        <div className="flex flex-col gap-1 rounded-md p-3" style={base}>
          {(campo.options ?? []).map(o => {
            const marcadas = Array.isArray(valor) ? valor : []
            const activa = marcadas.includes(o)
            return (
              <label key={o} className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={activa}
                  onChange={() =>
                    onChange(campo.ghlId, activa ? marcadas.filter(x => x !== o) : [...marcadas, o])
                  }
                />
                {o}
              </label>
            )
          })}
        </div>
      ) : (
        <input
          type={campo.dataType === 'DATE' ? 'date' : campo.dataType === 'NUMERICAL' ? 'number' : campo.dataType === 'PHONE' ? 'tel' : campo.dataType === 'EMAIL' ? 'email' : 'text'}
          step={campo.dataType === 'NUMERICAL' ? 'any' : undefined}
          placeholder={PLACEHOLDER_CAMPO[campo.name]}
          value={(valor as string) ?? ''}
          onChange={e => onChange(campo.ghlId, e.target.value)}
          className={clase}
          style={base}
        />
      )}
    </label>
  )
}
