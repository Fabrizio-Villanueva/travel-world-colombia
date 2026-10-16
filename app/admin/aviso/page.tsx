import { requirePagina } from '@/lib/admin/guard'
import { getAvisoSeguridad } from '@/lib/aviso-seguridad'
import { AvisoForm } from './AvisoForm'

export const dynamic = 'force-dynamic'

/** Franja antisuplantación de todo el sitio (16-oct-2026). */
export default async function AvisoPage() {
  const { rol } = await requirePagina()
  const aviso = await getAvisoSeguridad()

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Aviso de seguridad
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Franja de alerta contra la suplantación, arriba de todas las páginas de la web. Lleva a la página
          /verificar, donde cualquier persona puede comprobar si el número que le escribió es nuestro. La vista
          previa del enlace en WhatsApp también muestra el número oficial.
        </p>
      </div>
      <AvisoForm inicial={aviso} editable={rol === 'admin' || rol === 'editor'} />
    </>
  )
}
