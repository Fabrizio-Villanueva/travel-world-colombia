import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CorridaLab } from '@/lib/agente/v2/laboratorio'
import { BotonCargarEscenarios, BotonCorrer, BotonCorrerTodos, BotonNuevoChat } from './Controles'

export const dynamic = 'force-dynamic'
// Un escenario completo son ~8 turnos de Sol + el cliente simulado.
export const maxDuration = 300

interface Escenario { id: string; nombre: string; persona: string; esperado: string | null }

export default async function LaboratorioPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol !== 'admin') redirect('/admin')

  const db = createAdminClient()
  const [esc, cor, val] = await Promise.all([
    db.from('sol_lab_escenarios').select('id, nombre, persona, esperado').eq('activo', true).order('orden'),
    db.from('sol_lab_corridas').select('*').order('creado_en', { ascending: false }).limit(40),
    db.from('sol_lab_valoraciones').select('corrida_id, voto'),
  ])
  const escenarios = (esc.data ?? []) as Escenario[]
  const corridas = (cor.data ?? []) as CorridaLab[]
  const votos = new Map<string, { si: number; no: number }>()
  for (const v of (val.data ?? []) as { corrida_id: string; voto: number }[]) {
    const x = votos.get(v.corrida_id) ?? { si: 0, no: 0 }
    if (v.voto > 0) x.si++
    else x.no++
    votos.set(v.corrida_id, x)
  }
  const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Laboratorio de Sol</h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Aquí se prueba la nueva Sol (v2) sin que salga nada por WhatsApp. Puedes chatear con ella haciendo de cliente
          o correr escenarios donde otra IA actúa el papel del cliente, y ver qué pensó Sol en cada respuesta.
          Califica cada respuesta con 👍 / 👎. Solo administradores.
        </p>
      </div>

      <div className="mb-10 flex flex-wrap gap-3">
        <BotonNuevoChat />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Escenarios ({escenarios.length})
          </h2>
          <div className="flex gap-3">
            <BotonCargarEscenarios />
            {escenarios.length > 0 && <BotonCorrerTodos ids={escenarios.map(e => e.id)} />}
          </div>
        </div>
        {escenarios.length === 0 ? (
          <p className="rounded-md p-6 text-center font-inter text-sm" style={{ ...caja, color: 'var(--text-dim)' }}>
            Aún no hay escenarios. Carga los escenarios base (los 4 casos de la dueña y patrones de las ventas reales).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {escenarios.map(e => (
              <li key={e.id} className="flex flex-wrap items-start gap-3 rounded-lg p-4" style={caja}>
                <div className="min-w-0 flex-1">
                  <p className="font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{e.nombre}</p>
                  <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}><b>Cliente:</b> {e.persona}</p>
                  {e.esperado && <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}><b>Se espera:</b> {e.esperado}</p>}
                </div>
                <BotonCorrer id={e.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>Conversaciones recientes</h2>
        {corridas.length === 0 ? (
          <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>Todavía no hay conversaciones de prueba.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {corridas.map(c => {
              const sol = c.turnos.filter(t => t.rol === 'sol')
              const costo = sol.reduce((s, t) => s + (t.costoUsd ?? 0), 0)
              const ultimo = sol[sol.length - 1]?.decision?.venta?.estado
              const v = votos.get(c.id)
              return (
                <li key={c.id}>
                  <Link href={`/admin/sol/laboratorio/${c.id}`} className="flex flex-wrap items-center gap-3 rounded-lg p-3" style={caja}>
                    <span className="rounded px-2 py-0.5 font-inter text-xs" style={{ background: 'var(--bg-alt)', color: 'var(--text-dim)' }}>
                      {c.tipo === 'chat' ? 'Chat' : 'Escenario'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{c.titulo}</span>
                    <span className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
                      {sol.length} resp. · {ultimo ?? '—'} · US${costo.toFixed(3)}
                      {v ? ` · 👍${v.si} 👎${v.no}` : ''}
                      {c.estado === 'error' ? ' · ⚠️ error' : ''}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
