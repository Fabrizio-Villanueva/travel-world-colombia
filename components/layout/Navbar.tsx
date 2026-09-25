'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NAV_LINKS, SERVICIOS_MENU, SITE } from '@/lib/site'
import { scrollBehavior } from '@/components/ui/useReducedMotion'
import type { ColumnaMenu, ItemMenu } from '@/lib/menuDestinos'

interface NavbarProps {
  /** Menú "Destinos" con sus submenús por región (lo arma el layout en el servidor). */
  destinosMenu: ItemMenu[]
}

type SubItem = ItemMenu

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

/** ¿El foco llegó con teclado? (con mouse, un clic deja el foco en el enlace). */
const conTeclado = (el: EventTarget) => el instanceof HTMLElement && el.matches(':focus-visible')

/**
 * Item del navbar desktop con panel desplegable.
 *
 * Se abre al pasar el cursor y se cierra apenas sale del menú. El foco solo lo
 * mantiene abierto si llegó con teclado: antes, el clic dejaba el foco en el
 * enlace y el panel seguía abierto aunque el cursor ya se hubiera ido.
 *
 * Los ítems con `hijos` (regiones de Destinos) abren un submenú lateral con
 * sus destinos. El cambio entre submenús espera un instante para que cruzar
 * en diagonal hacia el submenú no active la región de abajo.
 */
