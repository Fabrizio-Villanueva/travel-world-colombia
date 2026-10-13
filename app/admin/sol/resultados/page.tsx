import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { isSuperadmin } from '@/lib/admin/allowlist'
import { GHL } from '@/lib/agente/config'
import { cargarResultados, resumir, type FilaLead } from '@/lib/agente/resultados'

export const dynamic = 'force-dynamic'
/** 3 búsquedas paginadas en GHL por carga. */
export const maxDuration = 60

const PERIODOS = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', 'todo': 'Desde el 6-oct' } as const
const VERSIONES = { todas: 'Todas', v1: 'Sol 1', v2: 'Sol 2' } as const
const VISTAS = {
  pasados: 'Leads que pasó',
  malos: 'Pasó y no valían',
  retenidos: 'Buenos que se quedó',
  sin_respuesta: 'Sin respuesta del equipo',
  ventas: 'Ventas',
  todos: 'Todos',
} as const
type Periodo = keyof typeof PERIODOS
type VersionFiltro = keyof typeof VERSIONES
type Vista = keyof typeof VISTAS

const COLOR = { bueno: '#1f8a5b', medio: '#c98a12', malo: '#c2412d', gris: 'rgba(13,30,60,0.28)' }
const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const dia = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })

function duracion(min: number): string {
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.round(min / 6) / 10} h`.replace('.', ',')
  return `${Math.round(min / 1440)} días`
}

function filtrarVista(filas: FilaLead[], vista: Vista): FilaLead[] {
  const venta = (f: FilaLead) => !f.evaluacion || f.evaluacion.tipo === 'venta_nueva'
  switch (vista) {
    case 'pasados': return filas.filter(f => f.pasado && venta(f))
    case 'malos': return filas.filter(f => f.pasado && f.evaluacion?.merece === 'no')
    case 'retenidos': return filas.filter(f => !f.pasado && !f.escalado && f.evaluacion?.merece === 'si')
    case 'sin_respuesta': return filas.filter(f => f.pasado && venta(f) && (f.respuesta.estado === 'sin_respuesta' || f.respuesta.estado === 'esperando'))
    case 'ventas': return filas.filter(f => f.venta && venta(f))
    default: return filas
  }
}

/** Resultados de Sol: del primer mensaje a la venta, con la evidencia detrás de cada número. SOLO superadmin. */
export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ p?: string; v?: string; ver?: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  // Solo el superadmin (ADMIN_EMAILS): por ahora no lo ven los demás admins.
  if (!isSuperadmin(session.user.email)) redirect('/admin')

  const q = await searchParams
  const periodo: Periodo = q.p && q.p in PERIODOS ? (q.p as Periodo) : '30'
  const ver: VersionFiltro = q.v && q.v in VERSIONES ? (q.v as VersionFiltro) : 'todas'
  const vista: Vista = q.ver && q.ver in VISTAS ? (q.ver as Vista) : 'pasados'

  const { filas: todas, avisoGhl } = await cargarResultados(periodo === 'todo' ? null : Number(periodo))
  const filas = ver === 'todas' ? todas : todas.filter(f => f.version === ver)
  const r = resumir(filas)
  const lista = filtrarVista(filas, vista)

  const enlace = (cambio: Partial<{ p: string; v: string; ver: string }>) => {
    const s = new URLSearchParams({ p: periodo, v: ver, ver: vista, ...cambio })
    return `/admin/sol/resultados?${s}`
  }
  const urlGhl = (conv: string | null) => conv ? `https://app.gohighlevel.com/v2/location/${GHL.locationId}/conversations/conversations/${conv}` : null
  const pct = (n: number, de: number) => (de ? `${Math.round((100 * n) / de)} %` : '—')

  const embudo = [
    { t: 'Conversaciones', n: r.atendidos, sub: `${r.ventaNueva} de venta · ${r.existentes} clientes · ${r.noClientes} no clientes`, ver: 'todos' as Vista },
    { t: 'Pasados al equipo', n: r.pasados, sub: `${pct(r.pasados, r.ventaNueva)} de los leads de venta`, ver: 'pasados' as Vista },
    { t: 'Respondidos por una asesora', n: r.aTiempo + r.tarde, sub: r.medianaMin != null ? `tardan ${duracion(r.medianaMin)} (mediana)` : 'sin datos aún', ver: 'sin_respuesta' as Vista },
    { t: 'Con cotización', n: r.cotizados, sub: 'en Cotización Enviada, Seguimiento o ya vendidos', ver: 'todos' as Vista },
    { t: 'Ventas', n: r.ventas, sub: r.valorVentas ? pesos.format(r.valorVentas) : 'sin valor registrado', ver: 'ventas' as Vista },
  ]

  return (
    <>
      <div className="mb-6">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Resultados de Sol</h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Qué pasó con cada lead que atendió Sol: si lo pasó al equipo, si valía la pena, si una asesora respondió y si
          terminó en venta. Toca cualquier número para ver los leads detrás.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 font-inter text-sm">
        <Chips opciones={PERIODOS} actual={periodo} href={k => enlace({ p: k })} />
        <Chips opciones={VERSIONES} actual={ver} href={k => enlace({ v: k })} />
      </div>

      {avisoGhl && (
        <p className="mb-4 rounded-lg p-3 font-inter text-sm" style={{ ...caja, color: COLOR.malo }}>{avisoGhl}</p>
      )}

      <section aria-label="Embudo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {embudo.map((e, i) => (
          <Link key={e.t} href={enlace({ ver: e.ver })} className="rounded-xl p-4 transition-colors hover:bg-[var(--card-hover)]" style={caja}>
            <p className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}. {e.t}</p>
            <p className="mt-1 font-plus-jakarta text-3xl font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{e.n}</p>
            <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>{e.sub}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl p-5" style={caja}>
          <h2 className="font-plus-jakarta text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>¿Los leads que pasó valían la pena?</h2>
          <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            Lo decide un evaluador automático que lee cada conversación con criterio de jefe comercial.
          </p>
          <Barra partes={[
            { n: r.pasadosBuenos, color: COLOR.bueno, t: 'Valían' },
            { n: r.pasadosDudosos, color: COLOR.medio, t: 'Dudosos' },
            { n: r.pasadosMalos, color: COLOR.malo, t: 'No valían' },
            { n: r.pasadosSinEvaluar, color: COLOR.gris, t: 'Sin evaluar aún' },
          ]} />
          <p className="mt-3 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            <Link href={enlace({ ver: 'malos' })} className="underline" style={{ color: 'var(--orange)' }}>Ver los {r.pasadosMalos} que no valían</Link>
            {' · '}
            <Link href={enlace({ ver: 'retenidos' })} className="underline" style={{ color: 'var(--orange)' }}>{r.buenosRetenidos} leads buenos que Sol no pasó</Link>
          </p>
        </div>

        <div className="rounded-xl p-5" style={caja}>
          <h2 className="font-plus-jakarta text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>¿El equipo respondió a tiempo?</h2>
          <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            Meta: primer mensaje de una asesora en menos de 1 hora desde que Sol pasa el lead.
          </p>
          <Barra partes={[
            { n: r.aTiempo, color: COLOR.bueno, t: 'En menos de 1 h' },
            { n: r.tarde, color: COLOR.medio, t: 'Más de 1 h' },
            { n: r.sinRespuesta, color: COLOR.malo, t: 'Nunca respondieron' },
            { n: r.esperando, color: COLOR.gris, t: 'Esperando ahora' },
          ]} />
          {r.sinDatoRespuesta > 0 && (
            <p className="mt-3 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
              {r.sinDatoRespuesta} leads sin dato de respuesta (pasados antes del 9-oct, cuando empezó a medirse).
            </p>
          )}
        </div>
      </section>

      <p className="mt-4 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
        Calidad de la atención de Sol:{' '}
        <b style={{ color: 'var(--text-primary)' }}>{r.notaSol != null ? `${r.notaSol.toFixed(1).replace('.', ',')} de 5` : '—'}</b>
        {' '}· {r.evaluados} de {r.atendidos} conversaciones evaluadas
      </p>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {VISTAS[vista]} ({lista.length})
          </h2>
          <Chips opciones={VISTAS} actual={vista} href={k => enlace({ ver: k })} />
        </div>
        {lista.length === 0 ? (
          <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>No hay leads en esta vista para el período elegido.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.slice(0, 200).map(f => <Lead key={f.contactId} f={f} url={urlGhl(f.conversationId)} />)}
          </ul>
        )}
      </section>

      <p className="mt-6 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Ventas = leads atendidos por Sol que hoy tienen una reserva en Reservaciones (no canceladas). Las cierra el equipo; aquí se
        ve cuántas empezaron con Sol. El evaluador revisa cada conversación 6 horas después del último mensaje de Sol.
      </p>
    </>
  )
}

