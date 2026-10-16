'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

const CLAVE = 'aviso-popup-visto'

/**
 * Pop-up antisuplantación al entrar al sitio (16-oct-2026), con la pieza
 * "Estas son nuestras únicas cuentas y canales de atención". Una vez por
 * visita (sessionStorage): quien llega por el enlace de un estafador lo ve
 * de entrada. Se cierra con la ✕, "Entendido", Esc o tocando fuera.
 * La imagen lleva todo el texto en `alt` para lectores de pantalla.
 */
export function PopupSeguridad({ numero }: { numero: string }) {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // En /verificar ya está toda la información.
    if (pathname === '/verificar') return
    try {
      if (sessionStorage.getItem(CLAVE)) return
    } catch {
      /* sin almacenamiento: se muestra */
    }
    // Leer el almacenamiento solo existe en el navegador: se abre tras montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbierto(true)
  }, [pathname])

  useEffect(() => {
    if (!abierto) return
    boton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [abierto])

  function cerrar() {
    setAbierto(false)
    try {
      sessionStorage.setItem(CLAVE, '1')
    } catch {
      /* nada */
    }
  }

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 12, 28, 0.72)', backdropFilter: 'blur(3px)' }}
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aviso de seguridad: nuestros únicos canales de atención"
        className="relative flex max-h-full flex-col overflow-hidden rounded-2xl shadow-2xl"
        // Ancho según el alto disponible: la pieza (9:16) cabe entera sin desplazarse.
        style={{ background: '#0D1E3C', width: 'min(420px, 100%, calc((100dvh - 110px) * 0.5625))' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/60"
          style={{ background: 'rgba(0,0,0,0.45)', color: 'white' }}
        >
          <X size={18} aria-hidden />
        </button>

        <div>
          <Image
            src="/images/aviso-canales-oficiales.webp"
            alt={`Recuerda que estas son nuestras únicas cuentas y canales de atención: Facebook Travel World Colombia; Instagram travelworldcolombiaoficial; TikTok @travelworldcolombia; teléfono ${numero}; página web www.travelworldcolombia.com. No tenemos más líneas oficiales. Evita fraudes.`}
            width={900}
            height={1600}
            priority
            // Ya es WebP liviano (~200 KB): se sirve tal cual, sin pasar por el optimizador.
            unoptimized
            className="h-auto w-full"
          />
        </div>

        <div className="flex gap-2 p-3" style={{ background: '#0D1E3C' }}>
          <Link
            href="/verificar"
            onClick={cerrar}
            className="flex-1 rounded-lg px-3 py-3 text-center font-plus-jakarta text-sm font-bold"
            style={{ border: '1px solid rgba(255,255,255,0.35)', color: 'white' }}
          >
            Verificar un número
          </Link>
          <button
            ref={boton}
            type="button"
            onClick={cerrar}
            className="flex-1 rounded-lg px-3 py-3 font-plus-jakarta text-sm font-bold"
            style={{ background: '#F5B700', color: '#0D1E3C' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
