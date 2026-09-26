'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CategoriaArbol } from '@/types/destino'

/**
 * Casillas de categorías del viaje, agrupadas por categoría principal.
 * Marcar una subcategoría marca su principal; desmarcar la principal desmarca
 * sus subcategorías. Viaja al servidor como varios `categorias` en el FormData.
 */
export function CategoriasSelector({ arbol, iniciales }: { arbol: CategoriaArbol[]; iniciales: string[] }) {
  const [sel, setSel] = useState(() => new Set(iniciales))

  const alternar = (id: string, madre?: CategoriaArbol) =>
    setSel(prev => {
      const s = new Set(prev)
      if (s.has(id)) {
        s.delete(id)
        // Desmarcar una principal limpia sus subcategorías.
        arbol.find(c => c.id === id)?.hijas.forEach(h => s.delete(h.id))
      } else {
        s.add(id)
        if (madre) s.add(madre.id)
      }
      return s
    })

  if (arbol.length === 0) {
    return (
      <p className="font-inter text-sm sm:col-span-2" style={{ color: 'var(--text-dim)' }}>
        Aún no hay categorías.{' '}
        <Link href="/admin/categorias" className="underline" style={{ color: 'var(--orange)' }}>
          Créalas aquí
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {[...sel].map(id => (
        <input key={id} type="hidden" name="categorias" value={id} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {arbol.map(c => (
          <fieldset key={c.id} className="rounded-md p-3" style={{ border: '1px solid var(--border)' }}>
            <legend className="sr-only">{c.nombre}</legend>
            <label className="flex items-center gap-2 font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)} />
              {c.nombre}
            </label>
            {c.hijas.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5 pl-6">
                {c.hijas.map(h => (
                  <label key={h.id} className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
                    <input type="checkbox" checked={sel.has(h.id)} onChange={() => alternar(h.id, c)} />
                    {h.nombre}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
      </div>
      <p className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Con la categoría <strong>{arbol.find(c => c.clave === 'cruceros')?.nombre ?? 'Cruceros'}</strong> el viaje sale en la página
        /cruceros (y no en /destinos). Crea, renombra o borra categorías en{' '}
        <Link href="/admin/categorias" className="underline" style={{ color: 'var(--orange)' }}>Categorías</Link>.
      </p>
    </div>
  )
}
