import type {
  ContratoDatos,
  ContratoLiquidacionFila,
  ContratoPago,
  ContratoPasajero,
  ContratoTrayecto,
} from './tipos'

/**
 * Arma el contrato a partir de los valores de la oportunidad (por NOMBRE del
 * campo en GHL, los mismos del catálogo) y la facturación del contacto.
 * Función pura: sin red, para poder probarla con datos inventados.
 *
 * Regla de oro: una fila (trayecto, pasajero, tarifa, pago) solo entra si
 * tiene su dato principal; nada de filas vacías.
 */

/** Valor crudo ya normalizado: texto, número, fecha ISO o lista. */
export type Valor = string | number | string[] | null | undefined

export interface EntradaContrato {
  /** Campos de la oportunidad por nombre exacto ("P3 - Pasaporte"). */
  opp: Record<string, Valor>
  facturacion: {
    nombre?: string
    documento?: string
    direccion?: string
    ciudad?: string
    correo?: string
    telefono?: string
  }
  /** Nombre del contacto (respaldo si falta "Titular de la Reserva"). */
  contacto: { nombre?: string; telefono?: string }
  agente?: string
  /** Hoy (AAAA-MM-DD), respaldo si falta "Fecha del contrato". */
  hoy: string
}

export const MAX_PASAJEROS = 20
export const MAX_TRAYECTOS = 4
export const MAX_PAGOS = 4

function texto(v: Valor): string | undefined {
  if (v == null) return undefined
  if (Array.isArray(v)) return v.join(', ') || undefined
  const t = String(v).trim()
  return t === '' ? undefined : t
}

/**
 * Número desde lo que sea que haya en GHL: 1450000, "1450000",
 * "$ 1.450.000", "4.150,50". En COP el punto es separador de miles.
 */
