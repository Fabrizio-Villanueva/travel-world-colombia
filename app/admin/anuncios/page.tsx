import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { nombreDe } from '@/lib/agente/anuncios'
import { AnuncioFila, type AnuncioVista, type OpcionDestino } from './AnuncioFila'

export const dynamic = 'force-dynamic'

interface FilaAnuncio {
  ad_id: string
  titulo: string | null
  texto: string | null
  source_app: string | null
  media_type: string | null
  nombre: string | null
  slugs: string[] | null
  vinculo: AnuncioVista['vinculo']
  vinculo_motivo: string | null
  leads: number
  primera_vez: string
  ultima_vez: string
}

export default async function AnunciosPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const { rol } = session

  const admin = createAdminClient()
  const [{ data, error }, { data: destinos }] = await Promise.all([
    admin
      .from('agente_anuncios')
      .select('ad_id, titulo, texto, source_app, media_type, nombre, slugs, vinculo, vinculo_motivo, leads, primera_vez, ultima_vez')
      .order('ultima_vez', { ascending: false }),
    admin.from('destinos').select('slug, nombre, activo').order('nombre'),
  ])

  const opciones: OpcionDestino[] = ((destinos ?? []) as OpcionDestino[]).filter(d => d.activo)
  const nombrePorSlug = new Map(((destinos ?? []) as OpcionDestino[]).map(d => [d.slug, d.nombre]))

  const anuncios: AnuncioVista[] = ((data ?? []) as FilaAnuncio[]).map(a => ({
    adId: a.ad_id,
    nombre: nombreDe(a),
    titulo: a.titulo,
    texto: a.texto,
    sourceApp: a.source_app,
    mediaType: a.media_type,
    slugs: a.slugs ?? [],
    productos: (a.slugs ?? []).map(s => nombrePorSlug.get(s) ?? s),
    vinculo: a.vinculo,
    vinculoMotivo: a.vinculo_motivo,
    leads: a.leads,
    primeraVez: a.primera_vez,
    ultimaVez: a.ultima_vez,
  }))

  const totalLeads = anuncios.reduce((s, a) => s + a.leads, 0)

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Anuncios de Meta
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Anuncios de Instagram, Facebook y estados de WhatsApp por los que han llegado clientes a Sol. Cada
          anuncio se vincula solo con el programa del catálogo que promociona: Sol responde con la ficha del
          programa y marca la fuente del lead en GHL. Si el producto aún no está en el catálogo, Sol usa lo que
          dice el anuncio y se vincula solo cuando lo subas. Puedes corregir un vínculo a mano.
          {' '}· {anuncios.length} anuncio{anuncios.length !== 1 ? 's' : ''} · {totalLeads} lead{totalLeads !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando anuncios: {error.message}
        </p>
      )}

      {!error && anuncios.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Todavía no ha llegado ningún cliente desde un anuncio. Aparecerán aquí solos con el primer lead.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {anuncios.map(a => (
          <li key={a.adId} className="rounded-lg p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <AnuncioFila anuncio={a} destinos={opciones} rol={rol} />
          </li>
        ))}
      </ul>
    </>
  )
}
