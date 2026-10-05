import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink, FileText, ShieldCheck, TriangleAlert } from 'lucide-react'
import { getAdminSession } from '@/lib/admin/guard'
import { registrarActividad } from '@/lib/admin/audit'
import { CARA_LABEL, TIPO_VIAJERO_EDADES, TIPO_VIAJERO_LABEL } from '@/lib/documentos/config'
import { CAMPO_LABEL, CAMPOS_FECHA, CAMPOS_POR_TIPO } from '@/lib/documentos/tipos'
import { documentosViajeroPanel } from '@/lib/documentos/solicitudes'

/**
 * Documentos de UN viajero, para abrir desde el CRM: el campo de oportunidad
 * `P{n} - Documentos (panel)` apunta aquí. Exige sesión del equipo (admin,
 * editor o representante), firma las fotos por 5 minutos y deja cada apertura
 * en la bitácora. Las imágenes nunca se copian a GHL.
 */

export const metadata: Metadata = { title: 'Documentos del viajero · Panel', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.08)'
const PAGE = '#F4F7FB'

const fmtDia = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '')

export default async function DocumentosViajeroPage({
  params,
}: {
  params: Promise<{ id: string; viajero: string }>
}) {
  const { id, viajero: v } = await params
  const session = await getAdminSession()
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(`/admin/reservas/${id}/documentos/${v}`)}`)
  if (session.rol === 'lector') redirect('/admin')

  const viajero = Number(v)
  const datos = await documentosViajeroPanel(id, viajero)

  if (datos) {
    await registrarActividad({
      email: session.user.email!,
      accion: 'ver-documento',
      nombre: id,
      detalle: { origen: 'enlace-crm', viajero, archivos: datos.documentos.flatMap(d => d.caras.map(c => c.id)) },
    })
  }

  const nombre =
    datos?.documentos
      .map(d => d.principal?.datos_confirmados)
      .map(dc => [dc?.nombres, dc?.apellidos].filter(Boolean).join(' '))
      .find(Boolean) ||
    datos?.nombre ||
    null

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <Link href={`/admin/reservas/${id}`} className="inline-flex items-center gap-1.5 font-inter text-sm" style={{ color: 'var(--orange)' }}>
          <ArrowLeft size={15} /> Ir al Generador de Contratos
        </Link>
      </div>

      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
            Documentos · Viajero {Number.isInteger(viajero) ? viajero : '—'}
          </p>
          <h1 className="font-playfair text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {nombre ?? `Viajero ${v}`}
          </h1>
          {datos && (
            <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
              {TIPO_VIAJERO_LABEL[datos.tipoViajero]} ({TIPO_VIAJERO_EDADES[datos.tipoViajero]}) ·{' '}
              {datos.solicitud.destino ?? datos.solicitud.nombre_viaje ?? 'Viaje'}
              {datos.solicitud.fecha_salida ? ` · salida ${fmtDia(datos.solicitud.fecha_salida)}` : ''}
            </p>
          )}
        </div>
        <p className="flex max-w-sm items-start gap-2 rounded-xl px-3 py-2 font-inter text-[11px] leading-snug" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
          <ShieldCheck size={15} className="mt-px shrink-0" />
          Vista privada: las fotos se firman por 5 minutos y esta apertura quedó en la bitácora. No las reenvíes por WhatsApp.
        </p>
      </header>

      {!datos ? (
        <p className="rounded-xl bg-white p-6 font-inter text-sm" style={{ color: NAVY, border: `1px solid ${BORDER}` }}>
          Este viaje no tiene documentos para ese viajero (o el enlace de documentos aún no se ha enviado).
        </p>
      ) : datos.solicitud.purgada_en ? (
        <p className="rounded-xl bg-white p-6 font-inter text-sm" style={{ color: NAVY, border: `1px solid ${BORDER}` }}>
          Las fotos de este viaje se borraron el {fmtDia(datos.solicitud.purgada_en.slice(0, 10))} por la política de
          retención (30 días después del regreso). Los datos siguen en la tarjeta de GHL.
        </p>
      ) : datos.documentos.length === 0 ? (
        <p className="rounded-xl bg-white p-6 font-inter text-sm" style={{ color: NAVY, border: `1px solid ${BORDER}` }}>
          Este viajero no tiene documentos pedidos.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {datos.documentos.map(d => {
            const p = d.principal
            const info = p?.datos_confirmados ?? p?.datos_extraidos ?? null
            const estado = p?.confirmado_en
              ? { t: 'Confirmado por el cliente', c: '#047857', dot: '#10B981' }
              : d.caras.length > 0
                ? { t: 'Subido, sin confirmar', c: '#B45309', dot: '#F59E0B' }
                : { t: 'Pendiente', c: MUTED, dot: '#94A3B8' }
            return (
              <section key={d.tipo} className="overflow-hidden rounded-[18px] bg-white" style={{ border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(13,30,60,0.04)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <h2 className="font-plus-jakarta text-base font-bold" style={{ color: NAVY }}>
                    {d.etiqueta}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 font-inter text-xs font-semibold" style={{ color: estado.c }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: estado.dot }} /> {estado.t}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_260px]">
                  <div className={`grid gap-4 ${d.caras.length + d.faltan.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                    {d.caras.map(c => (
                      <figure key={c.id} className="flex flex-col gap-2">
                        <figcaption className="font-inter text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                          {CARA_LABEL[c.cara]}
                        </figcaption>
                        {!c.url ? (
                          <div className="flex h-40 items-center justify-center rounded-xl font-inter text-xs" style={{ background: PAGE, color: MUTED }}>
                            La foto ya no está disponible.
                          </div>
                        ) : c.mime === 'application/pdf' || c.mime === 'image/heic' || c.mime === 'image/heif' ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl font-inter text-xs font-semibold"
                            style={{ background: PAGE, color: NAVY, border: `1px solid ${BORDER}` }}
                          >
                            <FileText size={22} /> Abrir {c.mime === 'application/pdf' ? 'PDF' : 'archivo'} (5 min) <ExternalLink size={13} />
                          </a>
                        ) : (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" title="Abrir en tamaño completo (5 min)">
                            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de un bucket privado: no pasa por el optimizador */}
                            <img
                              src={c.url}
                              alt={`${d.etiqueta} · ${CARA_LABEL[c.cara].toLowerCase()}`}
                              referrerPolicy="no-referrer"
                              className="max-h-[420px] w-full rounded-xl object-contain"
                              style={{ background: PAGE, border: `1px solid ${BORDER}` }}
                            />
                          </a>
                        )}
                      </figure>
                    ))}
                    {d.faltan.map(c => (
                      <div key={c} className="flex flex-col gap-2">
                        <span className="font-inter text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                          {CARA_LABEL[c]}
                        </span>
                        <div className="flex h-40 items-center justify-center rounded-xl font-inter text-xs" style={{ border: `2px dashed ${BORDER}`, color: MUTED }}>
                          El cliente aún no la sube
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3">
                    {info && (
                      <dl className="flex flex-col gap-2">
                        {CAMPOS_POR_TIPO[d.tipo]
                          .filter(c => info[c])
                          .map(c => (
                            <div key={c} className="flex items-baseline justify-between gap-3 font-inter text-xs">
                              <dt className="text-[11px]" style={{ color: MUTED }}>{CAMPO_LABEL[c]}</dt>
                              <dd className={`text-right font-semibold ${c === 'numero' ? 'font-mono font-medium' : ''}`} style={{ color: NAVY }}>
                                {CAMPOS_FECHA.includes(c) ? fmtDia(info[c]) : info[c]}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    )}
                    {[...(p?.revision_requerida ? ['Revisar: la lectura automática no fue segura.'] : []), ...(p?.avisos ?? [])].map((n, i) => (
                      <p key={i} className="flex items-start gap-2 rounded-lg p-2.5 font-inter text-[11px] leading-tight" style={{ background: 'rgba(255,251,235,0.8)', border: '1px solid rgba(253,230,138,0.8)', color: '#78350F' }}>
                        <TriangleAlert size={14} className="mt-px shrink-0" style={{ color: '#D97706' }} /> {n}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
          <p className="font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
            ¿Las fotos no cargan? Pasaron más de 5 minutos: recarga la página (F5).
          </p>
        </div>
      )}
    </div>
  )
}
