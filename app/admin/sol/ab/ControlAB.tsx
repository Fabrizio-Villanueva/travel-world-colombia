'use client'

import { useActionState } from 'react'
import { guardarAB, type ABState } from './actions'

const inicial: ABState = {}

export function ControlAB({ porcentaje, activa }: { porcentaje: number; activa: boolean }) {
  const [s, action, pending] = useActionState(guardarAB, inicial)
  return (
    <form action={action} className="flex flex-wrap items-end gap-4 rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div>
        <label className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>% de leads NUEVOS que atiende Sol v2</label>
        <input name="porcentaje" type="number" min={0} max={100} defaultValue={porcentaje}
          className="w-28 rounded-md px-3 py-2 font-inter text-sm outline-none"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
      </div>
      <label className="flex items-center gap-2 pb-2 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
        <input type="checkbox" name="activa" defaultChecked={activa} /> Prueba activa
      </label>
      <button type="submit" disabled={pending} className="rounded-md px-4 py-2 font-plus-jakarta text-sm font-bold"
        style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}>
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
      <p className="w-full font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Desmarcar &quot;Prueba activa&quot; es el botón de regreso: TODOS (también los que ya estaban en v2) vuelven a la Sol
        actual desde su próximo mensaje. Las conversaciones que ya venían antes de la prueba siempre siguen con la Sol actual.
      </p>
      {s.error && <p className="w-full font-inter text-xs" style={{ color: '#ef4444' }}>{s.error}</p>}
      {s.ok && <p className="w-full font-inter text-xs" style={{ color: '#16a34a' }}>{s.ok}</p>}
    </form>
  )
}
