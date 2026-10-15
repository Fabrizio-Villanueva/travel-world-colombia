import { NextResponse, type NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/admin/guard'
import { registrarActividad } from '@/lib/admin/audit'
import { asegurarPdf, contratoPorId, urlFirmadaContrato } from '@/lib/contratos/registro'
import { nombreArchivoContrato } from '@/lib/contratos/nombre-archivo'

export const maxDuration = 60

/**
 * PDF firmado para el equipo: es el enlace que queda en GHL ("Contrato
 * firmado (PDF)"). Pide sesión del panel y deja registro de quién lo abrió.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession()
  const { id } = await params
  if (!session || session.rol === 'lector') {
    return NextResponse.redirect(new URL(`/admin/login?next=/admin/contratos/${id}/pdf`, req.url))
  }
  const c = await contratoPorId(id)
  // Firmado, o anulado DESPUÉS de firmarse: la evidencia sigue disponible para el equipo.
  if (!c || !(c.estado === 'firmado' || (c.estado === 'anulado' && c.firmado_en))) {
    return new NextResponse('Este contrato no existe o aún no está firmado.', { status: 404 })
  }
  const listo = await asegurarPdf(c, req.headers.get('host'))
  await registrarActividad({
    email: session.user.email ?? '',
    accion: 'ver-contrato',
    slug: c.opportunity_id,
    nombre: `TW-${c.reserva}`,
  })
  // Se descarga con nombre legible (TW-2836 - Titular - Destino.pdf), 15-oct-2026.
  const nombre = nombreArchivoContrato({ reserva: c.reserva, titular: c.titular, destino: c.datos.destino })
  return NextResponse.redirect(await urlFirmadaContrato(listo.pdf_ruta!, nombre))
}
