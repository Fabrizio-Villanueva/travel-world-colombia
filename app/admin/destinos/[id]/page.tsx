import { redirect, notFound } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Destino } from '@/types/destino'
import { DestinoForm } from '../../_components/DestinoForm'
import { actualizarDestino } from '../actions'
import { getArbolCategoriasAdmin } from '@/lib/admin/categorias'
import { getTextosSitio } from '@/lib/textos'

export const dynamic = 'force-dynamic'

export default async function EditarDestinoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { id } = await params
  const admin = createAdminClient()
  const [{ data }, categorias, textosGlobales] = await Promise.all([
    admin.from('destinos').select('*').eq('id', id).maybeSingle(),
    getArbolCategoriasAdmin(),
    getTextosSitio(),
  ])
  if (!data) notFound()

  const destino = data as Destino
  return (
    <DestinoForm
      action={actualizarDestino.bind(null, id)}
      destino={destino}
      titulo={`Editar: ${destino.nombre}`}
      categorias={categorias}
      textosGlobales={textosGlobales}
    />
  )
}
