import { z } from 'zod'

export const PRESUPUESTO_OPCIONES = [
  { value: 'menos-2m',  label: 'Menos de $2.000.000 COP' },
  { value: '2m-5m',     label: '$2.000.000 – $5.000.000 COP' },
  { value: '5m-10m',    label: '$5.000.000 – $10.000.000 COP' },
  { value: 'mas-10m',   label: 'Más de $10.000.000 COP' },
] as const

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
] as const

// Los selects y radios sin elegir llegan como '' / null / NaN: se tratan como
// "no respondió" para que los campos opcionales pasen la validación.
const vacioAUndefined = (v: unknown) =>
  v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v

// Minimización de datos (Ley 1581): para cotizar bastan nombre, WhatsApp y
// destino. Viajeros, fechas y presupuesto ayudan al asesor pero son opcionales.
export const cotizacionSchema = z.object({
  nombre: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Nombre demasiado largo')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, 'Solo letras y espacios')
    .transform(val => val.trim()),

  whatsapp: z
    .string()
    .min(10, 'Ingresa los 10 dígitos de tu celular')
    .max(10, 'Solo 10 dígitos sin el prefijo +57')
    .regex(/^\d{10}$/, 'Debe ser un número de 10 dígitos'),

  destino_interes: z.string().min(1, 'Selecciona un destino').max(100),

  num_viajeros: z.preprocess(
    v => {
      const x = vacioAUndefined(v)
      return x === undefined ? undefined : Number(x)
    },
    z
      .number({ error: 'Número inválido' })
      .int()
      .min(1, 'Mínimo 1 viajero')
      .max(20, 'Máximo 20 viajeros')
      .optional()
  ),

  fecha_mes: z.preprocess(vacioAUndefined, z.enum(MESES, { error: 'Selecciona un mes válido' }).optional()),
  fecha_año: z.preprocess(
    vacioAUndefined,
    z
      .string()
      .regex(/^\d{4}$/, 'Selecciona un año')
      .refine(v => {
        const año = Number(v)
        const actual = new Date().getFullYear()
        return año >= actual && año <= actual + 3
      }, 'Selecciona un año válido')
      .optional()
  ),

  presupuesto: z.preprocess(
    vacioAUndefined,
    z
      .enum(['menos-2m', '2m-5m', '5m-10m', 'mas-10m'] as const, {
        error: 'Selecciona un rango de presupuesto',
      })
      .optional()
  ),

  mensaje: z.string().max(1000, 'Máximo 1000 caracteres').optional(),

  // Honeypot anti-bot
  website: z.string().max(0, 'Bot detectado').optional(),
})

export type CotizacionInput = z.infer<typeof cotizacionSchema>
/** Valores crudos del formulario (antes de validar). */
export type CotizacionFormValues = z.input<typeof cotizacionSchema>
