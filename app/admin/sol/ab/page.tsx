import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { GHL } from '@/lib/agente/config'
import type { Decision } from '@/lib/agente/claude'
import { ControlAB } from './ControlAB'

export const dynamic = 'force-dynamic'

interface Turno {
  contact_id: string
  conversation_id: string | null
  version: 'v1' | 'v2'
  origen: string
  mensaje: string | null
  tarjetas: { titulo: string; boton: string }[] | null
  decision: Decision
  costo_usd: number | null
  en: string
}
interface Asignacion { contact_id: string; grupo: 'v1' | 'v2'; conversation_id: string | null; en: string }

const ESTADO: Record<string, string> = {
  explorando: '🔎 Explorando', falta_informacion: '🧩 Falta información', objecion: '🤔 Objeción',
  consultando_decisor: '👥 Consultando', listo_para_reservar: '🔥 Listo para reservar', nutrir: '🌱 Nutrir', no_interesado: '✋ No interesado',
}

/** Seguimiento de la prueba A/B de Sol v2. SOLO admin. */
export default async function ABPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol !== 'admin') redirect('/admin')

  const db = createAdminClient()
  const [cfg, asig, tur] = await Promise.all([
    db.from('sol_ab_config').select('porcentaje, activa, actualizado_en, actualizado_por').eq('id', 1).maybeSingle(),
    db.from('sol_ab_asignaciones').select('*').order('en', { ascending: false }).limit(1000),
    db.from('sol_ab_turnos').select('*').order('en', { ascending: true }).limit(3000),
  ])
  const asignaciones = (asig.data ?? []) as Asignacion[]
  const turnos = (tur.data ?? []) as Turno[]
  const grupoDe = new Map(asignaciones.map(a => [a.contact_id, a.grupo]))

  // Métricas por grupo, solo sobre leads asignados en la prueba.
  const porContacto = new Map<string, Turno[]>()
  for (const t of turnos) {
    if (!grupoDe.has(t.contact_id)) continue
    const l = porContacto.get(t.contact_id) ?? []
    l.push(t)
    porContacto.set(t.contact_id, l)
  }
  const metricas = (['v1', 'v2'] as const).map(g => {
    const ids = asignaciones.filter(a => a.grupo === g).map(a => a.contact_id)
    let pasados = 0, escalados = 0, respondieron = 0, costo = 0, turnosSol = 0
    for (const id of ids) {
      const ts = porContacto.get(id) ?? []
      if (ts.length > 1) respondieron++
      const d = ts.map(t => t.decision)
      const pasado = g === 'v2'
        ? d.some(x => x.venta?.estado === 'listo_para_reservar')
        : d.some(x => Boolean(x.datos?.destino && x.datos?.fechas && ((x.datos?.adultos ?? 0) + (x.datos?.ninos ?? 0)) > 0))
      if (pasado) pasados++
      if (d.some(x => x.accion === 'escalar')) escalados++
      for (const t of ts) { costo += Number(t.costo_usd ?? 0); turnosSol++ }
    }
    return { g, leads: ids.length, respondieron, pasados, escalados, costo, turnosSol }
  })

  const conversacionesV2 = asignaciones.filter(a => a.grupo === 'v2').slice(0, 60)
  const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const
  const urlGhl = (conv: string | null) => conv ? `https://app.gohighlevel.com/v2/location/${GHL.locationId}/conversations/conversations/${conv}` : null

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Sol: prueba A/B</h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Cada lead nuevo se asigna al azar a la Sol actual (v1) o a la nueva (v2) y se queda ahí. Cada mensaje lo
          responde una sola Sol: el costo es el mismo. Aquí controlas el porcentaje, apagas v2 al instante y revisas sus
          conversaciones con lo que pensó en cada respuesta. Solo administradores.
        </p>
      </div>

      {cfg.data && <ControlAB porcentaje={Number(cfg.data.porcentaje)} activa={Boolean(cfg.data.activa)} />}

      <section className="my-8 grid gap-3 md:grid-cols-2">
        {metricas.map(m => (
          <div key={m.g} className="rounded-xl p-5" style={caja}>
            <p className="font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {m.g === 'v1' ? 'Sol actual (v1)' : 'Sol nueva (v2)'}
            </p>
            <ul className="mt-2 flex flex-col gap-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
              <li>Leads asignados: <b>{m.leads}</b></li>
              <li>Siguieron conversando (más de 1 turno): <b>{m.respondieron}</b></li>
              <li>{m.g === 'v1' ? 'Pasados a la asesora (datos completos)' : 'Listos para reservar (pasados a la asesora)'}: <b>{m.pasados}</b>{m.leads ? ` (${Math.round((100 * m.pasados) / m.leads)} %)` : ''}</li>
              <li>Escalados: <b>{m.escalados}</b></li>
              {m.g === 'v2' && <li>Costo del modelo: <b>US${m.costo.toFixed(2)}</b>{m.turnosSol ? ` · US$${(m.costo / m.turnosSol).toFixed(3)} por turno` : ''}</li>}
            </ul>
          </div>
        ))}
        <p className="font-inter text-xs md:col-span-2" style={{ color: 'var(--text-muted)' }}>
          Las ventas reales de cada grupo (lo que importa) se miden contra Reservaciones a los 30 días. v1 &quot;pasa&quot; con
          datos completos; v2 solo con intención de compra: que v2 pase menos es lo esperado, lo que debe subir es la tasa de
          cierre de lo que pasa.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Conversaciones de Sol v2 ({asignaciones.filter(a => a.grupo === 'v2').length})
        </h2>
        {conversacionesV2.length === 0 ? (
          <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Todavía no le ha tocado ningún lead a Sol v2. Aparecerán aquí solos con el primer lead nuevo asignado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversacionesV2.map(a => {
              const ts = porContacto.get(a.contact_id) ?? []
              const ultimo = ts[ts.length - 1]?.decision
              const link = urlGhl(a.conversation_id)
              return (
                <li key={a.contact_id}>
                  <details className="rounded-lg p-3" style={caja}>
                    <summary className="cursor-pointer font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                      {new Date(a.en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {ultimo?.datos?.nombre ?? 'sin nombre'} ·{' '}
                      {ultimo?.datos?.destino ?? 'sin destino'} · {ultimo?.venta ? ESTADO[ultimo.venta.estado] ?? ultimo.venta.estado : '—'} · {ts.length} turnos
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                      {link && <a href={link} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--orange)' }}>Abrir la conversación completa en GHL ↗</a>}
                      {ts.map((t, i) => (
                        <div key={i} className="rounded-md p-2" style={{ background: 'var(--bg-alt)' }}>
                          <p style={{ color: 'var(--text-muted)' }}>
                            {new Date(t.en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {t.origen} · {t.decision.accion}
                            {t.decision.venta ? ` · ${ESTADO[t.decision.venta.estado] ?? t.decision.venta.estado}` : ''}
                          </p>
                          {t.mensaje && <p className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{t.mensaje}</p>}
                          {t.tarjetas?.length ? <p className="mt-1">Tarjetas: {t.tarjetas.map(x => `${x.titulo} → ${x.boton}`).join(' · ')}</p> : null}
                          <p className="mt-1"><b>Motivo:</b> {t.decision.motivo}</p>
                          {t.decision.venta?.senal_compra && <p><b>Señal de compra:</b> {t.decision.venta.senal_compra}</p>}
                          {t.decision.venta && <p><b>Compromiso:</b> {t.decision.venta.compromiso} · <b>Objeción:</b> {t.decision.venta.objecion}</p>}
                          {t.decision.resumen && <p><b>Resumen:</b> {t.decision.resumen}</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <p className="mt-6 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        ¿Algo no te gustó? Reprodúcelo en el <Link href="/admin/sol/laboratorio" className="underline" style={{ color: 'var(--orange)' }}>Laboratorio</Link> y ajustamos.
      </p>
    </>
  )
}
