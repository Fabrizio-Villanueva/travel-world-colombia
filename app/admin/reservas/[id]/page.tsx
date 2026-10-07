import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/guard'
import { cargarReserva } from '../actions'
import { cargarEstadoDocumentos } from './documentos-actions'
import { Wizard } from './Wizard'
import { ContratoPanel } from './ContratoPanel'
import { estadoContrato } from './contrato-actions'

export const metadata: Metadata = { title: 'Generador de Contratos · Panel' }
export const dynamic = 'force-dynamic'

export default async function ReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol === 'lector') redirect('/admin')

  const { id } = await params
  const [reserva, documentos, contrato] = await Promise.all([
    cargarReserva(id),
    cargarEstadoDocumentos(id),
    estadoContrato(id),
  ])

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/reservas"
          className="inline-flex items-center gap-1.5 font-inter text-sm"
          style={{ color: 'var(--orange)' }}
        >
          <ArrowLeft size={15} /> Buscar otro cliente
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="font-playfair text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {reserva.cliente.nombre}
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          {reserva.oportunidad.nombre} · {reserva.oportunidad.pipeline} · {reserva.oportunidad.etapa}
          {reserva.cliente.telefono ? ` · ${reserva.cliente.telefono}` : ''}
        </p>
      </header>

      {reserva.sinResolver.length > 0 && (
        <p className="mb-4 rounded-md px-4 py-3 font-inter text-xs" style={{ background: '#fffbeb', color: '#92400e' }}>
          Ojo: {reserva.sinResolver.length} campos del catálogo no existen en GHL:{' '}
          {reserva.sinResolver.join(', ')}
        </p>
      )}

      <ContratoPanel opportunityId={reserva.oportunidad.id} inicial={contrato} />

      <Wizard
        opportunityId={reserva.oportunidad.id}
        campos={reserva.campos}
        valoresIniciales={reserva.valores}
        prefill={reserva.prefill}
        documentos={documentos}
      />
    </div>
  )
}
