'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Plane, Star, HelpCircle, Users, Activity, Globe, LogOut, Menu, X,
  ClipboardList, Tags, Megaphone,
} from 'lucide-react'
import { signOut } from '../actions'
import type { Role } from '@/lib/admin/allowlist'

const NAV = [
  { href: '/admin',             label: 'Dashboard',    Icon: LayoutDashboard, exact: true },
  { href: '/admin/viajes',      label: 'Viajes',       Icon: Plane },
  { href: '/admin/categorias',  label: 'Categorías',   Icon: Tags },
  { href: '/admin/anuncios',    label: 'Anuncios',     Icon: Megaphone },
  { href: '/admin/reservas',    label: 'Generador de Contratos', Icon: ClipboardList },
  { href: '/admin/resenas',     label: 'Reseñas',      Icon: Star },
  { href: '/admin/faqs',        label: 'Preguntas',    Icon: HelpCircle },
  { href: '/admin/usuarios',    label: 'Usuarios',     Icon: Users },
  { href: '/admin/actividad',   label: 'Actividad',    Icon: Activity },
]

export function Sidebar({ email, rol }: { email: string; rol: Role }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // El representante solo ve Reservas (el proxy además lo redirige ahí);
  // el lector ve el panel pero no Reservas (la sección escribe en el CRM).
  const nav = NAV.filter(item =>
    rol === 'representante'
      ? item.href === '/admin/reservas'
      : rol === 'lector'
        ? item.href !== '/admin/reservas'
        : true
  )

  const esActiva = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const Contenido = (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={() => setOpen(false)}
        className="flex items-center justify-center px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="rounded-md bg-white px-3 py-2">
          <Image
            src="/images/travel-world-colombia-logo.png"
            alt="Travel World Colombia"
            width={160}
            height={40}
            priority
            className="h-8 w-auto"
          />
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {nav.map(({ href, label, Icon, exact }) => {
            const activa = esActiva(href, exact)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 font-inter text-sm transition-colors"
                  style={{
                    background: activa ? 'var(--orange)' : 'transparent',
                    color: activa ? 'var(--orange-contrast)' : 'var(--text-dim)',
                    fontWeight: activa ? 600 : 400,
                  }}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="mb-2 truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{email}</p>
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="mb-2 flex w-full items-center gap-2 rounded-md px-3 py-2 font-inter text-xs transition-colors"
          style={{ color: 'var(--orange)', border: '1px solid var(--border-orange)' }}
        >
          <Globe size={14} />
          Ir al sitio web
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-inter text-xs"
            style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Barra superior móvil */}
      <header
        className="tema-oscuro sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: 'rgba(8, 18, 38,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <Link href="/admin" className="flex items-center">
          <span className="rounded-md bg-white px-2.5 py-1.5">
            <Image
              src="/images/travel-world-colombia-logo.png"
              alt="Travel World Colombia"
              width={140}
              height={35}
              className="h-6 w-auto"
            />
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Sidebar fijo (desktop) */}
      <aside
        className="tema-oscuro fixed inset-y-0 left-0 z-30 hidden w-60 md:block"
        style={{ background: 'rgba(8, 18, 38,0.95)', borderRight: '1px solid var(--border)' }}
      >
        {Contenido}
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpen(false)} />
          <aside
            className="tema-oscuro absolute inset-y-0 left-0 w-64"
            style={{ background: 'var(--navy)', borderRight: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: 'var(--text-dim)' }}
            >
              <X size={18} />
            </button>
            {Contenido}
          </aside>
        </div>
      )}
    </>
  )
}
