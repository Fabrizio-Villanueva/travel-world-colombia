import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { listarContratos, type FiltroListado } from '@/lib/contratos/listado'
import { embudoContratos, embudoDocumentos, type Embudo } from '@/lib/admin/embudos'
import { EmbudoCard } from '../_components/EmbudoCard'
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
  const email = session.user.email ?? ''
  const vacio: Embudo = { etapas: [], aparte: [] }
  const [contratos, embContratos, embDocumentos] = await Promise.all([
    listarContratos({ email, verTodos, filtro }).catch(e => (console.error('[reservas] contratos enviados:', e), null)),
    embudoContratos(email, verTodos).catch(e => (console.error('[reservas] embudo contratos:', e), vacio)),
    embudoDocumentos(email, verTodos).catch(e => (console.error('[reservas] embudo documentos:', e), vacio)),
  ])

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

      {/* Embudos (15-oct-2026): cómo van los contratos y los documentos. */}
      <section className="mt-8">
        <p className="mb-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
          {verTodos ? 'Todo el equipo' : 'Lo que enviaste tú'} · cada reserva cuenta una vez (su último envío) · el porcentaje es sobre lo enviado.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <EmbudoCard titulo="Contratos" href="#contratos-enviados" embudo={embContratos} />
          <EmbudoCard
            titulo="Recolección de documentos"
            // La página de documentos no está abierta al rol representante.
            href={session.rol === 'representante' ? undefined : '/admin/documentos'}
            embudo={embDocumentos}
          />
        </div>
      </section>

      {contratos ? (
        <ContratosEnviados contratos={contratos} filtro={filtro} verTodos={verTodos} />
      ) : (
        <p className="mt-10 font-inter text-sm" style={{ color: '#dc2626' }}>No se pudo cargar la lista de contratos enviados.</p>
      )}
    </div>
  )
}
