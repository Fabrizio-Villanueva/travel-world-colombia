'use client'

import { useActionState, useTransition } from 'react'
import {
  guardarPolitica, guardarRango, eliminarRango, guardarPromocion, eliminarPromocion, type SolState,
} from './actions'
import type { PoliticaReserva, RangoPrecio, Promocion } from '@/lib/agente/reglas'

const input = 'w-full rounded-md px-3 py-2 font-inter text-sm outline-none'
const inputStyle = { background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
const label = 'mb-1 block font-inter text-xs'
const labelStyle = { color: 'var(--text-dim)' } as const
const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const
const inicial: SolState = {}

export interface OpcionViaje { slug: string; nombre: string }

function Mensaje({ s }: { s: SolState }) {
  if (s.error) return <p className="font-inter text-xs" style={{ color: '#ef4444' }}>{s.error}</p>
  if (s.ok) return <p className="font-inter text-xs" style={{ color: '#16a34a' }}>{s.ok}</p>
  return null
}

function Boton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="rounded-md px-4 py-2 font-plus-jakarta text-sm font-bold"
      style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}>
      {pending ? 'Guardando…' : children}
    </button>
  )
}

function SelectViaje({ opciones, valor }: { opciones: OpcionViaje[]; valor?: string | null }) {
  return (
    <select name="slug" defaultValue={valor ?? ''} className={input} style={inputStyle}>
      <option value="">— Sin programa del catálogo</option>
      {opciones.map(o => <option key={o.slug} value={o.slug}>{o.nombre}</option>)}
    </select>
  )
}

export function PoliticaForm({ p }: { p: PoliticaReserva }) {
  const [s, action, pending] = useActionState(guardarPolitica, inicial)
  return (
    <form action={action} className="rounded-xl p-5" style={caja}>
      <div className="grid gap-4 md:grid-cols-3">
        <div><label className={label} style={labelStyle}>Anticipo para apartar (%)</label>
          <input name="anticipo_pct" type="number" step="0.5" min="1" max="100" defaultValue={Number(p.anticipo_pct)} className={input} style={inputStyle} /></div>
        <div><label className={label} style={labelStyle}>Saldo: días antes del viaje</label>
          <input name="saldo_dias_antes" type="number" min="0" defaultValue={p.saldo_dias_antes} className={input} style={inputStyle} /></div>
        <div><label className={label} style={labelStyle}>Pago total si el viaje es en menos de (días)</label>
          <input name="pago_total_si_faltan_dias" type="number" min="0" defaultValue={p.pago_total_si_faltan_dias} className={input} style={inputStyle} /></div>
      </div>
      <div className="mt-4"><label className={label} style={labelStyle}>Medios de pago (Sol los explica así)</label>
        <textarea name="medios_pago" rows={2} defaultValue={p.medios_pago ?? ''} className={input} style={inputStyle} /></div>
      <div className="mt-4"><label className={label} style={labelStyle}>Notas para Sol</label>
        <textarea name="notas" rows={2} defaultValue={p.notas ?? ''} className={input} style={inputStyle} /></div>
      <div className="mt-4 flex items-center gap-4"><Boton pending={pending}>Guardar política</Boton><Mensaje s={s} /></div>
    </form>
  )
}

