'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enviarChat, votar } from '../actions'
import type { TurnoLab } from '@/lib/agente/v2/laboratorio'

const ESTADO: Record<string, string> = {
  explorando: '🔎 Explorando',
  falta_informacion: '🧩 Falta información',
  objecion: '🤔 Objeción',
  consultando_decisor: '👥 Consultando con quien decide',
  listo_para_reservar: '🔥 Listo para reservar',
  nutrir: '🌱 Nutrir (más adelante)',
  no_interesado: '✋ No interesado',
}

const verde = '#dcfce7'

export function TurnoSol({ corridaId, indice, turno, voto }: {
  corridaId: string
  indice: number
  turno: TurnoLab
  voto: { voto: number; comentario: string | null } | null
}) {
  const d = turno.decision
  const v = d?.venta
  const [comentario, setComentario] = useState(voto?.comentario ?? '')
  const [pending, start] = useTransition()
  const [guardado, setGuardado] = useState<number | null>(voto?.voto ?? null)
  const router = useRouter()

  const enviar = (valor: 1 | -1) => start(async () => {
    const r = await votar(corridaId, indice, valor, comentario)
    if (!r.error) { setGuardado(valor); router.refresh() }
  })

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-4 py-2 font-inter text-sm"
        style={{ background: verde, color: '#14532d' }}>
        {turno.texto}
      </div>
      {turno.tarjetas?.map((t, k) => (
        <div key={k} className="w-72 overflow-hidden rounded-xl" style={{ background: '#fff', border: '1px solid var(--border)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t.imagen && <img src={t.imagen} alt="" className="h-36 w-full object-cover" />}
          <div className="px-3 py-2">
            <p className="font-inter text-sm font-semibold" style={{ color: '#111' }}>{t.titulo}</p>
            {t.texto && <p className="font-inter text-xs" style={{ color: '#444' }}>{t.texto}</p>}
          </div>
          <a href={t.enlace} target="_blank" rel="noreferrer" className="block border-t py-2 text-center font-inter text-sm font-semibold" style={{ color: '#16a34a' }}>
            {t.boton === 'Llamar' ? '📞' : '↗'} {t.boton}
          </a>
        </div>
      ))}

      {d && (
        <details className="w-full max-w-[80%] rounded-lg p-3 font-inter text-xs" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          <summary className="cursor-pointer" style={{ color: 'var(--text-primary)' }}>
            Qué pensó Sol: <b>{v ? ESTADO[v.estado] ?? v.estado : '—'}</b> · {d.accion} · {d.temperatura}
            {v?.senal_compra ? ' · 🛒 señal de compra' : ''}
            {turno.costoUsd != null ? ` · US$${turno.costoUsd.toFixed(4)}` : ''}
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            <p><b>Motivo:</b> {d.motivo}</p>
            {v?.senal_compra && <p><b>Señal de compra:</b> {v.senal_compra}</p>}
            {v && <p><b>Compromiso:</b> {v.compromiso} · <b>Objeción:</b> {v.objecion} · <b>Cierre preferido:</b> {v.canal_cierre}</p>}
            {v?.quien_decide && <p><b>Quién decide:</b> {v.quien_decide}</p>}
            {v?.rango_dado && <p><b>Rango que dio:</b> {v.rango_dado}</p>}
            {v?.motivo_viaje && <p><b>Motivo del viaje:</b> {v.motivo_viaje}</p>}
            <p><b>Datos:</b> {Object.entries(d.datos).map(([k, x]) => `${k}: ${x}`).join(' · ') || '—'}</p>
            {d.seguimiento && <p><b>Seguimiento:</b> {d.seguimiento.proximo_contacto} — {d.seguimiento.angulo}</p>}
            {d.resumen && <p><b>Resumen para la asesora:</b> {d.resumen}</p>}
            {d.borrador && (
              <details>
                <summary className="cursor-pointer"><b>Borrador de cotización</b> (va al CRM, el cliente no lo ve)</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded p-2" style={{ background: 'var(--bg-alt)' }}>{d.borrador}</pre>
              </details>
            )}
          </div>
        </details>
      )}

      <div className="flex w-full max-w-[80%] items-center gap-2">
        <input value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Comentario (qué cambiarías)…"
          className="min-w-0 flex-1 rounded-md px-2 py-1 font-inter text-xs outline-none"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <button disabled={pending} onClick={() => enviar(1)} className="rounded px-2 py-1 text-sm"
          style={{ background: guardado === 1 ? '#bbf7d0' : 'transparent', border: '1px solid var(--border)' }}>👍</button>
        <button disabled={pending} onClick={() => enviar(-1)} className="rounded px-2 py-1 text-sm"
          style={{ background: guardado === -1 ? '#fecaca' : 'transparent', border: '1px solid var(--border)' }}>👎</button>
      </div>
    </div>
  )
}

export function ChatEntrada({ corridaId }: { corridaId: string }) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  const router = useRouter()
  const mandar = () => start(async () => {
    setError(undefined)
    const r = await enviarChat(corridaId, texto)
    if (r.error) setError(r.error)
    else { setTexto(''); router.refresh() }
  })
  return (
    <div className="sticky bottom-4 mt-8 rounded-xl p-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div className="flex gap-2">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Escribe como cliente…"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!pending && texto.trim()) mandar() } }}
          className="min-w-0 flex-1 rounded-md px-3 py-2 font-inter text-sm outline-none"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <button disabled={pending || !texto.trim()} onClick={mandar} className="rounded-md px-4 font-plus-jakarta text-sm font-bold"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Sol escribe…' : 'Enviar'}
        </button>
      </div>
      {error && <p className="mt-2 font-inter text-xs" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
