import type { Metadata } from 'next'
import s from './layout.module.css'

export const metadata: Metadata = {
  title: 'Contrato de tu viaje',
  robots: { index: false, follow: false },
}

/**
 * Armazón de las páginas del contrato: sin el menú ni el pie del sitio (los
 * oculta PublicOnly). El documento trae su propia cabecera de marca.
 */
export default function ContratoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.marco}>{children}</div>
  )
}
