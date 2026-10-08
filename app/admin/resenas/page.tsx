import { Star } from 'lucide-react'
import { requirePagina } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { ResenaForm } from './ResenaForm'
import { ResenaActions } from './ResenaActions'

export const dynamic = 'force-dynamic'

interface Resena {
  id: string
  nombre: string
  texto: string
  estrellas: number | null
  destino: string | null
  fuente: string | null
  activa: boolean
}

export default async function ResenasPage() {
  const session = await requirePagina()
  const { rol } = session

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('resenas')
    .select('*')
    .order('orden', { ascending: true })

  const resenas = (data ?? []) as Resena[]

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Reseñas
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Testimonios que se muestran en la web · {resenas.filter(r => r.activa).length} activas
        </p>
      </div>

      {rol !== 'lector' && <ResenaForm />}

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando reseñas: {error.message}
        </p>
      )}

      {!error && resenas.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Aún no hay reseñas. Agrega la primera arriba.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {resenas.map(r => (
          <li
            key={r.id}
            className="flex items-start gap-4 rounded-lg p-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', opacity: r.activa ? 1 : 0.55 }}
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <p className="font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.nombre}</p>
                <span className="flex items-center" style={{ color: 'var(--orange)' }}>
                  {Array.from({ length: r.estrellas ?? 5 }).map((_, i) => <Star key={i} size={12} fill="var(--orange)" />)}
                </span>
                {r.destino ? <span className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>· {r.destino}</span> : null}
                {r.fuente ? <span className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>· {r.fuente}</span> : null}
              </div>
              <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>{r.texto}</p>
            </div>
            <ResenaActions id={r.id} nombre={r.nombre} activa={r.activa} rol={rol} />
          </li>
        ))}
      </ul>
    </>
  )
}
