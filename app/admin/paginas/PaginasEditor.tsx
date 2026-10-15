'use client'

import { useActionState, useState } from 'react'
import { Check, Eye, ExternalLink, PencilLine } from 'lucide-react'
import type { ColumnaInfo, PaginaInfoDef, PaginaInfoGuardada } from '@/lib/paginas-info'
import { TextoFormateado } from '@/components/legal/TextoFormateado'
import { guardarPagina, type PaginaState } from './actions'

type Guardada = PaginaInfoGuardada & { actualizado_por: string | null }

const inputCls = 'w-full rounded-md px-3 py-2.5 font-inter text-sm outline-none'
const inputStyle = { background: 'white', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
const caja = { background: 'var(--card-bg)', border: '1px solid var(--border)' } as const

function estado(def: PaginaInfoDef, g?: Guardada): { texto: string; fondo: string; color: string } {
  if (g?.publicada && g.contenido.trim()) return { texto: 'Publicada', fondo: '#E7F5EA', color: '#2e7d32' }
  if (g?.contenido.trim()) return { texto: 'Borrador', fondo: '#FFF7DC', color: '#8a6a00' }
  if (def.ruta) return { texto: `Enlaza a ${def.ruta}`, fondo: '#EDF3FC', color: '#2957A4' }
  return { texto: 'Sin texto · no se ve', fondo: 'rgba(13,30,60,0.06)', color: 'var(--text-dim)' }
}

export function PaginasEditor({ columnas, paginas, guardadas, editable }: {
  columnas: { id: ColumnaInfo; titulo: string }[]
  paginas: PaginaInfoDef[]
  guardadas: Record<string, Guardada>
  editable: boolean
}) {
  const [slug, setSlug] = useState(paginas[0].slug)
  const def = paginas.find(p => p.slug === slug)!

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Lista de páginas por columna del pie */}
      <nav className="flex flex-col gap-5">
        {columnas.map(col => (
          <div key={col.id}>
            <p className="mb-2 font-inter text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              {col.titulo}
            </p>
            <ul className="flex flex-col gap-1">
              {paginas.filter(p => p.columna === col.id).map(p => {
                const e = estado(p, guardadas[p.slug])
                const activa = p.slug === slug
                return (
                  <li key={p.slug}>
                    <button
                      type="button"
                      onClick={() => setSlug(p.slug)}
                      className="w-full rounded-md px-3 py-2 text-left font-inter text-sm transition-colors"
                      style={{
                        background: activa ? 'white' : 'transparent',
                        border: `1px solid ${activa ? 'var(--orange)' : 'transparent'}`,
                        color: 'var(--text-primary)',
                        fontWeight: activa ? 600 : 400,
                      }}
                    >
                      <span className="block">{p.titulo}</span>
                      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: e.fondo, color: e.color }}>
                        {e.texto}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* key: al cambiar de página el formulario arranca con lo guardado de esa página. */}
      <FormPagina key={slug} def={def} guardada={guardadas[slug]} editable={editable} />
    </div>
  )
}

function FormPagina({ def, guardada, editable }: { def: PaginaInfoDef; guardada?: Guardada; editable: boolean }) {
  const [state, formAction, pending] = useActionState<PaginaState, FormData>(guardarPagina, {})
  const [intro, setIntro] = useState(guardada?.intro ?? '')
  const [contenido, setContenido] = useState(guardada?.contenido ?? '')
  const [publicada, setPublicada] = useState(guardada?.publicada ?? false)
  const [vista, setVista] = useState(false)

  return (
    <form action={formAction} className="rounded-xl p-5" style={caja}>
      <input type="hidden" name="slug" value={def.slug} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-plus-jakarta text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{def.titulo}</h2>
          <p className="mt-0.5 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            Dirección en la web: /info/{def.slug}
            {def.ruta && <> · mientras no la publiques, el pie de página enlaza a la página actual <a href={def.ruta} target="_blank" rel="noreferrer" className="underline">{def.ruta}</a></>}
            {guardada?.actualizado_por && <> · último cambio: {guardada.actualizado_por}</>}
          </p>
        </div>
        {guardada?.publicada && guardada.contenido.trim() && (
          <a href={`/info/${def.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-inter text-xs" style={{ color: 'var(--orange)' }}>
            Ver en la web <ExternalLink size={13} />
          </a>
        )}
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
          Introducción (opcional, va debajo del título)
        </span>
        <textarea name="intro" rows={2} value={intro} onChange={e => setIntro(e.target.value)} disabled={!editable} className={inputCls} style={inputStyle} maxLength={400} />
      </label>

      <div className="mb-2 flex items-center justify-between">
        <span className="font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>Texto de la página</span>
        <div className="flex gap-1">
          {[
            { v: false, t: 'Escribir', I: PencilLine },
            { v: true, t: 'Vista previa', I: Eye },
          ].map(({ v, t, I }) => (
            <button
              key={t}
              type="button"
              onClick={() => setVista(v)}
              className="flex items-center gap-1 rounded-full px-3 py-1 font-inter text-xs"
              style={{ border: '1px solid var(--border)', background: vista === v ? 'var(--navy, #0D1E3C)' : 'white', color: vista === v ? 'white' : 'var(--text-dim)' }}
            >
              <I size={12} /> {t}
            </button>
          ))}
        </div>
      </div>

      {/* El textarea sigue en el formulario aunque se vea la vista previa. */}
      <textarea
        name="contenido"
        rows={18}
        value={contenido}
        onChange={e => setContenido(e.target.value)}
        disabled={!editable}
        className={`${inputCls} font-mono text-[13px] leading-relaxed ${vista ? 'hidden' : ''}`}
        style={inputStyle}
        placeholder={'## Subtítulo\nEscribe aquí el párrafo. Deja una línea en blanco entre párrafos.\n\n- Punto de una lista\n- Otro punto\n\nUsa **negrita** para resaltar. Los correos y enlaces (https://…) se vuelven clic.'}
      />
      {vista && (
        <div className="tema-claro max-h-[560px] overflow-y-auto rounded-md p-5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          {contenido.trim() ? <TextoFormateado texto={contenido} /> : <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>Todavía no hay texto.</p>}
        </div>
      )}
      <p className="mt-2 font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
        Formato: <code>## Subtítulo</code> · línea en blanco = párrafo nuevo · <code>- </code> al inicio = lista · <code>**negrita**</code> · correos y enlaces se vuelven clic.
        {' '}Puedes pegar el texto desde Word.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" name="publicada" checked={publicada} onChange={e => setPublicada(e.target.checked)} disabled={!editable} />
          Publicada (se ve en la web y en el pie de página)
        </label>
        {editable && (
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-md px-5 py-2.5 font-inter text-sm font-semibold"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </div>
      {state.error && <p className="mt-3 font-inter text-sm" style={{ color: '#dc2626' }}>{state.error}</p>}
      {state.ok && (
        <p className="mt-3 flex items-center gap-1 font-inter text-sm" style={{ color: '#2e7d32' }}>
          <Check size={15} /> {state.publicada ? 'Guardado y publicado. Ya se ve en la web.' : 'Guardado como borrador (no se ve en la web).'}
        </p>
      )}
    </form>
  )
}
