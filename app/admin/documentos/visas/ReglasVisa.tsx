'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import type { ReglaVisa } from '@/lib/documentos/visas'
import { eliminarReglaVisa, guardarReglaVisa } from './actions'

const input: React.CSSProperties = { border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'white' }

/** Tabla editable: país · ¿requiere visa? · nota. Una fila = un formulario. */
export function ReglasVisa({ reglas, editable }: { reglas: ReglaVisa[]; editable: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {editable && <Fila key="nueva" nueva editable />}
      {reglas.map(r => (
        <Fila key={r.pais} regla={r} editable={editable} />
      ))}
    </div>
  )
}

function Fila({ regla, nueva, editable }: { regla?: ReglaVisa; nueva?: boolean; editable: boolean }) {
  const router = useRouter()
  const [pais, setPais] = useState(regla?.pais ?? '')
  const [requiere, setRequiere] = useState(regla?.requiere_visa ?? false)
  const [nota, setNota] = useState(regla?.nota ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiado =
    nueva || pais !== regla?.pais || requiere !== regla?.requiere_visa || (nota || '') !== (regla?.nota || '')

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    const r = await guardarReglaVisa(pais, requiere, nota, regla?.pais)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    if (nueva) {
      setPais('')
      setRequiere(false)
      setNota('')
    }
    router.refresh()
  }

  async function eliminar() {
    if (!regla || !confirm(`¿Eliminar la regla de ${regla.pais}?`)) return
    setOcupado(true)
    const r = await eliminarReglaVisa(regla.pais)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    router.refresh()
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-wrap items-center gap-2 rounded-lg p-3"
      style={{ background: nueva ? 'var(--bg-alt)' : 'var(--card-bg)', border: `1px ${nueva ? 'dashed' : 'solid'} var(--border)` }}
    >
      <input
        value={pais}
        onChange={e => setPais(e.target.value)}
        placeholder={nueva ? 'País nuevo (ej. Marruecos)' : ''}
        disabled={!editable}
        className="w-44 rounded-md px-3 py-1.5 font-inter text-sm"
        style={input}
      />
      <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={requiere} onChange={e => setRequiere(e.target.checked)} disabled={!editable} />
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: requiere ? '#991b1b' : '#15803d', background: requiere ? '#fee2e2' : '#dcfce7' }}>
          {requiere ? 'Requiere visa' : 'Sin visa'}
        </span>
      </label>
      <input
        value={nota}
        onChange={e => setNota(e.target.value)}
        placeholder="Nota / excepciones (opcional)"
        disabled={!editable}
        className="min-w-[200px] flex-1 rounded-md px-3 py-1.5 font-inter text-sm"
        style={input}
      />
      {editable && (
        <>
          <button
            type="submit"
            disabled={ocupado || !cambiado || !pais.trim()}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 font-inter text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
          >
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : nueva ? <Plus size={13} /> : <Check size={13} />}
            {nueva ? 'Agregar' : 'Guardar'}
          </button>
          {!nueva && (
            <button
              type="button"
              onClick={eliminar}
              disabled={ocupado}
              aria-label="Eliminar"
              className="flex items-center rounded-md px-2 py-1.5 disabled:opacity-40"
              style={{ border: '1px solid var(--border)', color: '#b91c1c' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </>
      )}
      {error && (
        <span className="w-full font-inter text-xs" style={{ color: '#b91c1c' }}>
          {error}
        </span>
      )}
      {regla?.actualizado_por && (
        <span className="w-full font-inter text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Actualizada por {regla.actualizado_por}
        </span>
      )}
    </form>
  )
}
