/**
 * Datos de un contrato de servicios turísticos, ya listos para imprimir.
 * El documento (components/contrato/ContratoDocumento.tsx) solo muestra lo que
 * trae: las listas (trayectos, pasajeros, liquidación, pagos) llevan
 * únicamente las filas que existen, así que no quedan espacios vacíos.
 *
 * Fechas en ISO (AAAA-MM-DD); dinero en pesos (number). Todo campo opcional
 * que venga vacío simplemente no se imprime.
 */

export interface ContratoTrayecto {
  ruta: string
  fechaSalida?: string
  horaSalida?: string
  horaLlegada?: string
  vuelo?: string
  aerolinea?: string
}

export interface ContratoPasajero {
  nombre: string
  /** "CC 1.023.456.789", "TI …": tipo y número ya juntos. */
  documento?: string
  fechaNacimiento?: string
  pasaporte?: string
  vencePasaporte?: string
  telefono?: string
  visa?: string
  venceVisa?: string
}

/** Fila de liquidación: aéreos o porción terrestre. */
export interface ContratoLiquidacionFila {
  concepto: string
  tarifaPorPax?: number
  cantidad?: number
  valorPlan?: number
  valorTotal: number
}

export interface ContratoPago {
  fecha?: string
  medio?: string
  trm?: number
  totalPlan?: number
  abono?: number
  saldo?: number
}

export interface ContratoDatos {
  /** Número de reserva TWC (el "TW-" lo pone el documento). */
  reserva: string
  fechaContrato: string
  producto?: string
  destino?: string
  /** Nombre de la asesora que hace la venta. */
  agente?: string

  facturacion: {
    nombre?: string
    documento?: string
    direccion?: string
    ciudad?: string
    correo?: string
    telefono?: string
  }
  titular: { nombre: string; telefono?: string }

  viaje: {
    fechaIda?: string
    fechaRegreso?: string
    noches?: number
    habitaciones?: string
    plan?: string
    acomodacion?: string
    totalPersonas?: number
  }
  observaciones?: string
  notas?: string

  trayectos: ContratoTrayecto[]
  pasajeros: ContratoPasajero[]

  liquidacion: {
    aereos: ContratoLiquidacionFila[]
    terrestre: ContratoLiquidacionFila[]
    total: { cantidad?: number; valorPlan?: number; valorTotal: number }
    /** Viajes cotizados en dólares: TRM y equivalentes. */
    dolares?: { trm: number; valorPlan?: number; valorTotal?: number }
  }
  pagos: ContratoPago[]

  incluye: string[]
  noIncluye: string[]
}
