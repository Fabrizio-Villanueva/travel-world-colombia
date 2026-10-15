import { getAdminSession } from '@/lib/admin/guard'
import { isSuperadmin } from '@/lib/admin/allowlist'
import { SolTabs } from './_components/SolTabs'

/** Sección Sol: pestañas comunes. Cada página sigue validando su propio acceso. */
export default async function SolLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()
  if (!session || session.rol !== 'admin') return children

  return (
    <>
      <SolTabs superadmin={isSuperadmin(session.user.email)} />
      {children}
    </>
  )
}
