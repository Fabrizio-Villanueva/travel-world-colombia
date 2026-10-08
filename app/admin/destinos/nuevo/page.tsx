import { requirePagina } from '@/lib/admin/guard'
import { DestinoForm } from '../../_components/DestinoForm'
import { crearDestino } from '../actions'
import { getArbolCategoriasAdmin } from '@/lib/admin/categorias'
import { getTextosSitio } from '@/lib/textos'

export const dynamic = 'force-dynamic'

export default async function NuevoDestinoPage() {
  await requirePagina()

  const [categorias, textosGlobales] = await Promise.all([getArbolCategoriasAdmin(), getTextosSitio()])
  return <DestinoForm action={crearDestino} titulo="Nuevo viaje" categorias={categorias} textosGlobales={textosGlobales} />
}
