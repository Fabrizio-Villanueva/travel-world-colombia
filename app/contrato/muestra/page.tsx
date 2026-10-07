import { ContratoDocumento } from '@/components/contrato/ContratoDocumento'
import { CONTRATO_MUESTRA, muestraConPasajeros } from '@/lib/contratos/muestra'
import { contratoDesdeGhl } from '@/lib/contratos/desde-ghl'

/**
 * Muestra del contrato con datos inventados (3 pasajeros, 2 trayectos,
 * 2 tarifas por tramo y 2 pagos). `?pax=N` la arma con N personas (1–20)
 * para ver cómo crece el documento.
 *
 * Solo en desarrollo local: `?opp=<id>` arma el contrato con una oportunidad
 * real de GHL, para probar el traductor sin iniciar sesión en el panel. En
 * producción (y en las vistas previas de Vercel) el parámetro se ignora.
 */
export default async function ContratoMuestraPage({ searchParams }: { searchParams: Promise<{ opp?: string; pax?: string }> }) {
  const { opp, pax } = await searchParams
  const datos =
    process.env.NODE_ENV === 'development' && opp && /^[A-Za-z0-9]{10,40}$/.test(opp)
      ? await contratoDesdeGhl(opp)
      : pax
        ? muestraConPasajeros(Number(pax) || 1)
        : CONTRATO_MUESTRA

  return (
    <div className="shadow-xl sm:mx-auto sm:max-w-[816px]">
      <ContratoDocumento datos={datos} />
    </div>
  )
}
