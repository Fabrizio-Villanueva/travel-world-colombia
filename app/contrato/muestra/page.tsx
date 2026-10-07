import { ContratoDocumento } from '@/components/contrato/ContratoDocumento'
import { CONTRATO_MUESTRA } from '@/lib/contratos/muestra'

/**
 * Muestra del contrato con datos inventados, para aprobar el diseño
 * (3 pasajeros, 2 trayectos, 2 tarifas por tramo y 2 pagos).
 */
export default function ContratoMuestraPage() {
  return (
    <div className="shadow-xl sm:mx-auto sm:max-w-[816px]">
      <ContratoDocumento datos={CONTRATO_MUESTRA} />
    </div>
  )
}
