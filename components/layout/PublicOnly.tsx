'use client'

import { usePathname } from 'next/navigation'

/**
 * Oculta su contenido en el panel admin y en el portal de documentos. El
 * backend (/admin) no debe mostrar el chrome del sitio público (navbar,
 * footer, botón de WhatsApp), y /documentos/<token>, /contrato/* y /estado-de-cuenta/* son páginas de tarea
 * para el cliente (tomar fotos desde el celular) que no necesita el menú ni
 * debe alimentar el píxel.
 */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/documentos') || pathname?.startsWith('/contrato') || pathname?.startsWith('/estado-de-cuenta')) return null
  return <>{children}</>
}
