'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, ChevronsLeft, ChevronsRight, Globe, LogOut, Menu, X } from 'lucide-react'
import { signOut } from '../actions'
import type { Role } from '@/lib/admin/allowlist'
import { menuPara, opcionActiva, type Hijo, type Item } from './nav'

/** Cookie que recuerda el menú contraído (la lee el layout para no parpadear al cargar). */
const COOKIE_MENU = 'admin_menu'

export function Sidebar({ email, rol, superadmin = false, alertasCatalogo = 0, contraidoInicial = false }: {
  email: string
  rol: Role
  superadmin?: boolean
  alertasCatalogo?: number
  contraidoInicial?: boolean
}) {
  const pathname = usePathname()
  const [drawer, setDrawer] = useState(false)
  const [contraido, setContraido] = useState(contraidoInicial)
  const menu = menuPara(rol, superadmin)
  const activa = opcionActiva(menu, pathname)
  // Submenús abiertos a mano; el de la sección actual siempre se ve abierto.
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set())

  function alternarMenu() {
    const nuevo = !contraido
    setContraido(nuevo)
    document.cookie = `${COOKIE_MENU}=${nuevo ? 'mini' : 'full'}; path=/admin; max-age=31536000; SameSite=Lax`
    // El layout corre el contenido según este atributo (sin recargar).
    document.getElementById('admin-raiz')?.setAttribute('data-menu', nuevo ? 'mini' : 'full')
  }

  const hrefDe = (h: Hijo) => (h.href === '/admin/sol' && superadmin ? '/admin/sol/resultados' : h.href)
  const contador = (n: number) => (
    <span className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none" style={{ background: '#dc2626', color: '#fff' }}>
      {n}
    </span>
  )

  /** Un ítem del menú. `mini` = barra contraída (solo icono, submenú flotante al pasar el mouse). */
  function renderItem(item: Item, mini: boolean, cerrar?: () => void) {
    const directo = item.hijos.length === 1 && item.hijos[0].label === item.label
    const esActivo = activa?.item.id === item.id
    const abierto = esActivo || abiertos.has(item.id)
    const alertas = item.hijos.some(h => h.alertas) ? alertasCatalogo : 0
    const estiloPadre = {
      background: esActivo && (directo || mini) ? 'var(--orange)' : 'transparent',
      color: esActivo && (directo || mini) ? 'var(--orange-contrast)' : esActivo ? 'var(--text-primary)' : 'var(--text-dim)',
      fontWeight: esActivo ? 600 : 400,
    }
    const clasePadre = `flex w-full items-center gap-3 rounded-md py-2.5 font-inter text-sm transition-colors hover:bg-white/5 ${mini ? 'justify-center px-0' : 'px-3'}`

    const enlaceHijo = (h: Hijo, flotante: boolean) => {
      const sel = activa?.hijo === h
      return (
        <li key={h.href}>
          <Link
            href={hrefDe(h)}
            onClick={cerrar}
            className={`flex items-center gap-2 rounded-md py-2 font-inter text-[13px] transition-colors hover:bg-white/5 ${flotante ? 'px-3' : 'pl-10 pr-3'}`}
            style={{
              background: sel ? 'var(--orange)' : 'transparent',
              color: sel ? 'var(--orange-contrast)' : 'var(--text-dim)',
              fontWeight: sel ? 600 : 400,
            }}
          >
            {h.label}
            {h.alertas && alertasCatalogo > 0 && contador(alertasCatalogo)}
          </Link>
        </li>
      )
    }

    return (
      <li key={item.id} className="group/item relative">
        {directo ? (
          <Link href={hrefDe(item.hijos[0])} onClick={cerrar} className={clasePadre} style={estiloPadre} title={mini ? item.label : undefined}>
            <item.Icon size={17} className="shrink-0" />
            {!mini && item.label}
          </Link>
        ) : mini ? (
          // Contraído: el icono lleva a la primera opción; el submenú flota al pasar el mouse.
          <Link href={hrefDe(item.hijos[0])} className={`${clasePadre} relative`} style={estiloPadre} aria-label={item.label}>
            <item.Icon size={17} className="shrink-0" />
            {alertas > 0 && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full" style={{ background: '#dc2626' }} />}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAbiertos(s => {
              const n = new Set(s)
              if (n.has(item.id)) n.delete(item.id)
              else n.add(item.id)
              return n
            })}
            className={clasePadre}
            style={estiloPadre}
            aria-expanded={abierto}
          >
            <item.Icon size={17} className="shrink-0" />
            {item.label}
            {!abierto && alertas > 0 ? contador(alertas) : null}
            <ChevronDown
              size={15}
              className={`${!abierto && alertas > 0 ? 'ml-1' : 'ml-auto'} shrink-0 transition-transform`}
              style={{ transform: abierto ? 'rotate(180deg)' : undefined }}
            />
          </button>
        )}

        {!directo && !mini && abierto && <ul className="mt-0.5 flex flex-col gap-0.5">{item.hijos.map(h => enlaceHijo(h, false))}</ul>}

        {mini && (
          <div className="invisible absolute left-full top-0 z-50 pl-2 opacity-0 transition-opacity group-hover/item:visible group-hover/item:opacity-100 group-focus-within/item:visible group-focus-within/item:opacity-100">
            <div className="min-w-56 rounded-md p-1.5 shadow-xl" style={{ background: 'rgb(8, 18, 38)', border: '1px solid var(--border)' }}>
              <p className="px-3 pb-1 pt-1.5 font-inter text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
              {!directo && <ul className="flex flex-col gap-0.5">{item.hijos.map(h => enlaceHijo(h, true))}</ul>}
            </div>
          </div>
        )}
      </li>
    )
  }

  function contenido(mini: boolean, cerrar?: () => void) {
    return (
      <div className="flex h-full flex-col">
        <Link
          href="/admin"
          onClick={cerrar}
          className="flex items-center justify-center px-3 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {mini ? (
            <span className="rounded-md bg-white p-1.5">
              <Image src="/images/travel-world-colombia-icono.png" alt="Travel World Colombia" width={28} height={28} className="h-7 w-7" />
            </span>
          ) : (
            <span className="rounded-md bg-white px-3 py-2">
              <Image src="/images/travel-world-colombia-logo.png" alt="Travel World Colombia" width={160} height={40} priority className="h-8 w-auto" />
            </span>
          )}
        </Link>

        <nav className={`flex-1 py-4 ${mini ? 'px-2' : 'overflow-y-auto px-3'}`}>
          {menu.map((g, gi) => (
            <div key={g.titulo ?? gi} className={gi > 0 ? 'mt-4' : undefined}>
              {gi > 0 &&
                (g.titulo && !mini ? (
                  <p className="mb-1.5 px-3 font-inter text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                    {g.titulo}
                  </p>
                ) : (
                  // Sin título (o contraído): una línea separa el grupo, para que no parezca parte del anterior.
                  <div className={`mb-3 border-t ${mini ? 'mx-2' : 'mx-3'}`} style={{ borderColor: 'var(--border)' }} />
                ))}
              <ul className="flex flex-col gap-0.5">{g.items.map(i => renderItem(i, mini, cerrar))}</ul>
            </div>
          ))}
        </nav>

        <div className={`py-3 ${mini ? 'px-2' : 'px-4'}`} style={{ borderTop: '1px solid var(--border)' }}>
          {!mini && <p className="mb-2 truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{email}</p>}
          <Link
            href="/"
            onClick={cerrar}
            title={mini ? 'Ir al sitio web' : undefined}
            className={`mb-2 flex w-full items-center gap-2 rounded-md py-2 font-inter text-xs transition-colors ${mini ? 'justify-center' : 'px-3'}`}
            style={{ color: 'var(--orange)', border: '1px solid var(--border-orange)' }}
          >
            <Globe size={14} />
            {!mini && 'Ir al sitio web'}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title={mini ? 'Cerrar sesión' : undefined}
              className={`flex w-full items-center gap-2 rounded-md py-2 font-inter text-xs ${mini ? 'justify-center' : 'px-3'}`}
              style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              <LogOut size={14} />
              {!mini && 'Cerrar sesión'}
            </button>
          </form>
          {!cerrar && (
            <button
              type="button"
              onClick={alternarMenu}
              title={mini ? 'Expandir menú' : undefined}
              className={`mt-2 flex w-full items-center gap-2 rounded-md py-2 font-inter text-xs transition-colors hover:bg-white/5 ${mini ? 'justify-center' : 'px-3'}`}
              style={{ color: 'var(--text-muted)' }}
            >
              {mini ? <ChevronsRight size={15} /> : <><ChevronsLeft size={15} /> Contraer menú</>}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Barra superior móvil */}
      <header
        className="tema-oscuro sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: 'rgba(8, 18, 38,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <Link href="/admin" className="flex items-center">
          <span className="rounded-md bg-white px-2.5 py-1.5">
            <Image src="/images/travel-world-colombia-logo.png" alt="Travel World Colombia" width={140} height={35} className="h-6 w-auto" />
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Menú fijo (escritorio): completo o contraído a iconos */}
      <aside
        className={`tema-oscuro fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 md:block ${contraido ? 'w-16' : 'w-60'}`}
        style={{ background: 'rgba(8, 18, 38,0.95)', borderRight: '1px solid var(--border)' }}
      >
        {contenido(contraido)}
      </aside>

      {/* Drawer móvil: siempre completo */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDrawer(false)} />
          <aside
            className="tema-oscuro absolute inset-y-0 left-0 w-64"
            style={{ background: 'var(--navy)', borderRight: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: 'var(--text-dim)' }}
            >
              <X size={18} />
            </button>
            {contenido(false, () => setDrawer(false))}
          </aside>
        </div>
      )}
    </>
  )
}
