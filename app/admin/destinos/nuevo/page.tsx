import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin/guard'
import { DestinoForm } from '../../_components/DestinoForm'
import { crearDestino } from '../actions'
import { getArbolCategoriasAdmin } from '@/lib/admin/categorias'

export const dynamic = 'force-dynamic'

export default async function NuevoDestinoPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return <DestinoForm action={crearDestino} titulo="Nuevo viaje" categorias={await getArbolCategoriasAdmin()} />
}
