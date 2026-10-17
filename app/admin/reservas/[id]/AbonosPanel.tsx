'use client'

import { useEffect, useState } from 'react'
import { Ban, Check, Copy, ExternalLink, Loader2, MessageCircle, Plus, Wallet } from 'lucide-react'
import { DIVISAS, UNIDAD_TRM, enDivisa, type Divisa } from '@/lib/contratos/divisa'
import type { CuentaDivisa } from '@/lib/abonos/calculo'
import {
  anularAbonoAction,
  cargarAbonos,
  reenviarConfirmacionAction,
  registrarAbonoAction,
  type DatosAbono,
  type PanelAbonos,
} from './abonos-actions'

/**
 * Libro de abonos de la reserva (17-oct-2026): reemplaza los "Pago 1..4" que
 * se llenaban a mano. Cada abono queda a nombre de quien lo registra, sin
 * tope; los 10 primeros se copian a GHL (y al contrato) y el cliente ve todo
 * en su estado de cuenta. Al registrar se le puede enviar la confirmación por
 * WhatsApp.
 */

const MEDIOS = ['Transferencia', 'Efectivo', 'Tarjeta de crédito', 'Bre-B', 'PSE', 'Zelle', 'Chase']
const inputCls = 'w-full rounded-md px-3 py-2 font-inter text-sm outline-none'
const inputStyle = { background: 'white', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
const hoy = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10) // Bogotá
const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function AbonosPanel({ opportunityId, onCuentas }: { opportunityId: string; onCuentas?: (c: CuentaDivisa[]) => void }) {
  const [p, setP] = useState<PanelAbonos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [f, setF] = useState<DatosAbono>({
    fecha: hoy(), divisa: 'COP', monto: '', totalPlan: '', trm: '', medio: 'Transferencia', referencia: '', nota: '', enviarMensaje: true,
  })

  function aplicar(datos: PanelAbonos) {
    setP(datos)
    onCuentas?.(datos.estado.cuentas)
  }

  useEffect(() => {
    cargarAbonos(opportunityId).then(r => (r.ok ? aplicar(r.datos) : setError(r.error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId])

  // Total del plan sugerido para la divisa elegida: el último anotado o el de la liquidación.
  const totalSugerido = (d: Divisa): string => {
    if (!p) return ''
    const ultimo = [...p.estado.abonos].reverse().find(a => a.divisa === d)?.totalPlan
    const t = ultimo ?? p.base[d] ?? null
    return t != null ? String(t) : ''
  }

  function abrirFormulario() {
    const ultimaDivisa = (p?.estado.abonos.at(-1)?.divisa ?? 'COP') as Divisa
    setF(x => ({ ...x, fecha: hoy(), divisa: ultimaDivisa, monto: '', totalPlan: totalSugerido(ultimaDivisa), trm: '', referencia: '', nota: '' }))
    setAviso(null)
    setAbierto(true)
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setAviso(null)
    const r = await registrarAbonoAction(opportunityId, f)
    setGuardando(false)
    if (!r.ok) return setAviso({ ok: false, texto: r.error })
    aplicar(r.datos.panel)
    setAbierto(false)
    setAviso({
      ok: r.datos.mensaje !== 'error',
      texto:
        r.datos.mensaje === 'enviado'
          ? 'Abono registrado y confirmación enviada al cliente por WhatsApp.'
          : r.datos.mensaje === 'error'
            ? `Abono registrado, pero el mensaje no salió: ${r.datos.aviso}. Puedes reenviarlo desde la lista.`
            : 'Abono registrado (sin mensaje al cliente).',
    })
  }

  async function anular(id: string) {
    const motivo = window.prompt('¿Por qué se anula este abono? (queda en el historial)')
    if (!motivo) return
    const r = await anularAbonoAction(opportunityId, id, motivo)
    if (!r.ok) return setAviso({ ok: false, texto: r.error })
    aplicar(r.datos)
    setAviso({ ok: true, texto: 'Abono anulado. El saldo y GHL ya se actualizaron.' })
  }

  async function reenviar(id: string) {
    const r = await reenviarConfirmacionAction(opportunityId, id)
    if (!r.ok) return setAviso({ ok: false, texto: r.error })
    aplicar(r.datos)
    setAviso({ ok: true, texto: 'Confirmación reenviada por WhatsApp.' })
  }

  async function copiar() {
    if (!p) return
    try {
      await navigator.clipboard.writeText(p.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      /* sin portapapeles */
    }
  }

  const vigentes = p?.estado.abonos ?? []
  const anulados = (p?.abonos ?? []).filter(a => a.anulado_en)

  return (
    <fieldset className="mt-4 rounded-lg p-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
      <legend className="flex items-center gap-1.5 px-2 font-inter text-xs font-semibold" style={{ color: 'var(--orange)' }}>
        <Wallet size={14} /> Abonos del cliente
      </legend>

      {!p && !error && (
        <p className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          <Loader2 size={15} className="animate-spin" /> Cargando abonos…
        </p>
      )}
      {error && <p className="font-inter text-sm" style={{ color: '#dc2626' }}>No se pudieron cargar los abonos: {error}</p>}

      {p && (
        <>
          {/* Resumen por divisa */}
          {p.estado.cuentas.length > 0 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {p.estado.cuentas.map(c => (
                <div key={c.divisa} className="rounded-md p-3 font-inter text-xs" style={{ background: 'white', border: '1px solid var(--border)' }}>
                  <p className="mb-1 font-semibold" style={{ color: 'var(--text-dim)' }}>{c.divisa}</p>
                  <p style={{ color: 'var(--text-dim)' }}>Total del plan: <strong style={{ color: 'var(--text-primary)' }}>{c.total != null ? enDivisa(c.total, c.divisa) : '—'}</strong></p>
                  <p style={{ color: 'var(--text-dim)' }}>Abonado: <strong style={{ color: 'var(--text-primary)' }}>{enDivisa(c.abonado, c.divisa)}</strong></p>
                  <p style={{ color: 'var(--text-dim)' }}>
                    Saldo:{' '}
                    <strong style={{ color: c.saldo === 0 ? '#2e7d32' : '#b45309' }}>{c.saldo != null ? (c.saldo === 0 ? 'Pagado' : enDivisa(c.saldo, c.divisa)) : '—'}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Libro */}
          {vigentes.length === 0 ? (
            <p className="mb-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Todavía no hay abonos registrados.</p>
          ) : (
            <div className="mb-3 overflow-x-auto rounded-md" style={{ border: '1px solid var(--border)', background: 'white' }}>
              <table className="w-full min-w-[640px] font-inter text-xs">
                <thead style={{ color: 'var(--text-dim)' }}>
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-right font-semibold">Abono</th>
                    <th className="px-3 py-2 font-semibold">Medio</th>
                    <th className="px-3 py-2 font-semibold">Recibió / registró</th>
                    <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {vigentes.map((a, i) => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <td className="px-3 py-2">{i + 1}{i >= 10 && <span title="Solo los 10 primeros van a GHL y al contrato; el estado de cuenta los muestra todos" style={{ color: 'var(--text-dim)' }}> *</span>}</td>
                      <td className="px-3 py-2">{fechaCorta(a.fecha)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{enDivisa(a.monto, a.divisa)}{a.trm ? <span className="block font-normal" style={{ color: 'var(--text-dim)' }}>TRM {a.trm}</span> : null}</td>
                      <td className="px-3 py-2">{a.medio ?? '—'}{a.referencia ? <span className="block" style={{ color: 'var(--text-dim)' }}>Ref. {a.referencia}</span> : null}</td>
                      <td className="px-3 py-2">
                        {a.registrado_nombre ?? a.registrado_por}
                        <span className="block" style={{ color: 'var(--text-dim)' }}>
                          {a.origen === 'importado' ? 'pago que ya estaba en GHL' : a.registrado_por}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{a.saldoTras != null ? enDivisa(a.saldoTras, a.divisa) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" onClick={() => reenviar(a.id)} title={a.mensaje_enviado_en ? 'Reenviar confirmación' : 'Enviar confirmación por WhatsApp'} className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5" style={{ color: a.mensaje_enviado_en ? '#2e7d32' : 'var(--text-dim)' }}>
                          <MessageCircle size={14} />
                        </button>
                        {(p.esAdmin || a.registrado_por === p.yo) && (
                          <button type="button" onClick={() => anular(a.id)} title="Anular abono" className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5" style={{ color: '#c62828' }}>
                            <Ban size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vigentes.length > 10 && (
            <p className="mb-3 font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
              * GHL y el contrato muestran los 10 primeros abonos; el estado de cuenta del cliente los muestra todos.
            </p>
          )}
          {anulados.length > 0 && (
            <details className="mb-3 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
              <summary className="cursor-pointer">{anulados.length} abono{anulados.length > 1 ? 's' : ''} anulado{anulados.length > 1 ? 's' : ''}</summary>
              <ul className="mt-1 space-y-1 pl-4">
                {anulados.map(a => (
                  <li key={a.id}>
                    <s>{enDivisa(a.monto, a.divisa)} del {fechaCorta(a.fecha)}</s> · anuló {a.anulado_por}: «{a.anulado_motivo}»
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Registrar */}
          {!abierto ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={abrirFormulario} className="flex items-center gap-1.5 rounded-md px-4 py-2 font-inter text-sm font-semibold" style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}>
                <Plus size={15} /> Registrar abono
              </button>
              {vigentes.length > 0 && (
                <>
                  <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-inter text-xs" style={{ color: 'var(--orange)' }}>
                    Ver estado de cuenta del cliente <ExternalLink size={12} />
                  </a>
                  <button type="button" onClick={copiar} className="flex items-center gap-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                    {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Enlace copiado' : 'Copiar enlace'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={registrar} className="rounded-md p-4" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Fecha del abono</span>
                  <input type="date" required value={f.fecha} max={hoy()} onChange={e => setF({ ...f, fecha: e.target.value })} className={inputCls} style={inputStyle} />
                </label>
                <label className="block">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Divisa</span>
                  <select value={f.divisa} onChange={e => setF({ ...f, divisa: e.target.value, totalPlan: totalSugerido(e.target.value as Divisa) })} className={inputCls} style={inputStyle}>
                    {DIVISAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Monto del abono ({f.divisa})</span>
                  <input type="number" step="any" min="0" required value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} className={inputCls} style={inputStyle} placeholder="Solo números" />
                </label>
                <label className="block">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Total del plan en {f.divisa}</span>
                  <input type="number" step="any" min="0" value={f.totalPlan} onChange={e => setF({ ...f, totalPlan: e.target.value })} className={inputCls} style={inputStyle} placeholder="Base del saldo" />
                </label>
                {f.divisa !== 'COP' && (
                  <label className="block">
                    <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>TRM ({UNIDAD_TRM[f.divisa as Divisa]})</span>
                    <input type="number" step="any" min="0" value={f.trm} onChange={e => setF({ ...f, trm: e.target.value })} className={inputCls} style={inputStyle} />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Medio de pago</span>
                  <select value={f.medio} onChange={e => setF({ ...f, medio: e.target.value })} className={inputCls} style={inputStyle}>
                    {MEDIOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Referencia o N.º de comprobante (opcional)</span>
                  <input value={f.referencia} onChange={e => setF({ ...f, referencia: e.target.value })} className={inputCls} style={inputStyle} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Nota interna (opcional, el cliente no la ve)</span>
                  <input value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} className={inputCls} style={inputStyle} />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={f.enviarMensaje} onChange={e => setF({ ...f, enviarMensaje: e.target.checked })} />
                Enviar confirmación al cliente por WhatsApp (con su estado de cuenta)
              </label>
              <p className="mt-2 font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
                Queda registrado a tu nombre ({p.yo}). Solo tú o un administrador pueden anularlo.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="submit" disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 font-inter text-sm font-semibold" style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: guardando ? 0.6 : 1 }}>
                  {guardando && <Loader2 size={14} className="animate-spin" />} Registrar abono
                </button>
                <button type="button" onClick={() => setAbierto(false)} className="rounded-md px-4 py-2 font-inter text-sm" style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {aviso && <p className="mt-3 font-inter text-sm" style={{ color: aviso.ok ? '#2e7d32' : '#dc2626' }}>{aviso.texto}</p>}
        </>
      )}
    </fieldset>
  )
}
