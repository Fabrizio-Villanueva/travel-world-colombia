import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { tokenValido } from '@/lib/documentos/token'
import { accesoContratoValido, nombreCookieContrato } from '@/lib/contratos/acceso'
import { asegurarPdf, contratoPorToken, registrarEvento, urlFirmadaContrato } from '@/lib/contratos/registro'

// Si el PDF no se alcanzó a generar al firmar, se genera aquí.
export const maxDuration = 60

/** Descarga del PDF firmado: exige la cookie de acceso del enlace. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const volver = NextResponse.redirect(new URL(`/contrato/${token}`, req.url))
  if (!tokenValido(token)) return volver
  const c = await contratoPorToken(token)
  if (!c || c.estado !== 'firmado') return volver
  const cookie = (await cookies()).get(nombreCookieContrato(c.token_hash))?.value
  if (!accesoContratoValido(cookie, c.id)) return volver

  const listo = await asegurarPdf(c, req.headers.get('host'))
  await registrarEvento(c.id, {
    tipo: 'descargado',
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  })
  const nombre = `Contrato-TW-${(c.reserva ?? 'TWC').replace(/[^\w-]/g, '')}.pdf`
  return NextResponse.redirect(await urlFirmadaContrato(listo.pdf_ruta!, nombre))
}
