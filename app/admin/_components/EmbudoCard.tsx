import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Embudo } from '@/lib/admin/embudos'

const pct = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 100) : 0)

/**
 * Embudo como barras horizontales de una sola serie: cada etapa mide contra
 * la primera (100 %). Número y porcentaje en texto; la barra solo da escala.
 */
export function EmbudoCard({ titulo, href, embudo }: { titulo: string; href?: string; embudo: Embudo }) {
  const base = embudo.etapas[0]?.n ?? 0
  const aparte = embudo.aparte.filter(a => a.n > 0)

  return (
    <section className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{titulo}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 font-inter text-xs" style={{ color: 'var(--orange)' }}>
            Ver lista <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {base === 0 ? (
        <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>Todavía no hay envíos.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {embudo.etapas.map((e, i) => {
            const p = pct(e.n, base)
            return (
              <li key={e.etiqueta} title={`${e.etiqueta}: ${e.n} de ${base} (${p} %)`}>
                <div className="mb-1 flex items-baseline justify-between gap-3 font-inter text-sm">
                  <span style={{ color: 'var(--text-primary)' }}>{e.etiqueta}</span>
                  <span className="shrink-0 tabular-nums">
                    <strong style={{ color: 'var(--text-primary)' }}>{e.n}</strong>
                    {i > 0 && <span className="ml-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>{p} %</span>}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded" style={{ background: 'rgba(13, 30, 60, 0.06)' }}>
                  <div className="h-full rounded" style={{ width: `${Math.max(p, e.n > 0 ? 2 : 0)}%`, background: '#2957A4' }} />
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {aparte.length > 0 && (
        <p className="mt-4 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
          {aparte.map(a => `${a.etiqueta}: ${a.n}`).join(' · ')}
        </p>
      )}
    </section>
  )
}
