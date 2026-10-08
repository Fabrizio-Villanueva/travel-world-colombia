import type { ContratoDatos } from './tipos'

/**
 * Contrato de MUESTRA con datos inventados (para revisar el diseño en
 * /contrato/muestra). Ninguna persona ni documento es real.
 */
export const CONTRATO_MUESTRA: ContratoDatos = {
  reserva: '2048',
  fechaContrato: '2026-10-07',
  producto: 'Paquete turístico',
  destino: 'Punta Cana, República Dominicana',
  agente: 'Ginna Cardenas',

  facturacion: {
    nombre: 'Ana María Pérez Gómez',
    documento: 'CC 1.023.456.789',
    direccion: 'Calle 8 # 12-34',
    ciudad: 'Fusagasugá',
    correo: 'ana.perez@ejemplo.com',
    telefono: '300 123 4567',
  },
  titular: { nombre: 'Ana María Pérez Gómez', documento: 'CC 1.023.456.789', telefono: '300 123 4567' },

  viaje: {
    fechaIda: '2026-12-12',
    fechaRegreso: '2026-12-17',
    noches: 5,
    habitaciones: '1',
    plan: 'Todo incluido',
    acomodacion: 'Doble + niño',
    totalPersonas: 3,
  },
  observaciones: 'Habitación con vista al mar sujeta a disponibilidad del hotel. Celebran aniversario: el hotel recibe la solicitud de decoración.',
  notas: 'Presentarse en el aeropuerto El Dorado 3 horas antes del vuelo. Equipaje: 1 maleta de 23 kg por persona.',

  trayectos: [
    { ruta: 'Bogotá (BOG) → Punta Cana (PUJ)', fechaSalida: '2026-12-12', horaSalida: '06:40', horaLlegada: '10:55', vuelo: 'AV 254', aerolinea: 'Avianca' },
    { ruta: 'Punta Cana (PUJ) → Bogotá (BOG)', fechaSalida: '2026-12-17', horaSalida: '12:10', horaLlegada: '14:35', vuelo: 'AV 255', aerolinea: 'Avianca' },
  ],
  pasajeros: [
    { nombre: 'Ana María Pérez Gómez', documento: 'CC 1.023.456.789', fechaNacimiento: '1985-03-12', pasaporte: 'AB123456', vencePasaporte: '2030-05-01', telefono: '300 123 4567' },
    { nombre: 'Carlos Andrés Ruiz Díaz', documento: 'CC 80.123.456', fechaNacimiento: '1982-11-07', pasaporte: 'CD789012', vencePasaporte: '2029-08-15', telefono: '311 987 6543' },
    { nombre: 'Sofía Ruiz Pérez', documento: 'TI 1.098.765.432', fechaNacimiento: '2014-06-22', pasaporte: 'EF345678', vencePasaporte: '2031-01-30' },
  ],

  liquidacion: {
    aereos: [
      { concepto: 'Aéreos adulto', tarifaPorPax: 1_450_000, cantidad: 2, valorTotal: 2_900_000 },
      { concepto: 'Aéreos niño', tarifaPorPax: 1_320_000, cantidad: 1, valorTotal: 1_320_000 },
    ],
    terrestre: [
      { concepto: 'Adulto doble', tarifaPorPax: 2_380_000, cantidad: 2, valorPlan: 4_760_000, valorTotal: 4_760_000 },
      { concepto: 'Niño', tarifaPorPax: 1_150_000, cantidad: 1, valorPlan: 1_150_000, valorTotal: 1_150_000 },
    ],
    total: { cantidad: 3, valorPlan: 5_910_000, valorTotal: 10_130_000 },
  },
  pagos: [
    { fecha: '2026-10-07', medio: 'Transferencia Bancolombia', totalPlan: 10_130_000, abono: 3_000_000, saldo: 7_130_000 },
    { fecha: '2026-11-07', medio: 'PSE', totalPlan: 10_130_000, abono: 3_500_000, saldo: 3_630_000 },
  ],

  incluye: [
    'Tiquetes aéreos Bogotá – Punta Cana – Bogotá',
    'Traslados aeropuerto – hotel – aeropuerto',
    '5 noches de alojamiento en plan todo incluido',
    'Impuestos hoteleros',
    'Asistencia médica internacional',
  ],
  noIncluye: [
    'Gastos personales',
    'Excursiones no especificadas',
    'Propinas',
    'Equipaje adicional',
  ],
  condicionesObservaciones: 'No incluye impuesto ecoambiental: se paga directamente en el hotel.',
}

