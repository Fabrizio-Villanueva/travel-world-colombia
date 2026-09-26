import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { arbolCategorias } from '@/lib/categorias'
import type { Categoria } from '@/types/destino'
import { CategoriaForm } from './CategoriaForm'
import { CategoriaFila } from './CategoriaFila'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const { rol } = session

  const admin = createAdminClient()
  const [{ data, error }, { data: viajes }] = await Promise.all([
    admin.from('categorias').select('id, nombre, slug, parent_id, clave, orden'),
    admin.from('destinos').select('categorias'),
  ])

  const arbol = arbolCategorias((data ?? []) as Categoria[])

  // Viajes por categoría. Una principal cuenta también los viajes que solo
  // tienen alguna de sus subcategorías (es lo que se les quitaría al borrarla).
  const listas = (viajes ?? []).map(v => new Set<string>((v.categorias as string[] | null) ?? []))
  const usos = (ids: string[]) => listas.filter(s => ids.some(id => s.has(id))).length

  const editable = rol === 'admin' || rol === 'editor'

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Categorías
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Clasifica los viajes (ej. Cruceros › Sin visa, Todo incluido). Se asignan en cada viaje, se ven
          como etiqueta en la web y permiten filtrar en /destinos. Los viajes con la categoría
          <strong> Cruceros</strong> salen en la página de cruceros.
        </p>
      </div>

      {editable && <CategoriaForm principales={arbol.map(c => ({ id: c.id, nombre: c.nombre }))} />}

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando categorías: {error.message}
        </p>
      )}

      {!error && arbol.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Aún no hay categorías. Crea la primera arriba.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {arbol.map((c, i) => (
          <li key={c.id} className="rounded-lg p-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <CategoriaFila
              categoria={c}
              viajes={usos([c.id, ...c.hijas.map(h => h.id)])}
              subcategorias={c.hijas.length}
              primera={i === 0}
              ultima={i === arbol.length - 1}
              rol={rol}
            />
            {c.hijas.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5 border-l pl-4 sm:ml-4" style={{ borderColor: 'var(--border)' }}>
                {c.hijas.map((h, j) => (
                  <li key={h.id}>
                    <CategoriaFila
                      categoria={h}
                      viajes={usos([h.id])}
                      primera={j === 0}
                      ultima={j === c.hijas.length - 1}
                      rol={rol}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