export function RangoForm({ r, opciones }: { r?: RangoPrecio & { viejo?: boolean }; opciones: OpcionViaje[] }) {
  const [s, action, pending] = useActionState(guardarRango, inicial)
  const [borrando, startBorrar] = useTransition()
  const viejo = r?.viejo
  return (
    <form action={action} className="rounded-lg p-4" style={{ ...caja, opacity: r && !r.activo ? 0.6 : 1 }}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2"><label className={label} style={labelStyle}>Destino</label>
          <input name="destino" required defaultValue={r?.destino} className={input} style={inputStyle} /></div>
        <div className="md:col-span-2"><label className={label} style={labelStyle}>Programa del catálogo</label>
          <SelectViaje opciones={opciones} valor={r?.slug} /></div>
        <div><label className={label} style={labelStyle}>Noches</label>
          <input name="noches" defaultValue={r?.noches ?? ''} placeholder="3-4 noches" className={input} style={inputStyle} /></div>
        <div><label className={label} style={labelStyle}>Temporada</label>
          <select name="temporada" defaultValue={r?.temporada ?? 'baja'} className={input} style={inputStyle}>
            <option value="baja">Baja / media</option><option value="alta">Alta</option><option value="todo_el_ano">Todo el año</option>
          </select></div>
        <div><label className={label} style={labelStyle}>Desde (por persona)</label>
          <input name="desde" required inputMode="numeric" defaultValue={r?.desde} className={input} style={inputStyle} /></div>
        <div><label className={label} style={labelStyle}>Hasta (por persona)</label>
          <input name="hasta" required inputMode="numeric" defaultValue={r?.hasta} className={input} style={inputStyle} /></div>
        <div><label className={label} style={labelStyle}>Moneda</label>
          <select name="moneda" defaultValue={r?.moneda ?? 'COP'} className={input} style={inputStyle}>
            <option value="COP">COP</option><option value="USD">USD</option>
          </select></div>
        <div className="md:col-span-3"><label className={label} style={labelStyle}>Qué incluye</label>
          <input name="incluye" defaultValue={r?.incluye ?? ''} placeholder="Vuelo + hotel todo incluido + traslados" className={input} style={inputStyle} /></div>
        <div className="md:col-span-3"><label className={label} style={labelStyle}>Notas</label>
          <input name="notas" defaultValue={r?.notas ?? ''} className={input} style={inputStyle} /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 font-inter text-xs" style={labelStyle}>
          <input type="checkbox" name="activo" defaultChecked={r ? r.activo : true} /> Sol lo usa
        </label>
        <Boton pending={pending}>{r ? 'Guardar (marca revisado hoy)' : 'Agregar rango'}</Boton>
        {r && (
          <button type="button" disabled={borrando} className="font-inter text-xs underline" style={{ color: '#ef4444' }}
            onClick={() => { if (confirm(`¿Eliminar el rango de ${r.destino}?`)) startBorrar(async () => { await eliminarRango(r.id) }) }}>
            Eliminar
          </button>
        )}
        {r && (
          <span className="font-inter text-xs" style={{ color: viejo ? '#dc2626' : 'var(--text-muted)' }}>
            Revisado el {new Date(r.revisado_en).toLocaleDateString('es-CO')}{viejo ? ' · más de 6 meses: revísalo' : ''}
          </span>
        )}
        <Mensaje s={s} />
      </div>
    </form>
  )
}

export function PromocionForm({ p, opciones }: { p?: Promocion; opciones: OpcionViaje[] }) {
  const [s, action, pending] = useActionState(guardarPromocion, inicial)
  const [borrando, startBorrar] = useTransition()
  return (
    <form action={action} className="rounded-lg p-4" style={caja}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2"><label className={label} style={labelStyle}>Título</label>
          <input name="titulo" required defaultValue={p?.titulo} className={input} style={inputStyle} /></div>
        <div className="md:col-span-2"><label className={label} style={labelStyle}>Programa del catálogo</label>
          <SelectViaje opciones={opciones} valor={p?.slug} /></div>
        <div><label className={label} style={labelStyle}>Válida hasta</label>
          <input name="valida_hasta" type="date" required defaultValue={p?.valida_hasta} className={input} style={inputStyle} /></div>
        <div><label className={label} style={labelStyle}>Cupos (opcional)</label>
          <input name="cupos" type="number" min="0" defaultValue={p?.cupos ?? ''} className={input} style={inputStyle} /></div>
        <div className="md:col-span-6"><label className={label} style={labelStyle}>Detalle (lo que Sol puede decir)</label>
          <textarea name="detalle" required rows={2} defaultValue={p?.detalle} className={input} style={inputStyle} /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 font-inter text-xs" style={labelStyle}>
          <input type="checkbox" name="activa" defaultChecked={p ? p.activa : true} /> Activa
        </label>
        <Boton pending={pending}>{p ? 'Guardar' : 'Agregar promoción'}</Boton>
        {p && (
          <button type="button" disabled={borrando} className="font-inter text-xs underline" style={{ color: '#ef4444' }}
            onClick={() => { if (confirm(`¿Eliminar "${p.titulo}"?`)) startBorrar(async () => { await eliminarPromocion(p.id) }) }}>
            Eliminar
          </button>
        )}
        <Mensaje s={s} />
      </div>
    </form>
  )
}
