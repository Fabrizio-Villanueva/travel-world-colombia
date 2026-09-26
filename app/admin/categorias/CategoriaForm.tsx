'use client'

import { useActionState, useEffect, useRef } from 'react'
import { crearCategoria, type CategoriaState } from './actions'

const initial: CategoriaState = {}
const input = 'rounded-md px-3 py-2 font-inter text-sm outline-none'
const inputStyle = { background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

/** Alta de categoría principal o subcategoría ("Dentro de"). */
export function CategoriaForm({ principales }: { principales: { id: string; nombre: string }[] }) {
  const [state, action, pending] = useActionState(crearCategoria, initial)
  const formRef = useRef<HTMLFormElement>(null)

  // Limpia el nombre tras crear, pero conserva "Dentro de" para cargar varias
  // subcategorías seguidas.
  useEffect(() => {
    if (state.ok) {
      const campo = formRef.current?.elements.namedItem('nombre') as HTMLInputElement | null
      if (campo) {
        campo.value = ''
        campo.focus()
      }
    }
  }, [state])

  return (
    <form
      ref={formRef}
      action={action}
      className="mb-8 rounded-xl p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
    >
      <h2 className="mb-4 font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        Nueva categoría
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Nombre</span>
          <input name="nombre" required maxLength={40} placeholder="Ej. Todo incluido, Sin visa…" className={input} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1.5 sm:w-64">
          <span className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>Dentro de</span>
          <select name="parent_id" defaultValue="" className={input} style={inputStyle}>
            <option value="" style={{ background: 'var(--bg-alt)' }}>— Es una categoría principal</option>
            {principales.map(p => (
              <option key={p.id} value={p.id} style={{ background: 'var(--bg-alt)' }}>
                Subcategoría de {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-4 py-2 font-plus-jakarta text-sm font-bold"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? 'Guardando…' : 'Agregar'}
        </button>
      </div>
      {state.error && <p role="alert" className="mt-3 font-inter text-xs" style={{ color: '#ef4444' }}>{state.error}</p>}
      {state.ok && <p role="status" className="mt-3 font-inter text-xs" style={{ color: '#86efac' }}>Categoría creada.</p>}
    </form>
  )
}
