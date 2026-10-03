import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileCheck, Globe } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/guard'
import { listarSolicitudes } from '@/lib/documentos/solicitudes'
import { tiposRequeridos, TIPO_EMOJI } from '@/lib/documentos/config'

export const metadata: Metadata = { title: 'Documentos de viajeros · Panel' }
export const dynamic = 'force-dynamic'

const fmt = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
const fmtDia = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')

/**
 * Vista global del portal de documentos: cada enlace enviado, su progreso y
 * su estado. Los documentos en sí se ven desde el Generador de Contratos de
 * cada viaje (pestaña Documentos), que es donde queda la bitácora de vistas.
 */
export default async function DocumentosAdminPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol === 'representante') redirect('/admin/reservas')

  const solicitudes = await listarSolicitudes(150)
  const estadoChip: Record<string, { t: string; c: string; bg: string }> = {
    activa: { t: 'Activa', c: '#1d4ed8', bg: '#dbeafe' },
    completa: { t: 'Completa', c: '#15803d', bg: '#dcfce7' },
    revocada: { t: 'Desactivada', c: '#991b1b', bg: '#fee2e2' },
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Documentos de viajeros
          </h1>
          <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Enlaces enviados a los clientes para subir pasaportes, cédulas y visas. Los archivos viven en un
            bucket privado y se borran 30 días después del regreso; los datos quedan en P1–P8 de la tarjeta.
          </p>
        </div>
        <Link
          href="/admin/documentos/visas"
          className="flex items-center gap-2 rounded-md px-3 py-2 font-inter text-sm"
          style={{ border: '1px solid var(--border-orange)', color: 'var(--orange)' }}
        >
          <Globe size={15} /> Reglas de visa por país
        </Link>
      </div>

      {solicitudes.length === 0 ? (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Aún no se ha enviado ningún enlace. Se envían desde el Generador de Contratos → pestaña Documentos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {solicitudes.map(s => {
            const chip = estadoChip[s.estado]
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-lg p-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: chip.c }}>
                  <FileCheck size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                    <Link href={`/admin/reservas/${s.opportunity_id}`} className="font-semibold underline-offset-2 hover:underline">
                      {s.nombre_viaje ?? s.opportunity_id}
                    </Link>
                    {s.destino ? <span style={{ color: 'var(--text-dim)' }}> · {s.destino}</span> : null}
                  </p>
                  <p className="truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
                    Salida {fmtDia(s.fecha_salida)} · {s.viajeros} viajero{s.viajeros === 1 ? '' : 's'} ·{' '}
                    {tiposRequeridos(s.requisitos).map(t => TIPO_EMOJI[t]).join(' ')} · enviado {fmt.format(new Date(s.creada_en))} por {s.creada_por}
                    {s.purgada_en ? ' · fotos borradas (retención)' : ''}
                  </p>
                </div>
                <span className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                  {s.progreso.confirmados}/{s.progreso.requeridos}
                </span>
                <span className="rounded-full px-2 py-0.5 font-inter text-[11px] font-semibold" style={{ color: chip.c, background: chip.bg }}>
                  {chip.t}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
