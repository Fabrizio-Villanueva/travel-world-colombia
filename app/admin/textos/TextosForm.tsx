'use client'

import { startTransition, useActionState, useState } from 'react'
import { RotateCcw, Check } from 'lucide-react'
import type { DefTexto, PaginaTexto } from '@/lib/textos'
import { MAX_TEXTO } from '@/lib/textos'
import { guardarTextos, type TextosState } from './actions'

const inputCls = 'w-full rounded-md px-3 py-2.5 font-inter text-base outline-none'
const inputStyle = { background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

const PAGINAS: { id: PaginaTexto; nombre: string; nota: string }[] = [
  { id: 'inicio', nombre: 'Página principal', nota: 'Se ven en la portada del sitio.' },
  { id: 'producto', nombre: 'Página de producto (plantilla)', nota: 'Se ven en la página de TODOS los viajes. {nombre} se reemplaza por el nombre del viaje.' },
]

const TIPO: Record<DefTexto['tipo'], string> = { etiqueta: 'Etiqueta', titulo: 'Título', subtitulo: 'Subtítulo' }

/** Formulario de la plantilla global: un campo por texto, con su original a la vista y "Restaurar". */
export function TextosForm({ catalogo, guardados, editable }: {
  catalogo: DefTexto[]
  guardados: Record<string, string>
  editable: boolean
}) {
  const [state, formAction, pending] = useActionState<TextosState, FormData>(guardarTextos, {})
  const [pagina, setPagina] = useState<PaginaTexto>('inicio')
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(catalogo.map(t => [t.clave, guardados[t.clave] ?? t.original]))
  )

  const secciones = new Map<string, DefTexto[]>()
  for (const t of catalogo.filter(t => t.pagina === pagina)) {
    secciones.set(t.seccion, [...(secciones.get(t.seccion) ?? []), t])
  }

  const modificados = catalogo.filter(t => (valores[t.clave] ?? '') !== t.original).length

  return (
    <form
      action={formAction}
      onSubmit={e => {
        e.preventDefault()
        startTransition(() => formAction(new FormData(e.currentTarget)))
      }}
      className="flex flex-col gap-5"
    >
      {/* Todos los textos viajan aunque la pestaña visible sea otra. */}
      {catalogo.map(t => (
        <input key={t.clave} type="hidden" name={t.clave} value={valores[t.clave] ?? ''} readOnly />
      ))}

      <div className="flex flex-wrap gap-2">
        {PAGINAS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPagina(p.id)}
            className="rounded-md px-4 py-2 font-inter text-sm"
            style={{
              background: pagina === p.id ? 'var(--orange)' : 'transparent',
              color: pagina === p.id ? 'var(--orange-contrast)' : 'var(--text-dim)',
              border: '1px solid var(--border)',
            }}
          >
            {p.nombre}
          </button>
        ))}
      </div>
      <p className="-mt-2 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        {PAGINAS.find(p => p.id === pagina)?.nota} Marca con asteriscos (*así*) lo que quieras en color de acento.
      </p>

      {[...secciones.entries()].map(([seccion, campos]) => (
        <section key={seccion} className="rounded-lg p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <p className="mb-4 font-cinzel text-[13px] tracking-[0.2em] uppercase" style={{ color: 'var(--orange)' }}>
            {seccion}
          </p>
          <div className="grid gap-4">
            {campos.map(t => {
              const valor = valores[t.clave] ?? ''
              const cambiado = valor !== t.original
              const multilinea = t.tipo === 'subtitulo' || t.original.includes('\n')
              return (
                <div key={t.clave}>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor={t.clave} className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
                      {TIPO[t.tipo]}
                      {cambiado && (
                        <span className="ml-2 rounded-full px-2 py-0.5 font-inter text-[11px]" style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}>
                          personalizado
                        </span>
                      )}
                    </label>
                    {editable && cambiado && (
                      <button
                        type="button"
                        onClick={() => setValores(v => ({ ...v, [t.clave]: t.original }))}
                        className="flex items-center gap-1 font-inter text-xs"
                        style={{ color: 'var(--text-dim)' }}
                        title={`Volver al original: "${t.original || '(vacío)'}"`}
                      >
                        <RotateCcw size={12} /> Restaurar
                      </button>
                    )}
                  </div>
                  {multilinea ? (
                    <textarea
                      id={t.clave}
                      value={valor}
                      rows={t.tipo === 'subtitulo' ? 2 : 2}
                      maxLength={MAX_TEXTO[t.tipo]}
                      disabled={!editable}
                      onChange={e => setValores(v => ({ ...v, [t.clave]: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      id={t.clave}
                      value={valor}
                      maxLength={MAX_TEXTO[t.tipo]}
                      disabled={!editable}
                      onChange={e => setValores(v => ({ ...v, [t.clave]: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                    />
                  )}
                  <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
                    {cambiado ? `Original: "${t.original || '(vacío)'}"` : t.ayuda ?? ''}
                    {cambiado && t.ayuda ? ` · ${t.ayuda}` : ''}
                    {' '}· {valor.length}/{MAX_TEXTO[t.tipo]}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {state.error && (
        <p role="alert" className="rounded-md p-3 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p role="status" className="flex items-center gap-2 rounded-md p-3 font-inter text-sm" style={{ background: 'rgba(22,163,74,0.12)', color: '#86efac' }}>
          <Check size={15} /> Guardado. {state.cambios ? `${state.cambios} texto${state.cambios !== 1 ? 's' : ''} actualizado${state.cambios !== 1 ? 's' : ''}` : 'Sin cambios'}; la web ya muestra la versión nueva.
        </p>
      )}

      {editable && (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md px-6 py-2.5 font-plus-jakarta text-sm font-bold"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}
          >
            {pending ? 'Guardando…' : 'Guardar textos'}
          </button>
          <span className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
            {modificados} texto{modificados !== 1 ? 's' : ''} distinto{modificados !== 1 ? 's' : ''} del original (ambas páginas)
          </span>
        </div>
      )}
    </form>
  )
}
