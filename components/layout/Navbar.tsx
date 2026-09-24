'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NAV_LINKS, SERVICIOS_MENU, SITE } from '@/lib/site'
import { scrollBehavior } from '@/components/ui/useReducedMotion'

interface NavbarProps {
  /** Regiones (continentes) con destinos activos, para el submenú de Destinos. */
  regiones: string[]
  /** Si hay destinos en Colombia, el submenú ofrece la entrada nacional. */
  hayNacionales: boolean
}

interface SubItem {
  label: string
  href: string
  /** Filtros del explorador de /destinos (?f=...) — ver goFiltro. */
  esFiltro?: boolean
}

/**
 * Mismo evento que dispara el explorador de /destinos al cambiar ?f= con
 * replaceState (replaceState no emite popstate). Si ya estamos en /destinos,
 * navegar con Link no re-monta el componente, así que actualizamos la URL a
 * mano y avisamos con el evento para que el filtro aplique al instante.
 */
const EVENTO_FILTRO = 'twc:filtro-destinos'

function goFiltro(e: React.MouseEvent, href: string) {
  if (window.location.pathname !== '/destinos') return // navegación normal de Link
  e.preventDefault()
  window.history.replaceState(null, '', href)
  window.dispatchEvent(new Event(EVENTO_FILTRO))
  // Directo al listado filtrado (o al tope si se eligió "Todos los destinos").
  const resultados = document.getElementById('resultados')
  if (href.includes('?f=') && resultados) {
    resultados.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  } else {
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
  }
}

/**
 * El color va en clase (no en style inline): un style inline pisa SIEMPRE a la
 * clase hover:text-orange y el resaltado amarillo al pasar el cursor nunca se
 * veía. text-(--text-primary) es el shorthand de Tailwind v4 para var().
 */
const estiloLink = {
  className:
    'u-underline font-plus-jakarta text-[11px] font-bold tracking-[0.15em] uppercase text-(--text-primary) transition-colors hover:text-orange',
} as const

/**
 * Item del navbar desktop con panel desplegable (hover y foco dentro).
 * Estado en React (antes solo CSS group-hover/focus-within) para exponer
 * aria-expanded y poder cerrarlo con Escape sin sacar el foco del enlace.
 */
