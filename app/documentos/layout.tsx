import type { Metadata } from 'next'
import Image from 'next/image'
import { Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Documentos de tu viaje',
  robots: { index: false, follow: false },
}

/**
 * Armazón del portal de documentos: sin el menú ni el pie del sitio (los oculta
 * PublicOnly), con la marca y el candado arriba. Pensado para el celular: es
 * donde el cliente toma las fotos.
 */
export default function DocumentosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tema-claro flex min-h-screen flex-col" style={{ background: 'var(--bg-alt)' }}>
      <header className="px-4 py-3" style={{ background: 'var(--navy)' }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="rounded-md bg-white px-2.5 py-1.5">
            <Image
              src="/images/travel-world-colombia-logo.png"
              alt="Travel World Colombia"
              width={140}
              height={35}
              priority
              className="h-6 w-auto"
            />
          </span>
          <span className="flex items-center gap-1.5 font-inter text-xs" style={{ color: '#FFCC29' }}>
            <Lock size={13} /> Conexión cifrada
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      <footer className="px-4 py-5 text-center font-inter text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Travel World Colombia · RNT 27287 · Tus documentos viajan cifrados y solo los ve tu asesora.
      </footer>
    </div>
  )
}
