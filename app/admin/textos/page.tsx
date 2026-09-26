import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATALOGO_TEXTOS, ORIGINALES } from '@/lib/textos'
import { TextosForm } from './TextosForm'

export const dynamic = 'force-dynamic'

export default async function TextosPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const { rol } = session

  // Se lee con la service role (no con el cliente público cacheado) para que
  // el panel muestre siempre lo último guardado.
  const admin = createAdminClient()
  const { data, error } = await admin.from('textos_sitio').select('clave, valor, actualizado_en, actualizado_por')

  const guardados: Record<string, string> = {}
  for (const fila of data ?? []) {
    if (fila.clave in ORIGINALES) guardados[fila.clave as string] = fila.valor as string
  }
  const ultimo = (data ?? [])
    .map(f => ({ en: f.actualizado_en as string, por: f.actualizado_por as string | null }))
    .sort((a, b) => (a.en < b.en ? 1 : -1))[0]

  const personalizados = Object.keys(guardados).length

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Textos del sitio
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Títulos, subtítulos y etiquetas de cada sección de la página principal y de la página de
          producto. Los de producto son la plantilla de <strong>todos</strong> los viajes: al guardar, cambian
          en todas las páginas al instante. Un viaje puede tener un título propio desde su ficha
          (bloque &quot;Textos de la página&quot;).
          {' '}· {personalizados} texto{personalizados !== 1 ? 's' : ''} personalizado{personalizados !== 1 ? 's' : ''}
          {ultimo?.por ? ` · último cambio: ${ultimo.por}` : ''}
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando los textos: {error.message}
        </p>
      )}

      <TextosForm catalogo={CATALOGO_TEXTOS} guardados={guardados} editable={rol === 'admin' || rol === 'editor'} />
    </>
  )
}
