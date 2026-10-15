import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalShell } from '@/components/legal/LegalShell'
import { TextoFormateado } from '@/components/legal/TextoFormateado'
import { COLUMNAS, PAGINAS_INFO, getPaginasPublicadas } from '@/lib/paginas-info'

/** Páginas del pie de página editables desde el panel (lib/paginas-info.ts). */
export const revalidate = 3600

export function generateStaticParams() {
  return PAGINAS_INFO.map(p => ({ slug: p.slug }))
}

async function cargar(slug: string) {
  const def = PAGINAS_INFO.find(p => p.slug === slug)
  if (!def) return null
  const guardada = (await getPaginasPublicadas()).get(slug)
  return guardada ? { def, guardada } : null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = await cargar(slug)
  if (!p) return {}
  return {
    title: p.def.titulo,
    description: p.guardada.intro || undefined,
    alternates: { canonical: `/info/${slug}` },
  }
}

export default async function PaginaInfo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await cargar(slug)
  if (!p) notFound()
  const columna = COLUMNAS.find(c => c.id === p.def.columna)?.titulo ?? ''

  return (
    <LegalShell tag={columna} titulo={p.def.titulo} intro={p.guardada.intro || undefined}>
      <TextoFormateado texto={p.guardada.contenido} />
      <p className="mt-10 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Última actualización:{' '}
        {new Date(p.guardada.actualizado_en).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long' })}
      </p>
    </LegalShell>
  )
}
