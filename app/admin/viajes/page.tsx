import Image from '@/components/ui/Foto'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin/guard'
import { destinoCardImg } from '@/lib/hero'
import type { Destino } from '@/types/destino'
import { RowActions } from '../_components/RowActions'

export const dynamic = 'force-dynamic'

export default async function ViajesPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const { rol } = session

  // Service-role: el panel muestra también los viajes ocultos y no depende de
  // las políticas RLS (que ahora exigen estar en admin_allowlist, y los
  // superadmins de ADMIN_EMAILS pueden no tener fila).
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('destinos')
    .select('*')
    .order('orden', { ascending: true })

  const destinos = (data ?? []) as Destino[]

  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Viajes
          </h1>
          <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            {destinos.length} {destinos.length === 1 ? 'destino' : 'destinos'} · se publican automáticamente en la web
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

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando destinos: {error.message}
        </p>
      )}

      {!error && destinos.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Aún no hay viajes. Crea el primero con “Nuevo viaje”.
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
              </div>

              <RowActions id={d.id} nombre={d.nombre} activo={d.activo} destacado={d.destacado} rol={rol} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
