import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { agrupar, cargarConversion, type FilaGrupo, type LeadConv, type OrigenVenta } from '@/lib/agente/conversion'

export const dynamic = 'force-dynamic'
/** ~25 páginas de búsqueda en GHL por carga. */
export const maxDuration = 60

const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const nombreMes = (m: string) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`))
const pct = (n: number, de: number) => (de ? `${((100 * n) / de).toFixed(1).replace('.', ',')} %` : '—')

const ORIGEN: Record<OrigenVenta, string> = {
  mudada: 'Tarjeta del lead mudada',
  tarjeta_nueva: 'Tarjeta nueva (el cliente sí tenía lead)',
  sin_lead: 'Sin lead (oficina, referido, cliente que volvió)',
  duplicado: 'Duplicado de una venta ya mudada',
}

/** Quien atendió el lead: la asignada en la tarjeta del lead o, si no tenía, la de la venta. */
const asesoraDe = (l: LeadConv) => (l.asesora === 'Sin asignar' && l.venta ? l.venta.asesora : l.asesora)

/** Conversión real de leads a ventas, juntando los pipelines Leads y Reservaciones. Solo admin. */
export default async function ConversionPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol !== 'admin') redirect('/admin')

  let datos: Awaited<ReturnType<typeof cargarConversion>>
  try {
    datos = await cargarConversion()
  } catch (err) {
    return (
      <>
        <Titulo />
        <p className="rounded-lg p-3 font-inter text-sm" style={{ ...caja, color: '#c2412d' }}>
          No se pudieron leer las oportunidades de GHL ({(err as Error).message}). Intenta recargar en un momento.
        </p>
      </>
    )
  }
  const { leads, ventas, meses } = datos
  const q = await searchParams
  const mes = q.m && meses.includes(q.m) ? q.m : meses[0]

  const leadsMes = leads.filter(l => l.mes === mes)
  const vendidosMes = leadsMes.filter(l => l.venta)
  const ventasMes = ventas.filter(v => v.mes === mes && v.origen !== 'duplicado')
  const porOrigen = (o: OrigenVenta) => ventas.filter(v => v.mes === mes && v.origen === o)
  const nuevas = porOrigen('tarjeta_nueva')
  const duplicados = porOrigen('duplicado')

  const porMes = meses.map(m => {
    const l = leads.filter(x => x.mes === m)
    const v = ventas.filter(x => x.mes === m && x.origen !== 'duplicado')
    return {
      mes: m,
      leads: l.length,
      vendidos: l.filter(x => x.venta).length,
      ventas: v.length,
      valor: v.reduce((t, x) => t + x.valor, 0),
      sinLead: v.filter(x => x.origen === 'sin_lead').length,
    }
  })

  return (
    <>
      <Titulo />

      <div className="mb-6 flex flex-wrap gap-1 font-inter text-sm">
        {meses.map(m => (
          <Link
            key={m}
            href={`/admin/conversion?m=${m}`}
            aria-current={m === mes ? 'page' : undefined}
            className="rounded-full px-3 py-1 font-inter text-xs capitalize"
            style={m === mes
              ? { background: 'var(--orange)', color: 'var(--orange-contrast)' }
              : { border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            {nombreMes(m)}
          </Link>
        ))}
      </div>

      <section aria-label="Resumen del mes" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta t="Leads nuevos" n={String(leadsMes.length)} sub="tarjetas que nacieron en 🎯 Leads" />
        <Tarjeta t="Leads vendidos" n={String(vendidosMes.length)} sub="de esos mismos leads, hasta hoy" />
        <Tarjeta t="Conversión real" n={pct(vendidosMes.length, leadsMes.length)} sub="leads vendidos ÷ leads nuevos" destacada />
        <Tarjeta
          t="Ventas cerradas en el mes"
          n={String(ventasMes.length)}
          sub={ventasMes.some(v => v.valor) ? pesos.format(ventasMes.reduce((t, v) => t + v.valor, 0)) : 'sin valor registrado'}
        />
      </section>
      <p className="mt-2 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        La conversión de un mes sigue subiendo mientras sus leads se cierran: el mes en curso siempre se ve más bajo.
        &ldquo;Ventas cerradas&rdquo; cuenta todas las ventas del mes, vengan o no de un lead de ese mes.
      </p>

      <section className="mt-6 rounded-xl p-5" style={caja}>
        <h2 className="font-plus-jakarta text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>
          ¿De dónde salieron las ventas de {nombreMes(mes)}?
        </h2>
        <ul className="mt-3 space-y-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          {(Object.keys(ORIGEN) as OrigenVenta[]).map(o => (
            <li key={o} className="flex justify-between gap-4">
              <span>{ORIGEN[o]}</span>
              <b className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{porOrigen(o).length}</b>
            </li>
          ))}
        </ul>
        {nuevas.length + duplicados.length > 0 && (
          <div className="mt-4 rounded-lg p-3 font-inter text-sm" style={{ background: 'var(--bg-alt)', color: 'var(--text-dim)' }}>
            <p>
              <b style={{ color: 'var(--text-primary)' }}>Para que GHL también lo vea bien:</b> la venta se cierra
              arrastrando la tarjeta del lead a ✅ Ganada (el sistema la muda sola). Estas se crearon en una tarjeta nueva:
            </p>
            <ul className="mt-2 list-disc pl-5">
              {[...nuevas, ...duplicados].map(v => (
                <li key={v.id}>
                  {v.nombre} <span style={{ color: 'var(--text-muted)' }}>· {v.asesora}{v.origen === 'duplicado' ? ' · posible duplicado' : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        <Tabla titulo={`Por asesora · ${nombreMes(mes)}`} etiqueta="Asesora" filas={agrupar(leadsMes, asesoraDe)} />
        <Tabla titulo={`Por fuente · ${nombreMes(mes)}`} etiqueta="Fuente" filas={agrupar(leadsMes, l => l.fuente)} />
      </section>

      <section className="mt-6 overflow-x-auto rounded-xl p-5" style={caja}>
        <h2 className="font-plus-jakarta text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>Por mes</h2>
        <table className="mt-3 w-full font-inter text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="py-1 text-left font-normal">Mes</th>
              <th className="py-1 text-right font-normal">Leads</th>
              <th className="py-1 text-right font-normal">Vendidos</th>
              <th className="py-1 text-right font-normal">Conversión</th>
              <th className="py-1 text-right font-normal">Ventas cerradas</th>
              <th className="py-1 text-right font-normal">Sin lead</th>
              <th className="py-1 text-right font-normal">Valor</th>
            </tr>
          </thead>
          <tbody style={{ color: 'var(--text-dim)' }}>
            {porMes.map(f => (
              <tr key={f.mes} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-1.5 capitalize">{nombreMes(f.mes)}</td>
                <td className="py-1.5 text-right tabular-nums">{f.leads}</td>
                <td className="py-1.5 text-right tabular-nums">{f.vendidos}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{pct(f.vendidos, f.leads)}</td>
                <td className="py-1.5 text-right tabular-nums">{f.ventas}</td>
                <td className="py-1.5 text-right tabular-nums">{f.sinLead}</td>
                <td className="py-1.5 text-right tabular-nums">{f.valor ? pesos.format(f.valor) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function Titulo() {
  return (
    <div className="mb-6">
      <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Conversión real</h1>
      <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
        Cuántos leads terminan en venta. GHL mide cada pipeline por separado y, como la venta se muda de Leads a
        Reservaciones, allá la conversión sale en cero. Aquí se juntan los dos. Datos desde octubre de 2026.
      </p>
    </div>
  )
}

function Tarjeta({ t, n, sub, destacada }: { t: string; n: string; sub: string; destacada?: boolean }) {
  return (
    <div className="rounded-xl p-4" style={destacada ? { ...caja, borderColor: 'var(--orange)' } : caja}>
      <p className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{t}</p>
      <p className="mt-1 font-plus-jakarta text-3xl font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{n}</p>
      <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>{sub}</p>
    </div>
  )
}

function Tabla({ titulo, etiqueta, filas }: { titulo: string; etiqueta: string; filas: FilaGrupo[] }) {
  return (
    <div className="overflow-x-auto rounded-xl p-5" style={caja}>
      <h2 className="font-plus-jakarta text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>{titulo}</h2>
      <table className="mt-3 w-full font-inter text-sm">
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th className="py-1 text-left font-normal">{etiqueta}</th>
            <th className="py-1 text-right font-normal">Leads</th>
            <th className="py-1 text-right font-normal">Vendidos</th>
            <th className="py-1 text-right font-normal">Conversión</th>
          </tr>
        </thead>
        <tbody style={{ color: 'var(--text-dim)' }}>
          {filas.map(f => (
            <tr key={f.clave} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="py-1.5 pr-3">{f.clave}</td>
              <td className="py-1.5 text-right tabular-nums">{f.leads}</td>
              <td className="py-1.5 text-right tabular-nums">{f.vendidos}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{pct(f.vendidos, f.leads)}</td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr><td colSpan={4} className="py-3 text-center" style={{ color: 'var(--text-muted)' }}>Sin leads este mes</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