export function numero(v: Valor): number | undefined {
  if (v == null || Array.isArray(v)) return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  let t = String(v).replace(/[^\d.,-]/g, '')
  if (t === '' || t === '-') return undefined
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  else t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** Fecha ISO (AAAA-MM-DD) desde ISO, epoch ms o DD/MM/AAAA. */
export function fechaIso(v: Valor): string | undefined {
  if (v == null || Array.isArray(v)) return undefined
  if (typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
  }
  const t = String(v).trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return /^\d{10,13}$/.test(t) ? fechaIso(Number(t)) : undefined
}

/**
 * Las opciones de Inclusiones / No incluye en GHL traen emojis (✈️, 🧳, 🚑).
 * El contrato ya marca cada ítem con ✓ / ✗, y en el PDF del servidor los
 * emojis pueden salir como cuadros: se quitan, junto con espacios dobles.
 */
function sinEmojis(t: string): string {
  return t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

function lista(v: Valor): string[] {
  if (v == null) return []
  // Texto largo: una línea por ítem.
  const items = Array.isArray(v) ? v.map(String) : String(v).split(/\r?\n/)
  return items.map(x => sinEmojis(x.replace(/^\s*[•\-*]\s*/, ''))).filter(Boolean)
}

/** "Cédula de ciudadanía (CC)" + "1023456789" → "CC 1023456789". */
function documento(tipo: Valor, num: Valor): string | undefined {
  const n = texto(num)
  if (!n) return undefined
  const sigla = /\(([A-Z]{2,3})\)/.exec(texto(tipo) ?? '')?.[1]
  return sigla && !n.toUpperCase().startsWith(sigla) ? `${sigla} ${n}` : n
}

function fila(
  concepto: string,
  v: { tarifa?: Valor; cantidad?: Valor; plan?: Valor; total?: Valor }
): ContratoLiquidacionFila | null {
  const tarifaPorPax = numero(v.tarifa)
  const cantidad = numero(v.cantidad)
  const valorPlan = numero(v.plan)
  const total = numero(v.total) ?? (tarifaPorPax != null && cantidad != null ? tarifaPorPax * cantidad : undefined)
  if (!total && !cantidad) return null
  return { concepto, tarifaPorPax, cantidad, valorPlan, valorTotal: total ?? 0 }
}

export function armarContrato(e: EntradaContrato): ContratoDatos {
  const o = (nombre: string) => e.opp[nombre]

  const trayectos: ContratoTrayecto[] = []
  for (let i = 1; i <= MAX_TRAYECTOS; i++) {
    const ruta = texto(o(`T${i} - Ruta`))
    const vuelo = texto(o(`T${i} - Vuelo`))
    if (!ruta && !vuelo) continue
    trayectos.push({
      ruta: ruta ?? '',
      fechaSalida: fechaIso(o(`T${i} - Fecha de salida`)),
      horaSalida: texto(o(`T${i} - Hora de Salida`)),
      horaLlegada: texto(o(`T${i} - Hora de Llegada`)),
      vuelo,
      aerolinea: texto(o(`T${i} - Aerolinea`)),
    })
  }

  const pasajeros: ContratoPasajero[] = []
  for (let i = 1; i <= MAX_PASAJEROS; i++) {
    const nombre = texto(o(`P${i} - Nombre y Apellido`))
    if (!nombre) continue
    pasajeros.push({
      nombre,
      documento: documento(o(`P${i} - Tipo de documento`), o(`P${i} - Documento`)),
      fechaNacimiento: fechaIso(o(`P${i} - Fecha de Nacimiento`)),
      pasaporte: texto(o(`P${i} - Pasaporte`)),
      vencePasaporte: fechaIso(o(`P${i} - Vencimiento Pasaporte`)),
      telefono: texto(o(`P${i} - Telefono`)),
      visa: texto(o(`P${i} - Visa Número`)),
      venceVisa: fechaIso(o(`P${i} - Visa Vencimiento`)),
    })
  }

  const aereos = [
    fila('Aéreos adulto', { tarifa: o('Valor Adulto Vuelos'), cantidad: o('Cantidad Adultos Vuelos'), total: o('Valor total Adultos Vuelos') }),
    fila('Aéreos niño', { tarifa: o('Valor Niño Vuelos'), cantidad: o('Cantidad Niños Vuelos'), total: o('Valor total Niños Vuelos') }),
  ].filter((f): f is ContratoLiquidacionFila => f !== null)

  const terrestre = [
    ['Adulto sencilla', 'ADL Sencillo'],
    ['Adulto doble', 'ADL Doble'],
    ['Adulto múltiple', 'ADL Multiple'],
    ['Niño', 'Valor Niño'],
    ['Infante', 'Valor Infante'],
  ]
    .map(([concepto, p]) =>
      fila(concepto, {
        tarifa: o(`${p} - Tarifa por pax`),
        cantidad: o(`${p} - Cantidad`),
        plan: o(`${p} - Valor Plan`),
        total: o(`${p} - Valor Total`),
      })
    )
    .filter((f): f is ContratoLiquidacionFila => f !== null)

  const suma = [...aereos, ...terrestre].reduce((t, f) => t + f.valorTotal, 0)
  const trm = numero(o('TRM - T/C'))

  const pagos: ContratoPago[] = []
  for (let i = 1; i <= MAX_PAGOS; i++) {
    const p = (campo: string) => o(`Pago ${i} - ${campo}`)
    const abono = numero(p('Abono'))
    const fecha = fechaIso(p('Fecha de Pago'))
    if (!abono && !fecha) continue
    pagos.push({
      fecha,
      medio: texto(p('Medio de Pago')),
      trm: numero(p('TRM')),
      totalPlan: numero(p('Total Plan')),
      abono,
      saldo: numero(p('Saldo en Pesos')),
    })
  }

  const titular = texto(o('Titular de la Reserva')) ?? e.contacto.nombre ?? e.facturacion.nombre ?? ''
  // Documento del titular: el de la factura si es la misma persona; si no, el
  // del pasajero con el mismo nombre.
  const mismo = (a?: string, b?: string) => !!a && !!b && a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0
  const docTitular =
    (mismo(e.facturacion.nombre, titular) ? e.facturacion.documento : undefined) ??
    pasajeros.find(p => mismo(p.nombre, titular))?.documento ??
    e.facturacion.documento

  return {
    reserva: texto(o('TWC')) ?? '',
    fechaContrato: fechaIso(o('Fecha del contrato')) ?? e.hoy,
    producto: texto(o('Tipo de Contrato')),
    destino: texto(o('Destino de interés')),
    agente: e.agente,
    facturacion: e.facturacion,
    titular: {
      nombre: titular,
      documento: docTitular,
      telefono: texto(o('Telefono del Titular')) ?? e.contacto.telefono,
    },
    viaje: {
      fechaIda: fechaIso(o('Fecha confirmada de salida')),
      fechaRegreso: fechaIso(o('Fecha confirmada de regreso')),
      noches: numero(o('Numero de noches')),
      habitaciones: texto(o('Cantidad de Habitaciones')),
      plan: texto(o('Tipo de paquete')),
      acomodacion: texto(o('Acomodacion')),
      totalPersonas: numero(o('Pax total')) ?? (pasajeros.length || undefined),
    },
    observaciones: texto(o('Peticiones especiales')),
    notas: texto(o('Notas Importantes')),
    trayectos,
    pasajeros,
    liquidacion: {
      aereos,
      terrestre,
      total: {
        cantidad: numero(o('Total Pasajeros - Cantidad')),
        valorPlan: numero(o('Total Pasajeros - Valor Plan')),
        valorTotal: numero(o('Total Pasajeros - Valor Total')) ?? suma,
      },
      dolares: trm
        ? { trm, valorPlan: numero(o('TRM - Valor Plan')), valorTotal: numero(o('TRM - Valor Total')) }
        : undefined,
    },
    pagos,
    incluye: lista(o('Inclusiones')),
    noIncluye: lista(o('No incluye')),
    condicionesObservaciones: texto(o('Observaciones')),
  }
}
