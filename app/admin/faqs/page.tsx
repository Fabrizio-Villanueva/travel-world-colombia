import { requirePagina } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { FaqForm } from './FaqForm'
import { FaqActions } from './FaqActions'

export const dynamic = 'force-dynamic'

interface Faq {
  id: string
  pregunta: string
  respuesta: string
  activa: boolean
}

export default async function FaqsPage() {
  const session = await requirePagina()
  const { rol } = session

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('faqs')
    .select('*')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  const faqs = (data ?? []) as Faq[]

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Preguntas frecuentes
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Se muestran en la web y alimentan el SEO de Google · {faqs.filter(f => f.activa).length} activas
        </p>
      </div>

      {rol !== 'lector' && <FaqForm />}

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando preguntas: {error.message}
        </p>
      )}

      {!error && faqs.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Aún no hay preguntas. Agrega la primera arriba.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {faqs.map((f, i) => (
          <li
            key={f.id}
            className="flex items-start gap-4 rounded-lg p-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', opacity: f.activa ? 1 : 0.55 }}
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-plus-jakarta text-xs font-bold"
              style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.pregunta}</p>
              <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>{f.respuesta}</p>
            </div>
            <FaqActions id={f.id} pregunta={f.pregunta} activa={f.activa} rol={rol} />
          </li>
        ))}
      </ol>
    </>
  )
}
