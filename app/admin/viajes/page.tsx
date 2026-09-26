import Image from '@/components/ui/Foto'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin/guard'
import { destinoCardImg } from '@/lib/hero'
import type { Destino } from '@/types/destino'
import { RowActions } from '../_components/RowActions'
import { getCategoriasAdmin } from '@/lib/admin/categorias'
import { arbolCategorias, etiquetasDe } from '@/lib/categorias'

export const dynamic = 'force-dynamic'

/** Chip de filtro por categoría (enlace: el filtro vive en ?cat=). */
function Filtro({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className="rounded-full px-3 py-1.5 font-inter text-xs transition-colors"
      style={
        activo
          ? { background: 'var(--orange)', color: 'var(--orange-contrast)', border: '1px solid var(--orange)' }
          : { background: 'var(--card-bg)', color: 'var(--text-dim)', border: '1px solid var(--border)' }
      }
    >
      {children}
    </Link>
  )
}

export default async function ViajesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const { rol } = session

  // Service-role: el panel muestra también los viajes ocultos y no depende de
  // las políticas RLS (que ahora exigen estar en admin_allowlist, y los
  // superadmins de ADMIN_EMAILS pueden no tener fila).
  const supabase = createAdminClient()
  const [{ data, error }, cats, { cat }] = await Promise.all([
    supabase.from('destinos').select('*').order('orden', { ascending: true }),
    getCategoriasAdmin(),
    searchParams,
  ])

  const todos = (data ?? []) as Destino[]
  const arbol = arbolCategorias(cats)

  // Filtro por categoría (una principal incluye los viajes de sus subcategorías)
  // o "sin" = viajes aún sin clasificar, para que el personal los encuentre.
  const idsFiltro = (id: string) => {
    const principal = arbol.find(c => c.id === id)
    return principal ? [principal.id, ...principal.hijas.map(h => h.id)] : [id]
  }
  const coincide = (d: Destino, id: string) => idsFiltro(id).some(x => d.categorias?.includes(x))
  const sinCategoria = todos.filter(d => !d.categorias?.length)
  const destinos =
    cat === 'sin' ? sinCategoria
    : cat && cats.some(c => c.id === cat) ? todos.filter(d => coincide(d, cat))
    : todos

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Viajes
          </h1>
          <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            {todos.length} {todos.length === 1 ? 'destino' : 'destinos'} · se publican automáticamente en la web
          </p>
        </div>
        {rol !== 'lector' && (
          <Link
            href="/admin/destinos/nuevo"
            className="flex items-center gap-2 rounded-md px-4 py-2.5 font-plus-jakarta text-sm font-bold"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
          >
            <Plus size={16} />
            Nuevo viaje
          </Link>
        )}
      </div>

      {arbol.length > 0 && todos.length > 0 && (
        <nav aria-label="Filtrar por categoría" className="mb-5 flex flex-wrap gap-2">
          <Filtro href="/admin/viajes" activo={!cat}>Todos · {todos.length}</Filtro>
          {arbol.flatMap(c => [c, ...c.hijas]).map(c => {
            const n = todos.filter(d => coincide(d, c.id)).length
            const madre = c.parent_id ? arbol.find(p => p.id === c.parent_id) : undefined
            return (
              <Filtro key={c.id} href={`/admin/viajes?cat=${c.id}`} activo={cat === c.id}>
                {madre ? `${madre.nombre} › ` : ''}{c.nombre} · {n}
              </Filtro>
            )
          })}
          <Filtro href="/admin/viajes?cat=sin" activo={cat === 'sin'}>Sin categoría · {sinCategoria.length}</Filtro>
        </nav>
      )}

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando destinos: {error.message}
        </p>
      )}

      {!error && destinos.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          {todos.length === 0 ? 'Aún no hay viajes. Crea el primero con “Nuevo viaje”.' : 'Ningún viaje con esta categoría.'}
        </p>
      )}

      {destinos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {destinos.map(d => (
            <li
              key={d.id}
              className="flex items-center gap-4 rounded-lg p-3"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', opacity: d.activo ? 1 : 0.55 }}
            >
              <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md" style={{ background: 'var(--bg-alt)' }}>
                <Image src={destinoCardImg(d)} alt={d.nombre} fill sizes="64px" className="object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {d.nombre}
                </p>
                <p className="truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
                  /{d.slug} · {d.pais}{d.precio_desde ? ` · ${d.precio_desde}` : ''}
                </p>
                {etiquetasDe(d.categorias, arbol).length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {etiquetasDe(d.categorias, arbol).map(e => (
                      <span
                        key={e}
                        className="rounded-full px-2 py-0.5 font-inter text-[11px]"
                        style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
                      >
                        {e}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              <RowActions id={d.id} nombre={d.nombre} activo={d.activo} destacado={d.destacado} rol={rol} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
