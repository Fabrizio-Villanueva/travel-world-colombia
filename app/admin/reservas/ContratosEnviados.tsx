import Link from 'next/link'
import { ChevronRight, FileSignature } from 'lucide-react'
import type { ContratoListado, EstadoListado, FiltroListado } from '@/lib/contratos/listado'

// Mismos colores que el panel del contrato de cada reserva (ContratoPanel).
const ESTADO: Record<EstadoListado, { texto: string; fondo: string; color: string }> = {
  enviado: { texto: 'Enviado · sin abrir', fondo: '#EDF3FC', color: '#2957A4' },
  visto: { texto: 'Abierto por el cliente', fondo: '#FFF7DC', color: '#8a6a00' },
  firmado: { texto: 'Firmado', fondo: '#E7F5EA', color: '#2e7d32' },
  anulado: { texto: 'Anulado', fondo: '#FDECEC', color: '#c62828' },
  vencido: { texto: 'Enlace vencido', fondo: '#FDECEC', color: '#c62828' },
}

const FILTROS: { id: FiltroListado; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'pendientes', texto: 'Por firmar' },
  { id: 'firmados', texto: 'Firmados' },
]

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Quién lo envió, sin el dominio (asesor1.travelworld@gmail.com → asesor1.travelworld). */
const quien = (email: string) => email.split('@')[0]

export function ContratosEnviados({
  contratos,
  filtro,
  verTodos,
}: {
  contratos: ContratoListado[]
  filtro: FiltroListado
  verTodos: boolean
}) {
  return (
    <section id="contratos-enviados" className="mt-10 scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-inter text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            <FileSignature size={18} /> Contratos enviados
          </h2>
          <p className="mt-0.5 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            {verTodos ? 'Todos los del equipo' : 'Los que enviaste tú'} · el último de cada reserva, lo más reciente arriba.
          </p>
        </div>
        <nav className="flex gap-1">
          {FILTROS.map(f => {
            const activo = f.id === filtro
            return (
              <Link
                key={f.id}
                href={f.id === 'todos' ? '/admin/reservas' : `/admin/reservas?f=${f.id}`}
                scroll={false}
                className="rounded-full px-3 py-1 font-inter text-xs"
                style={{
                  border: '1px solid var(--border)',
                  background: activo ? 'var(--navy, #0D1E3C)' : 'white',
                  color: activo ? 'white' : 'var(--text-dim)',
                  fontWeight: activo ? 600 : 400,
                }}
              >
                {f.texto}
              </Link>
            )
          })}
        </nav>
      </div>

      {contratos.length === 0 ? (
        <p className="rounded-xl p-6 text-center font-inter text-sm" style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          {filtro === 'todos' ? 'Todavía no hay contratos enviados.' : 'No hay contratos en este filtro.'}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl" style={{ background: 'white', border: '1px solid var(--border)' }}>
          {contratos.map((c, i) => {
            const e = ESTADO[c.estado]
            return (
              <li key={c.id} style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}>
                <Link
                  href={`/admin/reservas/${c.opportunityId}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-alt)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {c.titular || 'Sin titular'}
                      {c.reserva && <span className="ml-2 font-normal" style={{ color: 'var(--text-dim)' }}>TW-{c.reserva}</span>}
                    </p>
                    <p className="truncate font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                      {c.estado === 'firmado' && c.firmadoEn ? `Firmado ${fecha(c.firmadoEn)}` : `Enviado ${fecha(c.creadoEn)}`}
                      {verTodos && ` · por ${quien(c.creadoPor)}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 font-inter text-xs font-semibold" style={{ background: e.fondo, color: e.color }}>
                    {e.texto}
                  </span>
                  <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--text-dim)' }} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
