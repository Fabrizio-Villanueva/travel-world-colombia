'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Sparkles, Link2, Link2Off, Hand } from 'lucide-react'
import type { Role } from '@/lib/admin/allowlist'
import { guardarVinculoManual, revincularAutomatico } from './actions'

export interface OpcionDestino {
  slug: string
  nombre: string
  activo: boolean
}

export interface AnuncioVista {
  adId: string
  nombre: string
  titulo: string | null
  texto: string | null
  sourceApp: string | null
  mediaType: string | null
  slugs: string[]
  productos: string[]
  vinculo: 'pendiente' | 'auto' | 'manual' | 'ninguno'
  vinculoMotivo: string | null
  leads: number
  primeraVez: string
  ultimaVez: string
}

const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 font-inter text-xs disabled:opacity-40'
const borde = { border: '1px solid var(--border)' } as const

const APP: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'Estados de WhatsApp' }

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** Un anuncio: qué vende, cuántos leads trajo y a qué programas del catálogo está vinculado. */
export function AnuncioFila({ anuncio: a, destinos, rol }: { anuncio: AnuncioVista; destinos: OpcionDestino[]; rol: Role }) {
  const [editando, setEditando] = useState(false)
  const [verTexto, setVerTexto] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(a.slugs))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const editable = rol === 'admin' || rol === 'editor'

  const correr = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn()
      setError(r.error ?? null)
      if (!r.error) setEditando(false)
    })

  const alternar = (slug: string) =>
    setSeleccion(prev => {
      const s = new Set(prev)
      if (s.has(slug)) s.delete(slug)
      else s.add(slug)
      return s
    })

  const estado = {
    pendiente: { texto: 'Pendiente de vincular', Icon: Sparkles, color: 'var(--text-dim)' },
    auto: { texto: 'Vinculado automáticamente', Icon: Link2, color: '#16a34a' },
    manual: { texto: 'Vinculado a mano', Icon: Hand, color: 'var(--orange)' },
    ninguno: { texto: 'Sin producto en el catálogo', Icon: Link2Off, color: '#f59e0b' },
  }[a.vinculo]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.nombre}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            {a.sourceApp && <span>{APP[a.sourceApp.toLowerCase()] ?? a.sourceApp}</span>}
            {a.mediaType && <span>{a.mediaType === 'VIDEO' ? 'Video' : a.mediaType === 'IMAGE' ? 'Imagen' : a.mediaType}</span>}
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>{a.leads}</strong> lead{a.leads !== 1 ? 's' : ''}
            </span>
            <span>
              {fecha(a.primeraVez)} → {fecha(a.ultimaVez)}
            </span>
            <span title="Id del anuncio en Meta">id {a.adId}</span>
          </p>
        </div>

        {editable && !editando && (
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={pending} onClick={() => { setSeleccion(new Set(a.slugs)); setEditando(true) }} className={btn} style={{ ...borde, color: 'var(--text-dim)' }}>
              <Pencil size={13} /> Corregir vínculo
            </button>
            {a.vinculo === 'manual' && (
              <button type="button" disabled={pending} onClick={() => correr(() => revincularAutomatico(a.adId, a.nombre))} className={btn} style={{ ...borde, color: 'var(--text-dim)' }} title="Deja que el sistema vuelva a decidir el vínculo">
                <Sparkles size={13} /> Volver a automático
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-inter text-[11px]" style={{ background: 'color-mix(in srgb, currentColor 12%, transparent)', color: estado.color }}>
          <estado.Icon size={11} aria-hidden /> {estado.texto}
        </span>
        {!editando && a.productos.map(p => (
          <span key={p} className="rounded-full px-2 py-0.5 font-inter text-[11px]" style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}>
            {p}
          </span>
        ))}
        {!editando && a.vinculoMotivo && (
          <span className="font-inter text-[11px]" style={{ color: 'var(--text-muted)' }} title={a.vinculoMotivo}>
            · {a.vinculoMotivo.length > 90 ? `${a.vinculoMotivo.slice(0, 87)}…` : a.vinculoMotivo}
          </span>
        )}
      </div>

      {editando && (
        <div className="mt-3 rounded-md p-3" style={{ background: 'var(--bg-alt)', ...borde }}>
          <p className="mb-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            Marca los programas del catálogo que promociona este anuncio (ninguno si el producto aún no está publicado).
          </p>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {destinos.map(d => (
              <label key={d.slug} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 font-inter text-xs" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={seleccion.has(d.slug)} onChange={() => alternar(d.slug)} />
                <span className="truncate">{d.nombre}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <button type="button" disabled={pending} onClick={() => correr(() => guardarVinculoManual(a.adId, a.nombre, [...seleccion]))} className={btn} style={{ ...borde, color: '#16a34a' }}>
              <Check size={13} /> Guardar
            </button>
            <button type="button" disabled={pending} onClick={() => { setEditando(false); setError(null) }} className={btn} style={{ ...borde, color: 'var(--text-dim)' }}>
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {a.texto && (
        <div className="mt-3">
          <button type="button" onClick={() => setVerTexto(v => !v)} className="font-inter text-xs underline-offset-2 hover:underline" style={{ color: 'var(--text-dim)' }}>
            {verTexto ? 'Ocultar el texto del anuncio' : 'Ver el texto del anuncio'}
          </button>
          {verTexto && (
            <p className="mt-2 whitespace-pre-wrap rounded-md p-3 font-inter text-xs" style={{ background: 'var(--bg-alt)', color: 'var(--text-dim)', ...borde }}>
              {a.texto}
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-2 font-inter text-xs" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
