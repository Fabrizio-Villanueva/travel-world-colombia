import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { obtenerCorrida } from '@/lib/agente/v2/laboratorio'
import { ChatEntrada, TurnoSol } from './Turnos'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export default async function CorridaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol !== 'admin') redirect('/admin')

  const { id } = await params
  const corrida = await obtenerCorrida(id)
  if (!corrida) notFound()

  const { data: vals } = await createAdminClient()
    .from('sol_lab_valoraciones')
    .select('turno, voto, comentario, por')
    .eq('corrida_id', id)
  const misVotos = new Map(
    ((vals ?? []) as { turno: number; voto: number; comentario: string | null; por: string }[])
      .filter(v => v.por === session.user.email)
      .map(v => [v.turno, v])
  )

  type Escenario = { persona: string; esperado: string | null }
  let escenario: Escenario | null = null
  if (corrida.escenario_id) {
    const { data } = await createAdminClient().from('sol_lab_escenarios').select('persona, esperado').eq('id', corrida.escenario_id).maybeSingle()
    escenario = (data as Escenario | null) ?? null
  }

  const costo = corrida.turnos.reduce((s, t) => s + (t.costoUsd ?? 0), 0)

  return (
    <>
      <Link href="/admin/sol/laboratorio" className="font-inter text-xs underline" style={{ color: 'var(--orange)' }}>← Laboratorio</Link>
      <h1 className="mt-2 font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{corrida.titulo}</h1>
      <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        {corrida.tipo === 'chat' ? 'Chat de prueba (tú eres el cliente)' : 'Escenario con cliente simulado'} · Sol v2 ·
        costo aprox. US${costo.toFixed(3)} · nada de esto salió por WhatsApp
      </p>
      {escenario && (
        <div className="mt-4 rounded-lg p-4 font-inter text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          <p><b>Papel del cliente:</b> {escenario.persona}</p>
          {escenario.esperado && <p className="mt-1"><b>Se espera:</b> {escenario.esperado}</p>}
        </div>
      )}
      {corrida.estado === 'error' && (
        <p className="mt-4 rounded-md p-3 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
          Error: {corrida.error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {corrida.turnos.map((t, i) =>
          t.rol === 'cliente' ? (
            <div key={i} className="max-w-[80%] self-start whitespace-pre-wrap rounded-2xl rounded-bl-sm px-4 py-2 font-inter text-sm"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {t.texto}
            </div>
          ) : (
            <TurnoSol key={i} corridaId={corrida.id} indice={i} turno={t} voto={misVotos.get(i) ?? null} />
          )
        )}
        {corrida.turnos.length === 0 && (
          <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>Escribe el primer mensaje como si fueras un cliente.</p>
        )}
      </div>

      {corrida.tipo === 'chat' && <ChatEntrada corridaId={corrida.id} />}
    </>
  )
}
