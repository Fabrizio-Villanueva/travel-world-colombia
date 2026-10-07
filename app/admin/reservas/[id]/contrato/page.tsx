import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/guard'
import { contratoDesdeGhl } from '@/lib/contratos/desde-ghl'
import { ContratoDocumento } from '@/components/contrato/ContratoDocumento'

export const metadata: Metadata = { title: 'Vista previa del contrato · Panel' }
export const dynamic = 'force-dynamic'

/**
 * Vista previa del contrato con los datos REALES de la oportunidad, tal como
 * lo verá el cliente. Solo lectura: lo que esté mal se corrige en el
 * Generador y se recarga esta página.
 */
export default async function VistaContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol === 'lector') redirect('/admin')

  const { id } = await params
  const datos = await contratoDesdeGhl(id)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/reservas/${id}`}
          className="inline-flex items-center gap-1.5 font-inter text-sm"
          style={{ color: 'var(--orange)' }}
        >
          <ArrowLeft size={15} /> Volver al Generador
        </Link>
        <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
          Vista previa · así lo verá el cliente
        </p>
      </div>
      <div className="relative overflow-hidden rounded-xl shadow-xl" style={{ zIndex: 1 }}>
        <ContratoDocumento datos={datos} />
      </div>
    </div>
  )
}
