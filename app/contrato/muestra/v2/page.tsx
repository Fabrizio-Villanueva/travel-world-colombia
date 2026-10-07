import { ContratoDocumentoV2 } from '@/components/contrato/ContratoDocumentoV2'
import { CONTRATO_MUESTRA } from '@/lib/contratos/muestra'

/** Propuesta de rediseño (v2) con los mismos datos de muestra. */
export default function ContratoMuestraV2Page() {
  return (
    <div className="shadow-xl sm:mx-auto sm:max-w-[816px]">
      <ContratoDocumentoV2 datos={CONTRATO_MUESTRA} />
    </div>
  )
}
