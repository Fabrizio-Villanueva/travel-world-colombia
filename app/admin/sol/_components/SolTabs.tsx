'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, FlaskConical, RefreshCw, Split, TrendingUp } from 'lucide-react'

// Orden por prioridad de la estrategia: primero si Sol está dando resultados,
// luego lo que se ajusta en el día a día, los experimentos en curso y al
// final la herramienta de pruebas.
const TABS: { href: string; label: string; Icon: typeof Bot; exact?: boolean; soloSuperadmin?: boolean }[] = [
  { href: '/admin/sol/resultados', label: 'Resultados', Icon: TrendingUp, soloSuperadmin: true },
  { href: '/admin/sol', label: 'Reglas comerciales', Icon: Bot, exact: true },
  { href: '/admin/sol/ab', label: 'Prueba A/B', Icon: Split },
  { href: '/admin/sol/reactivacion', label: 'Reactivación A/B', Icon: RefreshCw },
  { href: '/admin/sol/laboratorio', label: 'Laboratorio', Icon: FlaskConical },
]

/** Pestañas de la sección Sol (una sola entrada en el menú lateral). */
export function SolTabs({ superadmin }: { superadmin: boolean }) {
  const pathname = usePathname()
  const tabs = TABS.filter(t => !t.soloSuperadmin || superadmin)

  return (
    <nav className="mb-8 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
      <ul className="flex min-w-max gap-1">
        {tabs.map(({ href, label, Icon, exact }) => {
          const activa = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className="-mb-px flex items-center gap-2 px-4 py-2.5 font-inter text-sm transition-colors"
                style={{
                  borderBottom: `2px solid ${activa ? 'var(--orange)' : 'transparent'}`,
                  color: activa ? 'var(--text-primary)' : 'var(--text-dim)',
                  fontWeight: activa ? 600 : 400,
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
