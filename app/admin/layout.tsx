import type { Metadata } from 'next'
import { getAdminSession } from '@/lib/admin/guard'
import { Sidebar } from './_components/Sidebar'
import { contarGraves } from '@/lib/catalogo/salud'

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // En /admin/login y /admin/registro no hay sesión aprobada → sin chrome.
  const session = await getAdminSession()

  if (!session) {
    return (
      <div className="min-h-screen" style={{ background: '#f4f7fb' }}>
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    )
  }

  return (
    <div className="tema-claro min-h-screen" style={{ background: 'var(--bg-alt)' }}>
      <Sidebar
        email={session.user.email ?? ''}
        rol={session.rol}
        alertasCatalogo={session.rol === 'representante' ? 0 : await contarGraves()}
      />
      <div className="md:pl-60">
        {/* Marca de agua tenue del logo en el fondo */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 md:left-60"
          style={{
            zIndex: 0,
            backgroundImage: 'url(/images/travel-world-colombia-logo.png)',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'min(900px, 85%) auto',
            opacity: 0.14,
            filter: 'grayscale(0) saturate(1.3)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  )
}
