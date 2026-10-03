import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/guard'
import { listarReglasVisa } from '@/lib/documentos/visas'
import { ReglasVisa } from './ReglasVisa'

export const metadata: Metadata = { title: 'Reglas de visa · Panel' }
export const dynamic = 'force-dynamic'

export default async function ReglasVisaPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol === 'representante') redirect('/admin/reservas')

  const reglas = await listarReglasVisa()
  const editable = session.rol === 'admin' || session.rol === 'editor'

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/documentos" className="inline-flex items-center gap-1.5 font-inter text-sm" style={{ color: 'var(--orange)' }}>
          <ArrowLeft size={15} /> Documentos de viajeros
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Reglas de visa por país
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          ¿Un colombiano con pasaporte ordinario necesita visa para entrar? Con esto el Generador de Contratos
          sugiere qué documentos pedir según el destino (la asesora siempre confirma). Lo que no esté aquí no
          se sugiere. <strong>Colombia</strong> marca los viajes nacionales (solo cédula).
        </p>
      </div>
      <ReglasVisa reglas={reglas} editable={editable} />
    </>
  )
}