function DropdownDesktop({ label, href, items, onItemClick }: {
  label: string
  href: string
  items: SubItem[]
  onItemClick?: (e: React.MouseEvent, item: SubItem) => void
}) {
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  const abierto = hover || foco
  const triggerRef = useRef<HTMLAnchorElement>(null)
  return (
    <li
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFoco(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false)
      }}
      onKeyDown={e => {
        if (e.key === 'Escape' && abierto) {
          setHover(false)
          setFoco(false)
          triggerRef.current?.focus()
        }
      }}
    >
      <Link ref={triggerRef} href={href} {...estiloLink} aria-expanded={abierto}>
        <span className="inline-flex items-center gap-1">
          {label}
          <ChevronDown size={12} aria-hidden className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </span>
      </Link>
      {/* pt-4 mantiene el hover al cruzar el espacio entre el link y el panel.
          Con muchos ítems el panel va a 2 columnas: si crece hacia abajo choca
          con el botón flotante de WhatsApp (z-50, por encima del header z-40). */}
      <div className={`absolute left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 ${abierto ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <ul
          className={`${items.length > 8 ? 'grid w-[26rem] grid-cols-2' : 'min-w-56'} rounded-xl p-2`}
          style={{
            background: 'var(--dark)',
            border: '1px solid var(--border)',
            boxShadow: '0 16px 40px rgba(8, 18, 38, 0.5)',
          }}
        >
          {items.map(item => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={e => onItemClick?.(e, item)}
                className="block rounded-lg px-4 py-2.5 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase text-(--text-primary) transition-colors hover:bg-white/5 hover:text-orange"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

export function Navbar({ regiones, hayNacionales }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [subAbierto, setSubAbierto] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const destinosItems: SubItem[] = [
    { label: 'Todos los destinos', href: '/destinos', esFiltro: true },
    ...(hayNacionales ? [{ label: 'Colombia', href: '/destinos?f=nacional', esFiltro: true }] : []),
    ...regiones.map(r => ({
      label: r,
      href: `/destinos?f=${encodeURIComponent(`region:${r}`)}`,
      esFiltro: true,
    })),
  ]

  const serviciosItems: SubItem[] = SERVICIOS_MENU.map(s => ({ label: s.label, href: s.href }))

  const submenus: Record<string, SubItem[]> = {
    '/destinos': destinosItems,
    '/servicios': serviciosItems,
  }

  const onSubItemClick = (e: React.MouseEvent, item: SubItem) => {
    if (item.esFiltro) goFiltro(e, item.href)
  }

  const cerrarMovil = () => {
    setOpen(false)
    setSubAbierto(null)
  }

  // Menú móvil accesible: al abrir, el foco entra al primer enlace; Tab queda
  // atrapado entre el botón y el menú; Escape cierra y devuelve el foco al botón.
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSubAbierto(null)
        toggleRef.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !menuRef.current || !toggleRef.current) return
      const enfocables = [
        toggleRef.current,
        ...menuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ]
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      const activo = document.activeElement
      if (e.shiftKey && activo === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus() }
      else if (!enfocables.includes(activo as HTMLElement)) { e.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 transition-all duration-300"
      style={{
        background: scrolled || open ? 'var(--dark)' : 'transparent',
        backdropFilter: scrolled || open ? 'blur(10px)' : 'none',
        borderBottom: scrolled || open ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"
      >
        <Link href="/" aria-label={`${SITE.nombre} — Inicio`} className="relative z-50">
          <Image
            src="/images/travel-world-colombia-logo-blanco.png"
            alt={SITE.nombre}
            width={192}
            height={50}
            priority
            className="h-9 w-auto"
          />
        </Link>

        {/* Links desktop */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(link => {
            const items = submenus[link.href]
            return items ? (
              <DropdownDesktop
                key={link.href}
                label={link.label}
                href={link.href}
                items={items}
                onItemClick={onSubItemClick}
              />
            ) : (
              <li key={link.href}>
                <Link href={link.href} {...estiloLink}>
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="hidden md:block">
          <Button href="/contacto" size="sm">Cotizar ahora</Button>
        </div>

        {/* Hamburger móvil */}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="relative z-50 md:hidden"
          style={{ color: 'var(--text-primary)' }}
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </nav>

      {/* Menú móvil */}
      {open && (
        <div
          ref={menuRef}
          id="mobile-menu"
          className="max-h-[calc(100svh-72px)] overflow-y-auto md:hidden"
          style={{ background: 'var(--overlay)', borderTop: '1px solid var(--border)' }}
        >
          <ul className="flex flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map(link => {
              const items = submenus[link.href]
              const abierto = subAbierto === link.href
              return (
                <li key={link.href}>
                  <div className="flex items-center">
                    <Link
                      href={link.href}
                      onClick={cerrarMovil}
                      className="block flex-1 py-3 font-plus-jakarta text-[12px] font-bold tracking-[0.15em] uppercase text-(--text-primary) transition-colors hover:text-orange"
                    >
                      {link.label}
                    </Link>
                    {items && (
                      <button
                        type="button"
                        onClick={() => setSubAbierto(abierto ? null : link.href)}
                        aria-expanded={abierto}
                        aria-label={`${abierto ? 'Cerrar' : 'Abrir'} submenú de ${link.label}`}
                        className="p-3"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <ChevronDown
                          size={16}
                          className="transition-transform"
                          style={{ transform: abierto ? 'rotate(180deg)' : 'none' }}
                        />
                      </button>
                    )}
                  </div>
                  {items && abierto && (
                    <ul className="mb-2 flex flex-col border-l pl-4" style={{ borderColor: 'var(--border)' }}>
                      {items.map(item => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={e => {
                              onSubItemClick(e, item)
                              cerrarMovil()
                            }}
                            className="block py-2.5 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase text-(--text-dim) transition-colors hover:text-orange"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
            <li className="pt-2">
              <Button href="/contacto" size="sm" className="w-full" onClick={cerrarMovil}>
                Cotizar ahora
              </Button>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
