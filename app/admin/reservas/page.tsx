import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { listarContratos, type FiltroListado } from '@/lib/contratos/listado'
import { Buscador } from './Buscador'
import { ContratosEnviados } from './ContratosEnviados'

export const metadata: Metadata = { title: 'Generador de Contratos · Panel' }
export const dynamic = 'force-dynamic'

export default async function ReservasPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol === 'lector') redirect('/admin')

  // Contratos enviados: los admins ven los de todo el equipo; asesores y
  // representantes, solo los que ellos emitieron (pedido del 15-oct-2026).
  const { f } = await searchParams
  const filtro: FiltroListado = f === 'pendientes' || f === 'firmados' ? f : 'todos'
  const verTodos = session.rol === 'admin'
  const contratos = await listarContratos({ email: session.user.email ?? '', verTodos, filtro }).catch(e => {
    console.error('[reservas] contratos enviados:', e)
    return null
  })

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-playfair text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Generador de Contratos
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Busca al cliente, elige su oportunidad y llena los datos del contrato paso a paso.
          Todo se guarda directo en GHL.
        </p>
      </header>

      <Buscador />

      {contratos ? (
        <ContratosEnviados contratos={contratos} filtro={filtro} verTodos={verTodos} />
      ) : (
        <p className="mt-10 font-inter text-sm" style={{ color: '#dc2626' }}>No se pudo cargar la lista de contratos enviados.</p>
      )}
    </div>
  )
}
