import {
  Activity, Bot, ClipboardList, FileCheck, Globe, LayoutDashboard, Plane, Users, type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/admin/allowlist'

/**
 * Menú del panel, ordenado al estilo de WordPress (15-oct-2026): Ventas con
 * acceso directo (contratos y documentos), luego una pestaña por tema con su
 * submenú (Sol, Viajes, Contenido del sitio) y Administración; permisos por
 * opción. Las direcciones no cambian (GHL
 * enlaza /admin/reservas dentro de un iframe).
 */

export interface Hijo {
  href: string
  label: string
  /** Rutas que también la marcan activa (p. ej. la ficha de un viaje). */
  incluye?: string[]
  /** Solo esta ruta exacta (sin subrutas). */
  exacta?: boolean
  soloAdmin?: boolean
  soloSuperadmin?: boolean
  /** La única opción que ve el rol representante (asesoras). */
  representante?: boolean
  /** El lector no la ve: escribe en el CRM. */
  sinLector?: boolean
  /** Muestra el contador de alertas del catálogo. */
  alertas?: boolean
}

export interface Item {
  id: string
  label: string
  Icon: LucideIcon
  hijos: Hijo[]
}

export interface Grupo {
  titulo?: string
  items: Item[]
}

export const MENU: Grupo[] = [
  {
    items: [
      { id: 'inicio', label: 'Inicio', Icon: LayoutDashboard, hijos: [{ href: '/admin', label: 'Inicio', exacta: true }] },
    ],
  },
  {
    // Acceso inmediato (pedido del 15-oct-2026): sin submenú que abrir.
    titulo: 'Ventas',
    items: [
      {
        id: 'reservas',
        label: 'Generador de contratos',
        Icon: ClipboardList,
        hijos: [{ href: '/admin/reservas', label: 'Generador de contratos', representante: true, sinLector: true, incluye: ['/admin/contratos'] }],
      },
      {
        id: 'documentos',
        label: 'Documentos de viajeros',
        Icon: FileCheck,
        hijos: [{ href: '/admin/documentos', label: 'Documentos de viajeros' }],
      },
    ],
  },
  {
    // Un solo nivel de títulos: cada pestaña con su submenú, sin grupo encima.
    items: [
      {
        id: 'sol',
        label: 'Sol',
        Icon: Bot,
        hijos: [
          // Resultados, reglas, A/B, reactivación y laboratorio son pestañas de esta sección.
          { href: '/admin/sol', label: 'Resultados y configuración', soloAdmin: true },
          { href: '/admin/anuncios', label: 'Anuncios de Meta' },
        ],
      },
      {
        id: 'viajes',
        label: 'Viajes',
        Icon: Plane,
        hijos: [
          { href: '/admin/viajes', label: 'Todos los viajes', incluye: ['/admin/destinos'] },
          { href: '/admin/destinos/nuevo', label: 'Añadir viaje', exacta: true },
          { href: '/admin/categorias', label: 'Categorías' },
          { href: '/admin/catalogo', label: 'Salud del catálogo', alertas: true },
        ],
      },
      {
        id: 'sitio',
        label: 'Contenido del sitio',
        Icon: Globe,
        hijos: [
          { href: '/admin/textos', label: 'Textos del sitio' },
          { href: '/admin/paginas', label: 'Políticas y términos y condiciones' },
          { href: '/admin/faqs', label: 'Preguntas frecuentes' },
          { href: '/admin/resenas', label: 'Reseñas' },
        ],
      },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { id: 'usuarios', label: 'Usuarios', Icon: Users, hijos: [{ href: '/admin/usuarios', label: 'Usuarios', soloAdmin: true }] },
      { id: 'actividad', label: 'Actividad', Icon: Activity, hijos: [{ href: '/admin/actividad', label: 'Actividad', soloAdmin: true }] },
    ],
  },
]

/** ¿El rol ve esta opción? (Las páginas además validan su propio acceso.) */
export function puedeVer(h: Hijo, rol: Role, superadmin: boolean): boolean {
  if (h.soloSuperadmin && !superadmin) return false
  if (h.soloAdmin && rol !== 'admin') return false
  if (rol === 'representante') return !!h.representante
  if (rol === 'lector' && h.sinLector) return false
  return true
}

/** Menú recortado a lo que ve el rol: sin opciones, ítems ni grupos vacíos. */
export function menuPara(rol: Role, superadmin: boolean): Grupo[] {
  return MENU.map(g => ({
    ...g,
    items: g.items
      .map(i => ({ ...i, hijos: i.hijos.filter(h => puedeVer(h, rol, superadmin)) }))
      .filter(i => i.hijos.length > 0),
  })).filter(g => g.items.length > 0)
}

/** Largo del prefijo con que la opción coincide con la ruta (0 = no coincide). */
function coincidencia(h: Hijo, pathname: string): number {
  if (h.exacta) return pathname === h.href ? h.href.length + 1000 : 0
  let mejor = 0
  for (const base of [h.href, ...(h.incluye ?? [])]) {
    if (pathname === base || pathname.startsWith(base + '/')) mejor = Math.max(mejor, base.length)
  }
  return mejor
}

/** La opción activa: la de prefijo más largo (así "Añadir viaje" gana a "Todos los viajes"). */
export function opcionActiva(menu: Grupo[], pathname: string): { grupo: Grupo; item: Item; hijo: Hijo } | null {
  let mejor: { grupo: Grupo; item: Item; hijo: Hijo; n: number } | null = null
  for (const grupo of menu) {
    for (const item of grupo.items) {
      for (const hijo of item.hijos) {
        const n = coincidencia(hijo, pathname)
        if (n > 0 && (!mejor || n > mejor.n)) mejor = { grupo, item, hijo, n }
      }
    }
  }
  return mejor
}