function Chips<K extends string>({ opciones, actual, href }: { opciones: Record<K, string>; actual: K; href: (k: K) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(opciones) as K[]).map(k => (
        <Link
          key={k}
          href={href(k)}
          aria-current={k === actual ? 'page' : undefined}
          className="rounded-full px-3 py-1 font-inter text-xs"
          style={k === actual
            ? { background: 'var(--orange)', color: 'var(--orange-contrast)' }
            : { border: '1px solid var(--border)', color: 'var(--text-dim)' }}
        >
          {opciones[k]}
        </Link>
      ))}
    </div>
  )
}

function Barra({ partes }: { partes: { n: number; color: string; t: string }[] }) {
  const total = partes.reduce((a, p) => a + p.n, 0)
  return (
    <div className="mt-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-alt)' }}>
        {total > 0 && partes.filter(p => p.n > 0).map(p => (
          <div key={p.t} style={{ width: `${(100 * p.n) / total}%`, background: p.color }} title={`${p.t}: ${p.n}`} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-inter text-sm">
        {partes.map(p => (
          <li key={p.t} className="flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            {p.t}: <b className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.n}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

const MERECE = { si: ['Valía', COLOR.bueno], dudoso: ['Dudoso', COLOR.medio], no: ['No valía', COLOR.malo], no_aplica: ['—', COLOR.gris] } as const
const TIPO = { venta_nueva: 'Lead de venta', cliente_existente: 'Cliente con reserva', no_cliente: 'No es cliente' } as const
const RESPUESTA = {
  a_tiempo: 'Asesora respondió en',
  tarde: 'Asesora respondió en',
  sin_respuesta: 'Ninguna asesora respondió',
  esperando: 'Esperando respuesta de una asesora',
  sin_dato: '',
} as const

function Lead({ f, url }: { f: FilaLead; url: string | null }) {
  const e = f.evaluacion
  const [etiqueta, color] = e ? MERECE[e.merece] : ['Sin evaluar', COLOR.gris]
  const resp = f.pasado || f.escalado ? RESPUESTA[f.respuesta.estado] : ''
  return (
    <li className="rounded-lg p-3 font-inter text-sm" style={caja}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{dia.format(new Date(f.primerTurno))}</span>
        <b style={{ color: 'var(--text-primary)' }}>{f.nombre}</b>
        <span className="rounded-full px-2 py-0.5 text-xs" style={{ border: `1px solid ${color}`, color }}>{etiqueta}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {f.version === 'v2' ? 'Sol 2' : 'Sol 1'} · {f.pasado ? 'pasado al equipo' : f.escalado ? 'escalado' : 'no pasado'}
          {e && e.tipo !== 'venta_nueva' ? ` · ${TIPO[e.tipo]}` : ''}
        </span>
        {f.venta && <b className="text-xs" style={{ color: COLOR.bueno }}>Venta {f.venta.valor ? pesos.format(f.venta.valor) : ''}</b>}
        {!f.venta && f.cotizado && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Cotizado</span>}
      </div>
      {e?.motivo && <p className="mt-1" style={{ color: 'var(--text-dim)' }}>{e.motivo}</p>}
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        {resp && <>{resp}{f.respuesta.minutos != null ? ` ${duracion(f.respuesta.minutos)}` : ''} · </>}
        {e?.notaSol != null && <>Atención de Sol {e.notaSol}/5{e.errorSol ? ` (${e.errorSol})` : ''} · </>}
        {url && <a href={url} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--orange)' }}>Ver conversación ↗</a>}
      </p>
    </li>
  )
}
