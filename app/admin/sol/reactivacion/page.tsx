import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { GHL, REACTIVACION } from '@/lib/agente/config'

export const dynamic = 'force-dynamic'

interface Fila {
  id: string
  contact_id: string
  conversation_id: string | null
  segmento: 'rescate' | 'silencioso'
  capa: number
  variante: 'ia' | 'plantilla'
  decision: 'enviado' | 'callar' | 'error_validacion' | 'error_envio' | 'dry_run'
  motivo: string | null
  mensaje: string | null
  fichas: { slug: string; motivo: string }[] | null
  costo_usd: number | null
  creado_en: string
  enviado_en: string | null
  respondio_en: string | null
  baja_en: string | null
}

const DECISION: Record<Fila['decision'], string> = {
  enviado: '✅ Enviado',
  callar: '🤫 Calló',
  error_validacion: '⛔ No pasó la validación',
  error_envio: '⚠️ Falló el envío',
  dry_run: '🧪 Prueba (no se envió)',
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : '—')

/** Reactivación de leads por WhatsApp: prueba A/B IA vs. plantilla. SOLO admin. */
export default async function ReactivacionPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol !== 'admin') redirect('/admin')

  const { data, error } = await createAdminClient()
    .from('agente_reactivacion')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(2000)
  const filas = (data ?? []) as Fila[]
  const reales = filas.filter(f => f.decision !== 'dry_run')

  // "Asignados" = todo lo que la corrida le tocó a cada variante (incluye los
  // que la IA decidió callar): es la comparación justa, porque la plantilla
  // nunca calla. La tasa sobre enviados se muestra también, como referencia.
  const metricas = (['ia', 'plantilla'] as const).map(v => {
    const deV = reales.filter(f => f.variante === v)
    const enviados = deV.filter(f => f.decision === 'enviado')
    const respondieron = enviados.filter(f => f.respondio_en).length
    return {
      v,
      asignados: deV.length,
      enviados: enviados.length,
      respondieron,
      bajas: enviados.filter(f => f.baja_en).length,
      callar: deV.filter(f => f.decision === 'callar').length,
      errores: deV.filter(f => f.decision === 'error_validacion' || f.decision === 'error_envio').length,
      costo: deV.reduce((s, f) => s + Number(f.costo_usd ?? 0), 0),
    }
  })
  const ultimos = filas.slice(0, 30)

  const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const
  const urlGhl = (conv: string | null) =>
    conv ? `https://app.gohighlevel.com/v2/location/${GHL.locationId}/conversations/conversations/${conv}` : null

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Sol: reactivación A/B</h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Una vez al día (L-S, 10 a. m.) se escribe por WhatsApp a leads que se enfriaron sin calificar: los que hablaron con Sol
          y dejaron de responder (rescate) y los que nunca contestaron (silencioso). La mitad recibe un mensaje redactado por Sol
          con todo el contexto (IA) y la otra mitad un texto fijo (plantilla), siempre con dos fichas del catálogo. Lote:{' '}
          {REACTIVACION.loteDiario} por día. Estado:{' '}
          <b style={{ color: REACTIVACION.activo ? 'var(--text-primary)' : '#dc2626' }}>{REACTIVACION.activo ? 'encendida' : 'apagada (solo pruebas)'}</b>.
          Solo administradores.
        </p>
      </div>

      {error && (
        <p className="mb-6 rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
          Error cargando la reactivación: {error.message}
        </p>
      )}

      <section className="mb-8 grid gap-3 md:grid-cols-2">
        {metricas.map(m => (
          <div key={m.v} className="rounded-xl p-5" style={caja}>
            <p className="font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {m.v === 'ia' ? 'Sol redacta (IA)' : 'Texto fijo (plantilla)'}
            </p>
            <ul className="mt-2 flex flex-col gap-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
              <li>Asignados: <b>{m.asignados}</b></li>
              <li>Enviados: <b>{m.enviados}</b></li>
              <li>
                Respondieron: <b>{m.respondieron}</b> · <b>{pct(m.respondieron, m.enviados)}</b> de los enviados ·{' '}
                {pct(m.respondieron, m.asignados)} de los asignados
              </li>
              <li>Pidieron no recibir más (SALIR): <b>{m.bajas}</b></li>
              <li>Calló (decidió no escribir): <b>{m.callar}</b></li>
              <li>Errores (validación o envío): <b>{m.errores}</b></li>
              {m.v === 'ia' && <li>Costo del modelo: <b>US${m.costo.toFixed(2)}</b></li>}
            </ul>
          </div>
        ))}
        <p className="font-inter text-xs md:col-span-2" style={{ color: 'var(--text-muted)' }}>
          &quot;Respondió&quot; = el cliente escribió algo dentro de los 30 días siguientes al envío (incluye SALIR). La comparación
          justa es sobre los asignados: la plantilla nunca calla y la IA sí. Las pruebas (dry-run) no cuentan.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>Últimos {ultimos.length}</h2>
        {ultimos.length === 0 ? (
          <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Todavía no hay reactivaciones. Aparecerán aquí con la primera corrida (o con un dry-run).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ultimos.map(f => {
              const link = urlGhl(f.conversation_id)
              return (
                <li key={f.id}>
                  <details className="rounded-lg p-3" style={caja}>
                    <summary className="cursor-pointer font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                      {new Date(f.creado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {f.variante === 'ia' ? 'IA' : 'Plantilla'} ·{' '}
                      {f.segmento} · capa {f.capa} · {DECISION[f.decision] ?? f.decision}
                      {f.respondio_en ? ' · 💬 respondió' : ''}
                      {f.baja_en ? ' · 🚫 SALIR' : ''}
                    </summary>
                    <div className="mt-3 flex flex-col gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--orange)' }}>
                          Abrir la conversación en GHL ↗
                        </a>
                      )}
                      {f.mensaje && (
                        <p className="whitespace-pre-wrap rounded-md p-2" style={{ background: 'var(--bg-alt)', color: 'var(--text-primary)' }}>
                          {f.mensaje}
                        </p>
                      )}
                      {f.fichas?.length ? <p><b>Fichas:</b> {f.fichas.map(x => `${x.slug} (${x.motivo})`).join(' · ')}</p> : null}
                      {f.motivo && <p><b>Motivo:</b> {f.motivo}</p>}
                      {f.respondio_en && <p><b>Respondió:</b> {new Date(f.respondio_en).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
