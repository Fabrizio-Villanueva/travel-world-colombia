import { cookies } from 'next/headers'
import { AlertCircle } from 'lucide-react'
import { accesoFirmadoValido, nombreCookieAcceso, tokenValido } from '@/lib/documentos/token'
import { estadoEnlace, minutosBloqueo, portalDatos, solicitudPorToken } from '@/lib/documentos/solicitudes'
import { Verificacion } from './Verificacion'
import { Portal } from './Portal'

export const dynamic = 'force-dynamic'

/**
 * /documentos/<token>: el enlace personal de un viaje. Tres estados:
 *  1. enlace inválido / vencido / desactivado → aviso;
 *  2. sin cookie de acceso → pedir los últimos 4 dígitos del celular;
 *  3. verificado → el portal de carga.
 */
export default async function DocumentosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!tokenValido(token)) return <Aviso texto="Este enlace no existe o ya no está disponible." />

  const s = await solicitudPorToken(token)
  const estado = estadoEnlace(s)
  if (!s || estado === 'no-existe') return <Aviso texto="Este enlace no existe o ya no está disponible." />
  if (estado === 'vencido') return <Aviso texto="Este enlace venció. Pídele a tu asesora uno nuevo." />
  if (estado === 'revocado') return <Aviso texto="Este enlace fue desactivado. Pídele a tu asesora uno nuevo." />

  const cookie = (await cookies()).get(nombreCookieAcceso(s.token_hash))?.value
  if (accesoFirmadoValido(cookie, s.id)) {
    return <Portal token={token} inicial={await portalDatos(s)} />
  }

  return <Verificacion token={token} nombreViaje={s.nombre_viaje} bloqueadoMinutos={minutosBloqueo(s)} />
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center" style={{ border: '1px solid var(--border)' }}>
      <AlertCircle size={28} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
      <p className="font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
        {texto}
      </p>
    </div>
  )
}