const ADULTOS_MUESTRA = [
  ['Ana María Pérez Gómez', 'CC 1.023.456.789', '1985-03-12', 'AB123456', '2030-05-01', '300 123 4567'],
  ['Carlos Andrés Ruiz Díaz', 'CC 80.123.456', '1982-11-07', 'CD789012', '2029-08-15', '311 987 6543'],
  ['Luis Fernando Gómez Rojas', 'CC 79.654.321', '1979-04-10', 'GH456789', '2031-02-20', '315 222 3344'],
  ['Marta Lucía Rojas Peña', 'CC 52.987.654', '1981-09-03', 'IJ112233', '2030-11-30', '316 444 5566'],
  ['Jorge Iván Castro Mejía', 'CC 1.015.222.333', '1988-08-10', 'KL445566', '2032-07-12', '318 777 8899'],
  ['Paula Andrea Mejía Ríos', 'CC 1.020.333.444', '1990-09-10', 'MN778899', '2031-05-05', '320 111 2233'],
  ['Andrés Felipe Torres Vega', 'CC 1.030.444.555', '1986-02-18', 'YZ606060', '2032-03-03', '301 222 3344'],
  ['Natalia Vega Suárez', 'CC 1.031.555.666', '1987-12-01', 'AA707070', '2030-09-09', '302 333 4455'],
  ['Ricardo Suárez León', 'CC 79.111.222', '1975-06-25', 'BB808080', '2029-12-12', '304 444 5566'],
  ['Claudia León Ortiz', 'CC 52.222.333', '1978-10-14', 'CC909090', '2031-06-06', '305 555 6677'],
] as const

const NINOS_MUESTRA = [
  ['Sofía Ruiz Pérez', 'TI 1.098.765.432', '2014-06-22', 'EF345678', '2031-01-30', ''],
  ['Daniel Gómez Rojas', 'TI 1.097.111.222', '2015-06-15', 'OP101010', '2030-04-18', ''],
  ['Valentina Gómez Rojas', 'TI 1.096.222.333', '2016-07-15', 'QR202020', '2031-03-09', ''],
  ['Tomás Castro Mejía', 'RC 1.110.333.444', '2019-01-15', 'ST303030', '2034-01-15', ''],
  ['Laura Castro Mejía', 'TI 1.095.444.555', '2012-02-15', 'UV404040', '2030-10-01', ''],
  ['Emilia Castro Mejía', 'TI 1.094.555.666', '2011-03-15', 'WX505050', '2031-12-24', ''],
  ['Mateo Torres Vega', 'TI 1.093.666.777', '2013-05-20', 'DD111111', '2032-02-02', ''],
  ['Isabella Torres Vega', 'RC 1.112.777.888', '2018-08-08', 'EE222222', '2033-08-08', ''],
  ['Samuel Suárez León', 'TI 1.092.888.999', '2010-11-11', 'FF333333', '2030-07-07', ''],
  ['Martina Suárez León', 'TI 1.091.999.000', '2013-04-04', 'GG444444', '2031-04-04', ''],
] as const

/**
 * La misma muestra con N personas (1–20): mitad adultos y mitad niños
 * (redondeando hacia los adultos), con liquidación y pagos recalculados.
 */
export function muestraConPasajeros(n: number): ContratoDatos {
  const total = Math.min(Math.max(Math.round(n), 1), ADULTOS_MUESTRA.length + NINOS_MUESTRA.length)
  const adultos = Math.ceil(total / 2)
  const ninos = total - adultos
  const elegidos = [...ADULTOS_MUESTRA.slice(0, adultos), ...NINOS_MUESTRA.slice(0, ninos)]
  const pasajeros = elegidos.map(([nombre, documento, fechaNacimiento, pasaporte, vencePasaporte, telefono]) => ({
    nombre, documento, fechaNacimiento, pasaporte, vencePasaporte, telefono: telefono || undefined,
  }))

  const fila = (concepto: string, tarifa: number, cantidad: number, conPlan: boolean) =>
    cantidad > 0
      ? [{ concepto, tarifaPorPax: tarifa, cantidad, valorPlan: conPlan ? tarifa * cantidad : undefined, valorTotal: tarifa * cantidad }]
      : []
  const aereos = [...fila('Aéreos adulto', 1_450_000, adultos, false), ...fila('Aéreos niño', 1_320_000, ninos, false)]
  const terrestre = [...fila('Adulto doble', 2_380_000, adultos, true), ...fila('Niño', 1_150_000, ninos, true)]
  const valorTotal = [...aereos, ...terrestre].reduce((t, f) => t + f.valorTotal, 0)
  const valorPlan = terrestre.reduce((t, f) => t + f.valorTotal, 0)
  const abono1 = Math.round((valorTotal * 0.3) / 1000) * 1000
  const abono2 = Math.round((valorTotal * 0.35) / 1000) * 1000

  return {
    ...CONTRATO_MUESTRA,
    viaje: {
      ...CONTRATO_MUESTRA.viaje,
      habitaciones: String(Math.ceil(total / 3)),
      acomodacion: ninos > 0 ? 'Doble + niños' : 'Doble',
      totalPersonas: total,
    },
    pasajeros,
    liquidacion: { aereos, terrestre, total: { cantidad: total, valorPlan, valorTotal } },
    pagos: [
      { fecha: '2026-10-07', medio: 'Transferencia Bancolombia', totalPlan: valorTotal, abono: abono1, saldo: valorTotal - abono1 },
      { fecha: '2026-11-07', medio: 'PSE', totalPlan: valorTotal, abono: abono2, saldo: valorTotal - abono1 - abono2 },
    ],
  }
}
