// Información oficial de Travel World Colombia.
// NAP idéntico en footer, contacto, Schema.org y Google Business Profile.

export const SITE = {
  nombre: 'Travel World Colombia',
  rnt: '27287',
  rntMayorista: '118011',
  rntVerificarUrl: 'https://www.rues.org.co/registro-nt',
  // Fuente única de la URL del sitio. En local/preview cae al dominio de
  // Vercel; al conectar el dominio propio basta con definir NEXT_PUBLIC_SITE_URL
  // en Vercel (Production) — no hay que tocar código.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travel-world-colombia.vercel.app',
  email: 'agencia@travelworldcolombia.com',

  // NAP — Name, Address, Phone (no modificar el formato sin actualizar GBP/Schema)
  direccion: 'C.C. Manila, Transversal 12 #22-42, Local 126',
  ciudad: 'Fusagasugá',
  region: 'Cundinamarca',
  pais: 'Colombia',

  horario: 'Lun–Vie 9am–5pm · Sáb 9am–1pm · Dom cerrado',

  // Reseñas de Google (actualizar a mano; el conteo automático necesitaría la
  // API de Google Places con su key). Familias atendidas: récord contable de
  // facturación — solo facturas, sin contar que algunas son grupos.
  reseñas: 196,
  familias: '1.500',
} as const

export const WHATSAPP = {
  // Los dos son oficiales (aviso antisuplantación, 16-oct-2026).
  principal: '573204891930',
  alterno: '573005693381',
  telefonoDisplay: '+57 320 489 1930',
} as const

/** URL de WhatsApp con mensaje pre-cargado por destino. */
export function whatsappUrl(destino?: string): string {
  const texto = destino
    ? `Hola! Me interesa información sobre viajes a ${destino} 🌎`
    : 'Hola! Me interesa información sobre sus planes de viaje 🌎'
  return `https://wa.me/${WHATSAPP.principal}?text=${encodeURIComponent(texto)}`
}

/** URL de WhatsApp para reservar un programa (mensaje personalizado). */
export function whatsappReservaUrl(destino: string): string {
  const texto = `Hola! Quiero reservar el viaje a ${destino} ✈️`
  return `https://wa.me/${WHATSAPP.principal}?text=${encodeURIComponent(texto)}`
}

/** URL de WhatsApp para resolver dudas sobre un programa. */
export function whatsappDudasUrl(destino: string): string {
  const texto = `Hola! Tengo algunas dudas sobre el viaje a ${destino} 🙂`
  return `https://wa.me/${WHATSAPP.principal}?text=${encodeURIComponent(texto)}`
}

/** URL de WhatsApp para consultar una opción de hospedaje de un programa. */
export function whatsappHospedajeUrl(destino: string, opcion: string, habitacion?: string): string {
  const hab = habitacion ? `, habitación ${habitacion}` : ''
  const texto = `Hola! Me interesa el viaje a ${destino} con hospedaje ${opcion}${hab} 🏨`
  return `https://wa.me/${WHATSAPP.principal}?text=${encodeURIComponent(texto)}`
}

export const SOCIALS = {
  facebook: 'https://www.facebook.com/travelworldcolombia',
  instagram: 'https://www.instagram.com/travelworldcolombiaoficial',
  youtube: 'https://www.youtube.com/channel/UCKqasbJnPkIhquMuC3o4_ew',
  tiktok: 'https://www.tiktok.com/@travelworldcolombia',
  maps: 'https://maps.app.goo.gl/sSk1CrrgasCvVvEL8',
} as const

export const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/destinos', label: 'Destinos' },
  { href: '/cruceros', label: 'Cruceros' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/pagos', label: 'Pagos' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contacto' },
] as const

/**
 * Submenú de Servicios en el navbar. Los slugs deben coincidir con los `id`
 * de las tarjetas en app/servicios/page.tsx (anclas #slug); Cruceros enlaza
 * a su propia página.
 */
export const SERVICIOS_MENU = [
  { label: 'Vuelos', href: '/servicios#vuelos' },
  { label: 'Alojamientos', href: '/servicios#alojamientos' },
  { label: 'Paquetes', href: '/servicios#paquetes' },
  { label: 'Circuitos', href: '/servicios#circuitos' },
  { label: 'Actividades', href: '/servicios#actividades' },
  { label: 'Parques temáticos', href: '/servicios#parques-tematicos' },
  { label: 'Alquiler de vehículos', href: '/servicios#alquiler-de-vehiculos' },
  { label: 'Seguro de viajes', href: '/servicios#seguro-de-viajes' },
  { label: 'SIM card', href: '/servicios#sim-card' },
  { label: 'Tickets de tren', href: '/servicios#tickets-de-tren' },
  { label: 'Cruceros', href: '/cruceros' },
] as const
