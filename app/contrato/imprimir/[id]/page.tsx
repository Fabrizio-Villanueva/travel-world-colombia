import { notFound } from 'next/navigation'
import { ContratoDocumento } from '@/components/contrato/ContratoDocumento'
import { HojaEvidencia } from '@/components/contrato/HojaEvidencia'
import { impresionValida } from '@/lib/contratos/acceso'
import { contratoPorId, firmaComoDataUrl } from '@/lib/contratos/registro'

export const dynamic = 'force-dynamic'

/**
 * Página interna que el Chromium del servidor imprime a PDF: el contrato
 * congelado, con la firma del titular y la hoja de evidencia. Solo abre con
 * la firma HMAC de 5 minutos que genera lib/contratos/registro.ts.
 */
export default async function ImprimirContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ e?: string; k?: string }>
}) {
  const { id } = await params
  const { e, k } = await searchParams
  if (!impresionValida(id, e, k)) notFound()
  const c = await contratoPorId(id)
  if (!c) notFound()

  const firma = await firmaComoDataUrl(c)
  const cuando = c.firmado_en
    ? new Date(c.firmado_en).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <>
      <ContratoDocumento
        datos={c.datos}
        firma={
          firma ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL del trazo; se imprime a PDF
            <img src={firma} alt={`Firma de ${c.firmante_nombre ?? 'el titular'}`} />
          ) : undefined
        }
        firmaPie={cuando ? `Firmado electrónicamente el ${cuando}` : undefined}
        firmaAgencia={<span style={{ fontSize: 10, color: '#626c7e', paddingBottom: 6 }}>Emitido electrónicamente</span>}
      />
      {c.estado === 'firmado' && <HojaEvidencia c={c} />}
    </>
  )
}
