import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CircleCheck, ShieldCheck } from 'lucide-react'
import { oportunidadDelToken } from '@/lib/abonos/enlace'
import { libroDe, reservaGhl } from '@/lib/abonos/registro'
import { enDivisa } from '@/lib/contratos/divisa'
import { getAvisoSeguridad, numeroLegible } from '@/lib/aviso-seguridad'
import { SITE } from '@/lib/site'
import { ImprimirBoton } from './ImprimirBoton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Estado de cuenta', robots: { index: false, follow: false } }

const fechaLarga = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Estado de cuenta del cliente (17-oct-2026): todos sus abonos y el saldo por
 * divisa, siempre al día (sale del libro de abonos). El enlace va firmado
 * (lib/abonos/enlace.ts) y llega en cada confirmación de abono por WhatsApp.
 * No muestra datos internos (quién registró, notas).
 */
export default async function EstadoDeCuentaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const oppId = oportunidadDelToken(token)
  if (!oppId) notFound()

  let reserva, libro
  try {
    reserva = await reservaGhl(oppId)
    libro = await libroDe(oppId, reserva)
  } catch {
    notFound()
  }
  const aviso = await getAvisoSeguridad()
  const o = reserva.porNombre
  const numeroReserva = o['TWC'] ? String(o['TWC']) : null
  const destino = o['Destino de interés'] ? String(o['Destino de interés']) : null
  const salida = o['Fecha confirmada de salida'] ? String(o['Fecha confirmada de salida']).slice(0, 10) : null
  const titular = reserva.opp.name ?? ''
  const { abonos, cuentas } = libro.estado
  const ahora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' })

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12" style={{ background: '#F4F7FB', color: '#0D1E3C' }}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Image src="/images/travel-world-colombia-logo.png" alt={SITE.nombre} width={170} height={44} className="h-10 w-auto" priority />
          <ImprimirBoton />
        </header>

        <section className="rounded-2xl p-6 sm:p-8" style={{ background: 'white', boxShadow: '0 10px 30px -18px rgba(13,30,60,0.35)' }}>
          <p className="font-inter text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#2957A4' }}>Estado de cuenta</p>
          <h1 className="mt-1 font-plus-jakarta text-2xl font-extrabold">{titular}</h1>
          <p className="mt-1 font-inter text-sm" style={{ color: '#5B6B82' }}>
            {[numeroReserva ? `Reserva TW-${numeroReserva}` : null, destino, salida ? `Viaje: ${fechaLarga(salida)}` : null].filter(Boolean).join(' · ')}
          </p>

          {/* Resumen por divisa */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {cuentas.map(c => (
              <div key={c.divisa} className="rounded-xl p-4" style={{ background: c.saldo === 0 ? '#E7F5EA' : '#F4F7FB' }}>
                <p className="font-inter text-xs font-semibold" style={{ color: '#5B6B82' }}>{cuentas.length > 1 ? `En ${c.divisa}` : 'Resumen'}</p>
                {c.total != null && <p className="mt-1 font-inter text-sm">Valor del plan: <strong>{enDivisa(c.total, c.divisa)}</strong></p>}
                <p className="font-inter text-sm">Abonado: <strong>{enDivisa(c.abonado, c.divisa)}</strong></p>
                <p className="mt-1 font-plus-jakarta text-lg font-extrabold" style={{ color: c.saldo === 0 ? '#1B5E20' : '#0D1E3C' }}>
                  {c.saldo === 0 ? (
                    <span className="flex items-center gap-1.5"><CircleCheck size={18} /> Pagado</span>
                  ) : c.saldo != null ? (
                    <>Saldo: {enDivisa(c.saldo, c.divisa)}</>
                  ) : (
                    <>Saldo por confirmar</>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Abonos */}
          <h2 className="mt-8 mb-3 font-plus-jakarta text-base font-bold">Tus abonos ({abonos.length})</h2>
          {abonos.length === 0 ? (
            <p className="font-inter text-sm" style={{ color: '#5B6B82' }}>Todavía no hay abonos registrados.</p>
          ) : (
            <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #E3E9F2' }}>
              <table className="w-full font-inter text-sm">
                <thead style={{ background: '#F4F7FB', color: '#5B6B82' }}>
                  <tr className="text-left text-xs">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 font-semibold">Medio</th>
                    <th className="px-3 py-2 text-right font-semibold">Abono</th>
                    <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {abonos.map((a, i) => (
                    <tr key={a.id} style={{ borderTop: '1px solid #E3E9F2' }}>
                      <td className="px-3 py-2.5" style={{ color: '#5B6B82' }}>{i + 1}</td>
                      <td className="px-3 py-2.5">{fechaLarga(a.fecha)}</td>
                      <td className="px-3 py-2.5" style={{ color: '#5B6B82' }}>{a.medio ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{enDivisa(a.monto, a.divisa)}</td>
                      <td className="hidden px-3 py-2.5 text-right sm:table-cell" style={{ color: '#5B6B82' }}>{a.saldoTras != null ? enDivisa(a.saldoTras, a.divisa) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-6 font-inter text-xs" style={{ color: '#5B6B82' }}>
            Actualizado al {ahora}. Los saldos en dólares o euros se liquidan a la TRM del día en que se recibe cada pago; el valor final
            lo confirma tu asesor y la liquidación completa va en la factura de venta.
          </p>
        </section>

        <section className="mt-4 flex items-start gap-3 rounded-2xl p-5 font-inter text-sm" style={{ background: '#FFF4D6', border: '1px solid #E0A800', color: '#3D2E00' }}>
          <ShieldCheck size={20} className="mt-0.5 shrink-0" style={{ color: '#B42318' }} />
          <p>
            ¿Algo no coincide? Escríbenos solo a nuestros WhatsApp oficiales: <strong>{aviso.numeros.map(numeroLegible).join(' o ')}</strong>.
            Paga únicamente a las cuentas de <Link href="/pagos" className="font-semibold underline">nuestra página de pagos</Link>, a nombre de Vamos Por Más S.A.S.
          </p>
        </section>

        <p className="mt-6 text-center font-inter text-[11px]" style={{ color: '#94A3B8' }}>
          {SITE.nombre} · RNT {SITE.rnt} · {SITE.url.replace(/^https?:\/\//, '')}
        </p>
      </div>
    </div>
  )
}
