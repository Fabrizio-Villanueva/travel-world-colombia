'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert, X } from 'lucide-react'

const CLAVE = 'aviso-seguridad-cerrado'

/**
 * Franja antisuplantación arriba de todo el sitio (16-oct-2026). Se puede
 * cerrar, pero solo por esta visita: vuelve a salir la próxima vez
 * (sessionStorage), porque es justo quien llega por un enlace de un
 * estafador quien tiene que verla.
 */
export function AvisoSeguridad({ mensaje, numero }: { mensaje: string; numero: string }) {
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    try {
      // Leer el almacenamiento solo existe en el navegador: se sincroniza tras montar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (sessionStorage.getItem(CLAVE)) setCerrado(true)
    } catch {
      /* sin almacenamiento: la franja se queda */
    }
  }, [])

  if (cerrado) return null

  function cerrar() {
    setCerrado(true)
    try {
      sessionStorage.setItem(CLAVE, '1')
    } catch {
      /* nada */
    }
  }

  return (
    <div role="alert" style={{ background: '#FFE08A', color: '#3D2E00', borderBottom: '2px solid #E0A800' }}>
      <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-2 sm:items-center sm:px-6">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 sm:mt-0" style={{ color: '#B42318' }} aria-hidden />
        {/* Celular: versión corta (el mensaje completo ocupaba media pantalla). */}
        <p className="flex-1 font-inter text-[12.5px] leading-snug sm:hidden">
          <strong>Cuidado con estafas.</strong> Único WhatsApp oficial:{' '}
          <strong className="whitespace-nowrap" style={{ color: '#B42318' }}>{numero}</strong>.{' '}
          <Link href="/verificar" className="whitespace-nowrap font-semibold underline underline-offset-2">
            Verificar
          </Link>
        </p>
        <p className="hidden flex-1 font-inter text-[13px] leading-snug sm:block">
          <strong>{mensaje}</strong>{' '}
          Único WhatsApp oficial:{' '}
          <strong className="whitespace-nowrap" style={{ color: '#B42318' }}>{numero}</strong>.{' '}
          <Link href="/verificar" className="whitespace-nowrap font-semibold underline underline-offset-2">
            Verifica un número aquí
          </Link>
        </p>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
