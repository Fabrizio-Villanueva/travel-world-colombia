import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { ContratoDocumento } from '@/components/contrato/ContratoDocumento'
import { tokenValido } from '@/lib/documentos/token'
import { accesoContratoValido, nombreCookieContrato } from '@/lib/contratos/acceso'
import { contratoPorToken, estadoEnlaceContrato, marcarVisto } from '@/lib/contratos/registro'
import { IntroSeguro } from '@/app/documentos/[token]/IntroSeguro'
import { Verificacion, Garantias } from './Verificacion'
import { Firmar } from './Firmar'

export const metadata: Metadata = { title: 'Firma tu contrato', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
// Firmar genera el PDF con Chromium en el servidor.
export const maxDuration = 60

/**
 * /contrato/<token>: el enlace personal para firmar. Estados:
 *  1. enlace inválido / vencido / anulado → aviso;
 *  2. sin cookie de acceso → código de 6 dígitos por WhatsApp o correo;
 *  3. verificado y sin firmar → el contrato completo + recuadro de firma;
 *  4. ya firmado → confirmación y descarga del PDF.
 */
export default async function ContratoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!tokenValido(token)) return <Aviso texto="Este enlace no existe o ya no está disponible." />

  const c = await contratoPorToken(token)
  const estado = estadoEnlaceContrato(c)
  if (!c || estado === 'no-existe') return <Aviso texto="Este enlace no existe o ya no está disponible." />
  if (estado === 'anulado') return <Aviso texto="Este contrato fue reemplazado o anulado. Pídele a tu asesora el enlace vigente." />
  if (estado === 'vencido') return <Aviso texto="Este enlace venció. Pídele a tu asesora uno nuevo." />

  // Splash + candado (una vez por dispositivo), con la página ya debajo.
  const conIntro = (contenido: React.ReactNode) => (
    <IntroSeguro
      clave={c.token_hash.slice(0, 12)}
      prefijo="twc_ct_intro_"
      etiqueta="Firma segura de contratos"
      detalle="Verificación por código · Firma con validez legal"
    >
      {contenido}
    </IntroSeguro>
  )

  const subtitulo = [c.reserva ? `Reserva TW-${c.reserva}` : null, c.datos.destino].filter(Boolean).join(' · ') || null
  const cookie = (await cookies()).get(nombreCookieContrato(c.token_hash))?.value
  if (!accesoContratoValido(cookie, c.id)) {
    return conIntro(
      <div className="mx-auto max-w-md px-4 py-8">
        <Verificacion token={token} subtitulo={subtitulo} telefonoFinal={c.telefono_ultimos4} firmado={estado === 'firmado'} />
      </div>
    )
  }

  if (estado === 'firmado') {
    const cuando = new Date(c.firmado_en!).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short',
    }).replace(/\.$/, '') // "2:19 p. m." ya trae punto: evita el ".." al cerrar la frase
    return conIntro(
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
        <section className="rounded-[24px] bg-white p-6 text-center sm:p-8" style={{ border: '1px solid rgba(13,30,60,0.08)' }}>
          <CheckCircle2 size={44} strokeWidth={1.6} className="mx-auto" style={{ color: '#2e7d32' }} />
          <h1 className="mt-4 font-plus-jakarta text-[22px] font-extrabold" style={{ color: '#0D1E3C' }}>
            ¡Contrato firmado!
          </h1>
          <p className="mt-2 font-inter text-[14px] leading-relaxed" style={{ color: '#6B7A90' }}>
            {c.firmante_nombre} firmó el contrato{c.reserva ? ` de la reserva TW-${c.reserva}` : ''} el {cuando}.
            Tu asesora ya fue notificada.
          </p>
          <a
            href={`/contrato/${token}/pdf`}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white"
            style={{ background: '#2957A4' }}
          >
            <Download size={18} /> Descargar mi copia en PDF
          </a>
          <p className="mt-3 font-inter text-[11px]" style={{ color: '#6B7A90' }}>
            Incluye la hoja de evidencia de tu firma electrónica.
          </p>
        </section>
        <Garantias />
      </div>
    )
  }

  // Verificado y pendiente de firma: la primera vez queda como "Visto".
  const h = await headers()
  await marcarVisto(
    c,
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'desconocida',
    (h.get('user-agent') ?? 'desconocido').slice(0, 400)
  )

  return conIntro(
    <div className="pb-24">
      <p className="mx-auto mb-3 max-w-[816px] px-4 font-inter text-[13px] sm:px-0" style={{ color: '#6B7A90' }}>
        Lee tu contrato con calma. Al final encontrarás el recuadro para firmar.
      </p>
      <div className="shadow-xl sm:mx-auto sm:max-w-[816px] sm:overflow-hidden sm:rounded-xl">
        <ContratoDocumento datos={c.datos} />
      </div>
      <Firmar
        token={token}
        nombreInicial={c.datos.titular.nombre}
        documentoInicial={c.datos.titular.documento ?? ''}
      />
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl bg-white p-6 text-center" style={{ border: '1px solid rgba(13,30,60,0.08)' }}>
        <AlertCircle size={28} className="mx-auto mb-3" style={{ color: '#6B7A90' }} />
        <p className="font-inter text-sm" style={{ color: '#0D1E3C' }}>
          {texto}
        </p>
      </div>
    </div>
  )
}
