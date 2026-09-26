import { z } from 'zod'

/** Validación de los campos escalares del formulario de destino. */
export const destinoSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.'),
  slug: z
    .string()
    .min(2, 'El slug es obligatorio.')
    .regex(/^[a-z0-9-]+$/, 'Slug: solo minúsculas, números y guiones (ej. punta-cana).'),
  pais: z.string().min(2, 'El país es obligatorio.'),
  region: z.string().optional(),
  transporte: z.enum(['bus', 'avion']).optional(),
  salida_fin_ano: z.boolean(),
  activo: z.boolean(),
  destacado: z.boolean(),
  orden: z.number().int().min(0),
  precio_desde: z.string().optional(),
  precio_valor: z.number().positive('El precio debe ser mayor a 0.').optional(),
  precio_moneda: z.enum(['COP', 'USD']).optional(),
  precio_nota: z.string().optional(),
  duracion: z.string().optional(),
  cupos_disponibles: z.number().int().min(0).optional(),

  frase_hero: z.string().optional(),
  autor_frase: z.string().optional(),
  cargo_autor: z.string().optional(),

  subtitulo: z.string().optional(),
  descripcion: z.string().optional(),

  incluye: z.array(z.string()).optional(),
  no_incluye: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),

  stats: z.array(z.object({ num: z.string(), label: z.string() })).optional(),
  highlights: z.array(z.object({ icono: z.string(), titulo: z.string(), descripcion: z.string(), imagen: z.string().optional(), precio: z.string().optional(), duracion: z.string().optional() })).optional(),
  info_clave: z.array(z.object({ icono: z.string(), label: z.string(), valor: z.string(), sub: z.string().optional() })).optional(),
  itinerario: z.array(z.object({ titulo: z.string(), badge: z.string().optional(), descripcion: z.string().optional(), fecha: z.string().optional(), imagen: z.string().optional() })).optional(),
  archivos: z.array(z.object({ titulo: z.string().min(1, 'Cada documento necesita un título.'), url: z.string().min(1), tipo: z.enum(['pdf', 'word']), bytes: z.number().optional() })).optional(),
  hospedaje: z.array(z.object({
    titulo: z.string().min(1, 'Cada opción de hospedaje necesita un título.'),
    estrellas: z.number().int().min(1).max(5).optional(),
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    ciudades: z.array(z.object({ nombre: z.string().min(1), hoteles: z.array(z.string()) })).optional(),
    amenidades: z.array(z.string()).optional(),
    habitaciones: z.array(z.object({ tipo: z.string().min(1), precio: z.string().optional() })).optional(),
  })).optional(),
  galeria: z.array(z.string()).optional(),

  cta_titulo: z.string().optional(),
  cta_subtitulo: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
}).superRefine((d, ctx) => {
  // Ambos opcionales (9 destinos no publican precio), pero en pareja: un valor
  // sin moneda no se puede formatear ni publicar en Schema.org, y viceversa.
  if ((d.precio_valor != null) !== (d.precio_moneda != null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['precio_valor'],
      message: 'Precio: indica valor y moneda juntos (o deja ambos vacíos).',
    })
  }
})

export type DestinoInput = z.infer<typeof destinoSchema>