function DropdownDesktop({ label, href, items, onItemClick }: {
  label: string
  href: string
  items: SubItem[]
  onItemClick?: (e: React.MouseEvent, item: { href: string; esFiltro?: boolean }) => void
}) {
  const [hover, setHover] = useState(false)
  const [foco, setFoco] = useState(false)
  const [activo, setActivo] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const abierto = hover || foco
  const triggerRef = useRef<HTMLAnchorElement>(null)
  const conSubmenus = items.some(i => i.hijos)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const cerrar = () => {
    window.clearTimeout(timer.current)
    setHover(false)
    setFoco(false)
    setActivo(null)
  }

  // Abre al instante si no hay otro submenú abierto; si lo hay, espera.
  const apuntar = (clave: string) => {
    window.clearTimeout(timer.current)
    if (activo === null) setActivo(clave)
    else timer.current = window.setTimeout(() => setActivo(clave), 160)
  }

  const clic = (e: React.MouseEvent, item: { href: string; esFiltro?: boolean }) => {
    onItemClick?.(e, item)
    cerrar()
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const claseItem =
    'block rounded-lg px-4 py-2.5 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase text-(--text-primary) transition-colors hover:bg-white/5 hover:text-orange'
  const panel = {
    background: 'var(--dark)',
    border: '1px solid var(--border)',
    boxShadow: '0 16px 40px rgba(8, 18, 38, 0.5)',
  }

  return (
    <li
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={cerrar}
      onFocus={e => { if (conTeclado(e.target)) setFoco(true) }}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) cerrar()
      }}
      onKeyDown={e => {
        if (e.key === 'Escape' && abierto) {
          cerrar()
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
          Con muchos ítems (y sin submenús) el panel va a 2 columnas: si crece
          hacia abajo choca con el botón flotante de WhatsApp (z-50). */}
      <div className={`absolute left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 ${abierto ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <ul
          className={`relative ${items.length > 8 && !conSubmenus ? 'grid w-[26rem] grid-cols-2' : 'min-w-56'} rounded-xl p-2`}
          style={panel}
        >
          {items.map(item => {
            const conHijos = Boolean(item.hijos?.length)
            const visible = abierto && conHijos && activo === item.href
            return (
              <li
                key={item.href}
                onMouseEnter={() => apuntar(item.href)}
                onFocus={e => { if (conTeclado(e.target)) setActivo(item.href) }}
              >
                <Link
                  href={item.href}
                  onClick={e => clic(e, item)}
                  aria-expanded={conHijos ? visible : undefined}
                  className={`${claseItem} ${conHijos ? 'flex items-center justify-between gap-4' : ''} ${visible ? 'bg-white/5 text-orange' : ''}`}
                >
                  {item.label}
                  {conHijos && <ChevronRight size={13} aria-hidden className="hidden lg:block" />}
                </Link>
                {conHijos && (
                  <Submenu
                    visible={visible}
                    label={item.label}
                    columnas={item.hijos!}
                    verTodos={item}
                    estilo={panel}
                    onEnter={() => window.clearTimeout(timer.current)}
                    onClick={clic}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </li>
  )
}

/** Submenú lateral de una región: sus destinos (en columnas) y "Ver todos". */
function Submenu({ visible, label, columnas, verTodos, estilo, onEnter, onClick }: {
  visible: boolean
  label: string
  columnas: ColumnaMenu[]
  verTodos: { href: string; esFiltro?: boolean }
  estilo: React.CSSProperties
  onEnter: () => void
  onClick: (e: React.MouseEvent, item: { href: string; esFiltro?: boolean }) => void
}) {
  // Una región sin subgrupos y con muchos destinos se reparte en 2 columnas.
  const partir = columnas.length === 1 && columnas[0].items.length > 7
  const anchas = columnas.length > 1 || partir
  return (
    // Anclado a la lista del primer nivel (no al ítem): arranca arriba, a su
    // derecha; el pl-2 es un puente para no perder el hover al cruzar.
    // Solo desde lg: entre md y lg (tablet) no cabe a la derecha y la región
    // enlaza directo a su listado filtrado.
    <div
      onMouseEnter={onEnter}
      className={`absolute left-full top-0 hidden pl-2 transition-opacity duration-150 lg:block ${visible ? 'visible opacity-100' : 'invisible opacity-0'}`}
    >
      <div className={`rounded-xl p-4 ${anchas ? 'w-[34rem]' : 'w-72'}`} style={estilo}>
        <div className={`grid gap-x-6 gap-y-4 ${columnas.length > 1 ? 'grid-cols-2' : ''}`}>
          {columnas.map((col, i) => (
            <div key={col.titulo ?? i}>
              {col.titulo && (
                <p className="mb-2 px-3 font-plus-jakarta text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--eyebrow)' }}>
                  {col.titulo}
                </p>
              )}
              <ul className={partir ? 'grid grid-cols-2 gap-x-6' : ''}>
                {col.items.map(d => (
                  <li key={d.href}>
                    <Link
                      href={d.href}
                      onClick={e => onClick(e, d)}
                      className="block rounded-lg px-3 py-2 font-inter text-[13px] leading-snug text-(--text-primary) transition-colors hover:bg-white/5 hover:text-orange"
                    >
                      {d.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <Link
            href={verTodos.href}
            onClick={e => onClick(e, verTodos)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase transition-colors hover:bg-white/5"
            style={{ color: 'var(--orange)' }}
          >
            Ver todos · {label} <ChevronRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  )
}

export function Navbar({ destinosMenu }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [subAbierto, setSubAbierto] = useState<string | null>(null)
  // Tercer nivel en el móvil: la región desplegada dentro de "Destinos".
  const [regionAbierta, setRegionAbierta] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const destinosItems: SubItem[] = destinosMenu

  const serviciosItems: SubItem[] = SERVICIOS_MENU.map(s => ({ label: s.label, href: s.href }))

  const submenus: Record<string, SubItem[]> = {
    '/destinos': destinosItems,
    '/servicios': serviciosItems,
  }

  const onSubItemClick = (e: React.MouseEvent, item: { href: string; esFiltro?: boolean }) => {
    if (item.esFiltro) goFiltro(e, item.href)
  }

  const cerrarMovil = () => {
    setOpen(false)
    setSubAbierto(null)
    setRegionAbierta(null)
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
                      {items.map(item => {
                        const irA = (e: React.MouseEvent, destino: { href: string; esFiltro?: boolean }) => {
                          onSubItemClick(e, destino)
                          cerrarMovil()
                        }
                        const claseSub =
                          'block flex-1 py-2.5 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase text-(--text-dim) transition-colors hover:text-orange'
                        if (!item.hijos?.length) {
                          return (
                            <li key={item.href}>
                              <Link href={item.href} onClick={e => irA(e, item)} className={claseSub}>
                                {item.label}
                              </Link>
                            </li>
                          )
                        }
                        // Región con destinos: tercer nivel desplegable.
                        const regionOn = regionAbierta === item.href
                        return (
                          <li key={item.href}>
                            <div className="flex items-center">
                              <Link href={item.href} onClick={e => irA(e, item)} className={claseSub}>
                                {item.label}
                              </Link>
                              <button
                                type="button"
                                onClick={() => setRegionAbierta(regionOn ? null : item.href)}
                                aria-expanded={regionOn}
                                aria-label={`${regionOn ? 'Ocultar' : 'Ver'} destinos de ${item.label}`}
                                className="p-2.5"
                                style={{ color: 'var(--text-dim)' }}
                              >
                                <ChevronDown
                                  size={14}
                                  className="transition-transform"
                                  style={{ transform: regionOn ? 'rotate(180deg)' : 'none' }}
                                />
                              </button>
                            </div>
                            {regionOn && (
                              <div className="mb-2 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
                                {item.hijos.map((col, i) => (
                                  <div key={col.titulo ?? i} className="py-1">
                                    {col.titulo && (
                                      <p className="pt-1 font-plus-jakarta text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--eyebrow)' }}>
                                        {col.titulo}
                                      </p>
                                    )}
                                    <ul>
                                      {col.items.map(d => (
                                        <li key={d.href}>
                                          <Link
                                            href={d.href}
                                            onClick={cerrarMovil}
                                            className="block py-2 font-inter text-[13px] text-(--text-primary) transition-colors hover:text-orange"
                                          >
                                            {d.label}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
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
