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
}
