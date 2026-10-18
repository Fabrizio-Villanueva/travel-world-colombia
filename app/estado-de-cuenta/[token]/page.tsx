import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Plane, ShieldCheck } from 'lucide-react'
import { oportunidadDelToken } from '@/lib/abonos/enlace'
import { libroDe, reservaGhl } from '@/lib/abonos/registro'
import { obtenerContacto } from '@/lib/agente/ghl'
import { enDivisa } from '@/lib/contratos/divisa'
import { getAvisoSeguridad, numeroLegible } from '@/lib/aviso-seguridad'
import { AGENCIA, AVISO_SALDOS_EXTRANJERA, MEDIOS_DE_PAGO } from '@/components/contrato/ContratoDocumento'
import s from '@/components/contrato/ContratoDocumento.module.css'
import marco from '@/app/contrato/layout.module.css'
import { ImprimirBoton } from './ImprimirBoton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Estado de cuenta', robots: { index: false, follow: false } }

const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Estado de cuenta del cliente (17-oct-2026): todos sus abonos y el saldo por
 * divisa, siempre al día (sale del libro de abonos). Misma marca que el
 * contrato (cabecera, franja con el saldo en dorado, secciones numeradas,
 * avisos y medios de pago) para que el cliente lo reconozca como parte del
 * mismo documento. El enlace va firmado (lib/abonos/enlace.ts) y llega en cada
 * confirmación de abono. No muestra datos internos (quién registró, notas).
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
  const [aviso, contacto] = await Promise.all([
    getAvisoSeguridad(),
    reserva.contactId ? obtenerContacto(reserva.contactId).catch(() => null) : Promise.resolve(null),
  ])
  const o = reserva.porNombre
  const numeroReserva = o['TWC'] ? String(o['TWC']) : null
  const destino = o['Destino de interés'] ? String(o['Destino de interés']) : null
  const salida = o['Fecha confirmada de salida'] ? String(o['Fecha confirmada de salida']) : null
  const regreso = o['Fecha confirmada de regreso'] ? String(o['Fecha confirmada de regreso']) : null
  // El titular es el contacto de la reserva; si no tiene nombre, el de la oportunidad.
  const titular =
    [contacto?.firstName, contacto?.lastName].filter(Boolean).join(' ').trim() ||
    (reserva.opp.name ?? '').replace(/^🧪\s*PRUEBA\s*-\s*/i, '')
  const { abonos, cuentas } = libro.estado
  const pendientes = cuentas.filter(c => c.saldo != null && c.saldo > 0)
  const conocidos = cuentas.some(c => c.saldo != null)
  const saldoTexto = pendientes.length
    ? pendientes.map(c => enDivisa(c.saldo!, c.divisa)).join(' + ')
    : conocidos
      ? 'Pagado'
      : 'Por confirmar'
  const abonadoTexto = cuentas.filter(c => c.abonado > 0).map(c => enDivisa(c.abonado, c.divisa)).join(' + ') || enDivisa(0, 'COP')
  const extranjera = cuentas.some(c => c.divisa !== 'COP')
  const ahora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })
  const viaje = salida ? (regreso ? `${fechaCorta(salida)} – ${fechaCorta(regreso)}` : fechaCorta(salida)) : '—'

  return (
    <div className={marco.marco}>
      <div className="mx-auto mb-3 flex max-w-[816px] justify-end px-4 pt-4 sm:px-0 sm:pt-0 print:hidden">
        <ImprimirBoton />
      </div>
      <div className="shadow-xl sm:mx-auto sm:max-w-[816px] sm:overflow-hidden sm:rounded-xl">
        <article className={s.contrato} lang="es">
          {/* ── Cabecera ── */}
          <header className={s.cabecera}>
            {/* eslint-disable-next-line @next/next/no-img-element -- igual que el contrato (también se imprime) */}
            <img src="/images/travel-world-colombia-logo.png" alt="Travel World Colombia" className={s.logo} />
            <div className={s.cabeceraTexto}>
              <p className={s.eyebrow}>Estado de cuenta</p>
              <p className={s.reserva}>{numeroReserva ? `Reserva TW-${numeroReserva}` : 'Tu reserva'}</p>
              <p className={s.cabeceraMeta}>Actualizado al {ahora}</p>
            </div>
          </header>

          {/* ── Resumen: como el del contrato, con el saldo en dorado ── */}
          <div className={s.resumen}>
            <div className={s.resumenDestino}>
              <Plane size={16} aria-hidden />
              <div>
                <span className={s.resumenEtiqueta}>Destino</span>
                <span className={s.resumenValor}>{destino ?? '—'}</span>
              </div>
            </div>
            <div>
              <span className={s.resumenEtiqueta}>Viaje</span>
              <span className={s.resumenValor}>{viaje}</span>
            </div>
            <div>
              <span className={s.resumenEtiqueta}>Abonos</span>
              <span className={s.resumenValor}>{abonos.length}</span>
            </div>
            <div>
              <span className={s.resumenEtiqueta}>Total abonado</span>
              <span className={s.resumenValor}>{abonadoTexto}</span>
            </div>
            <div className={s.resumenSaldo}>
              <span className={s.resumenEtiqueta}>Saldo pendiente</span>
              <span className={s.resumenValor}>{saldoTexto}</span>
            </div>
          </div>

          <div className={s.cuerpo}>
            <section className={s.seccion}>
              <h2 className={s.seccionTitulo}>
                <span className={s.seccionNumero}>01</span>
                Titular
              </h2>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{titular}</p>
            </section>

            <section className={s.seccion}>
              <h2 className={s.seccionTitulo}>
                <span className={s.seccionNumero}>02</span>
                Tus abonos
              </h2>
              {abonos.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--suave)' }}>Todavía no hay abonos registrados.</p>
              ) : (
                <table className={s.tabla}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha</th>
                      <th>Medio de pago</th>
                      <th className={s.num}>Abono</th>
                      <th className={s.num}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonos.map((a, i) => (
                      <tr key={a.id}>
                        <td data-label="#">{i + 1}</td>
                        <td data-label="Fecha">{fechaCorta(a.fecha)}</td>
                        <td data-label="Medio de pago">{a.medio ?? '—'}</td>
                        <td data-label="Abono" className={s.num}><strong>{enDivisa(a.monto, a.divisa)}</strong></td>
                        <td data-label="Saldo" className={s.num}>{a.saldoTras != null ? enDivisa(a.saldoTras, a.divisa) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={s.total}>
                      <td colSpan={3}>Total abonado</td>
                      <td data-label="Abonado" className={s.num}>{abonadoTexto}</td>
                      <td data-label="Saldo pendiente" className={s.num}>{saldoTexto}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {cuentas.length > 0 && (
              <section className={s.seccion}>
                <h2 className={s.seccionTitulo}>
                  <span className={s.seccionNumero}>03</span>
                  Resumen por divisa
                </h2>
                <table className={s.tabla}>
                  <thead>
                    <tr>
                      <th>Divisa</th>
                      <th className={s.num}>Valor del plan</th>
                      <th className={s.num}>Abonado</th>
                      <th className={s.num}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map(c => (
                      <tr key={c.divisa}>
                        <td data-label="Divisa">{c.divisa}</td>
                        <td data-label="Valor del plan" className={s.num}>{c.total != null ? enDivisa(c.total, c.divisa) : 'Por confirmar'}</td>
                        <td data-label="Abonado" className={s.num}>{enDivisa(c.abonado, c.divisa)}</td>
                        <td data-label="Saldo" className={s.num}>
                          <strong>{c.saldo == null ? 'Por confirmar' : c.saldo === 0 ? 'Pagado' : enDivisa(c.saldo, c.divisa)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {extranjera && (
                  <div className={`${s.aviso} ${s.avisoSaldos}`}>
                    <span>Saldos en dólares o euros</span>
                    <ul className={s.avisoLista}>
                      {AVISO_SALDOS_EXTRANJERA.map(t => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {pendientes.length > 0 && (
              <div className={s.medios}>
                <span className={s.mediosTitulo}>Medios de pago autorizados</span>
                <ul>
                  {MEDIOS_DE_PAGO.map(({ Icono, texto }) => (
                    <li key={texto}>
                      <Icono size={12} aria-hidden /> {texto}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={`${s.aviso} ${s.avisoCargos}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <ShieldCheck size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: '#B42318' }} />
              <div>
                <span>Evita fraudes</span>
                <p>
                  ¿Algo no coincide? Escríbenos solo a nuestros WhatsApp oficiales: <strong>{aviso.numeros.map(numeroLegible).join(' o ')}</strong>.
                  Paga únicamente a cuentas a nombre de Vamos Por Más S.A.S. o Travel World Colombia.
                </p>
              </div>
            </div>
            <div style={{ height: 24 }} />
          </div>

          <footer className={s.pie}>
            {AGENCIA.razonSocial} · NIT {AGENCIA.nit} · RNT {AGENCIA.rnt} · {AGENCIA.direccion} · {AGENCIA.web}
          </footer>
        </article>
      </div>
    </div>
  )
}
