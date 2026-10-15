import { requirePagina } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { COLUMNAS, PAGINAS_INFO, type PaginaInfoGuardada } from '@/lib/paginas-info'
import { PaginasEditor } from './PaginasEditor'

export const dynamic = 'force-dynamic'

export default async function PaginasPage() {
  const { rol } = await requirePagina()

  // Service role: el panel ve también los borradores (la lectura pública solo ve lo publicado).
  const { data, error } = await createAdminClient()
    .from('paginas_info')
    .select('slug, intro, contenido, publicada, actualizado_en, actualizado_por')
  const guardadas: Record<string, PaginaInfoGuardada & { actualizado_por: string | null }> = {}
  for (const f of data ?? []) guardadas[f.slug as string] = f as PaginaInfoGuardada & { actualizado_por: string | null }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Políticas y términos y condiciones
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Información de la compañía y textos legales que se enlazan desde el pie de página de la web.
          Cada página aparece en la web cuando la publicas. Las que ya existían en el sitio siguen enlazadas
          a su página actual hasta que publiques un texto propio.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
          Error cargando las páginas: {error.message}
        </p>
      )}

      <PaginasEditor
        columnas={COLUMNAS}
        paginas={PAGINAS_INFO}
        guardadas={guardadas}
        editable={rol === 'admin' || rol === 'editor'}
      />
    </>
  )
}
