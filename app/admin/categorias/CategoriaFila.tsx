'use client'

import { useState, useTransition } from 'react'
import { ArrowUp, ArrowDown, Pencil, Trash2, Lock, Check, X } from 'lucide-react'
import type { Categoria } from '@/types/destino'
import type { Role } from '@/lib/admin/allowlist'
import { renombrarCategoria, moverCategoria, eliminarCategoria } from './actions'

const btn = 'flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-40'
const borde = { border: '1px solid var(--border)' } as const

/** Fila de una categoría: renombrar en línea, reordenar y eliminar. */
export function CategoriaFila({
  categoria: c, viajes, subcategorias = 0, primera, ultima, rol,
}: {
  categoria: Categoria
  viajes: number
  subcategorias?: number
  primera: boolean
  ultima: boolean
  rol: Role
}) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(c.nombre)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const editable = rol === 'admin' || rol === 'editor'
  const sistema = Boolean(c.clave)

  const correr = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn()
      setError(r.error ?? null)
      if (!r.error) setEditando(false)
    })

  const guardar = () => {
    if (nombre.trim() === c.nombre) return setEditando(false)
    correr(() => renombrarCategoria(c.id, nombre))
  }

  const eliminar = () => {
    const partes = [
      subcategorias > 0 ? `también se borrarán sus ${subcategorias} subcategorías` : null,
      viajes > 0 ? `se quitará de ${viajes} viaje${viajes !== 1 ? 's' : ''} (los viajes no se borran)` : null,
    ].filter(Boolean)
    const detalle = partes.length ? `\n\nAl eliminarla ${partes.join(' y ')}.` : ''
    if (confirm(`¿Eliminar la categoría "${c.nombre}"?${detalle}`)) correr(() => eliminarCategoria(c.id, c.nombre))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editando ? (
            <input
              autoFocus
              value={nombre}
              maxLength={40}
              aria-label={`Nuevo nombre para ${c.nombre}`}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); guardar() }
                if (e.key === 'Escape') { setNombre(c.nombre); setEditando(false) }
              }}
              className="min-w-0 flex-1 rounded-md px-3 py-1.5 font-inter text-sm outline-none"
              style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          ) : (
            <span
              className={`truncate font-inter text-sm ${c.parent_id ? '' : 'font-bold'}`}
              style={{ color: 'var(--text-primary)' }}
            >
              {c.nombre}
            </span>
          )}
          {sistema && !editando && (
            <span
              title="Categoría del sistema: decide qué viajes salen en /cruceros. Se puede renombrar pero no eliminar."
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-inter text-[11px]"
              style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
            >
              <Lock size={11} aria-hidden /> Página /cruceros
            </span>
          )}
          <span className="shrink-0 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            {viajes} viaje{viajes !== 1 ? 's' : ''}
          </span>
        </div>

        {editable && (
          <div className="flex items-center gap-1.5">
            {editando ? (
              <>
                <button type="button" title="Guardar" aria-label="Guardar nombre" disabled={pending} onClick={guardar} className={btn} style={{ ...borde, color: '#16a34a' }}>
                  <Check size={15} />
                </button>
                <button type="button" title="Cancelar" aria-label="Cancelar" disabled={pending} onClick={() => { setNombre(c.nombre); setEditando(false); setError(null) }} className={btn} style={{ ...borde, color: 'var(--text-dim)' }}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <button type="button" title="Subir" aria-label={`Subir ${c.nombre}`} disabled={pending || primera} onClick={() => correr(() => moverCategoria(c.id, 'arriba'))} className={btn} style={{ ...borde, color: 'var(--text-dim)' }}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" title="Bajar" aria-label={`Bajar ${c.nombre}`} disabled={pending || ultima} onClick={() => correr(() => moverCategoria(c.id, 'abajo'))} className={btn} style={{ ...borde, color: 'var(--text-dim)' }}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" title="Renombrar" aria-label={`Renombrar ${c.nombre}`} disabled={pending} onClick={() => setEditando(true)} className={btn} style={{ ...borde, color: 'var(--text-dim)' }}>
                  <Pencil size={15} />
                </button>
                {rol === 'admin' && !sistema && (
                  <button type="button" title="Eliminar" aria-label={`Eliminar ${c.nombre}`} disabled={pending} onClick={eliminar} className={btn} style={{ ...borde, color: '#ef4444' }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 font-inter text-xs" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
