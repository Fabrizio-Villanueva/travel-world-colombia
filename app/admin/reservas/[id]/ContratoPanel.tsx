'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Ban, CheckCircle2, Eye, FileSignature, Loader2, RefreshCw, Send } from 'lucide-react'
import {
  anularContratoPanel,
  enviarContrato,
  estadoContrato,
  reenviarContrato,
  reenviarCopiaFirmada,
  type EstadoContratoPanel,
} from './contrato-actions'

/**
 * Recuadro "Contrato" del Generador: estado del contrato propio (enviado →
 * visto → firmado) y sus acciones. Enviar arma la foto congelada del contrato
 * con lo que hoy tiene la oportunidad, escribe el enlace en GHL y dispara el
 * workflow que se lo manda al cliente.
 */

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.10)'
const ACCENT = '#2957A4'

const ESTADO: Record<NonNullable<EstadoContratoPanel['ultimo']>['estado'], { texto: string; fondo: string; color: string }> = {
  enviado: { texto: 'Enviado · sin abrir', fondo: '#EDF3FC', color: ACCENT },
  visto: { texto: 'Abierto por el cliente', fondo: '#FFF7DC', color: '#8a6a00' },
  firmado: { texto: 'Firmado', fondo: '#E7F5EA', color: '#2e7d32' },
  anulado: { texto: 'Anulado', fondo: '#FDECEC', color: '#c62828' },
  vencido: { texto: 'Enlace vencido', fondo: '#FDECEC', color: '#c62828' },
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })

export function ContratoPanel({ opportunityId, inicial }: { opportunityId: string; inicial: EstadoContratoPanel }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<null | 'enviar' | 'reenviar' | 'copia' | 'anular'>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  // Los faltantes se calculan al abrir la página; la asesora los va llenando en
  // el wizard de abajo, así que se pueden volver a revisar sin recargar (y el
  // servidor los revisa de nuevo al enviar).
  const [problemas, setProblemas] = useState(inicial.problemas)
  const [revisando, setRevisando] = useState(false)
  const u = inicial.ultimo

  async function revisar() {
    setRevisando(true)
    try {
      setProblemas((await estadoContrato(opportunityId)).problemas)
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo revisar. Intenta de nuevo.' })
    } finally {
      setRevisando(false)
    }
  }
  const vigente = u && (u.estado === 'enviado' || u.estado === 'visto')

  async function reenviarCopia() {
    if (!confirm('Se le enviará al cliente el enlace de su contrato firmado por WhatsApp y correo. ¿Continuar?')) return
    setOcupado('copia')
    setMensaje(null)
    try {
      const r = await reenviarCopiaFirmada(opportunityId)
      setMensaje(
        r.ok
          ? { tipo: 'ok', texto: `Copia del contrato firmado enviada por ${r.datos.canales.join(' y ')}.` }
          : { tipo: 'error', texto: r.error }
      )
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo completar. Revisa tu conexión e intenta de nuevo.' })
    } finally {
      setOcupado(null)
    }
  }

  async function correr(accion: 'enviar' | 'reenviar' | 'anular') {
    if (accion === 'enviar' && vigente && !confirm('Se enviará una versión NUEVA con los datos actuales y el enlace anterior dejará de servir. ¿Continuar?')) return
    if (accion === 'anular' && !confirm('¿Anular este contrato? El enlace del cliente dejará de servir.')) return
    setOcupado(accion)
    setMensaje(null)
    try {
      const r =
        accion === 'enviar'
          ? await enviarContrato(opportunityId)
          : accion === 'reenviar'
            ? await reenviarContrato(opportunityId)
            : await anularContratoPanel(opportunityId, u!.id)
      if (!r.ok) return setMensaje({ tipo: 'error', texto: r.error })
      setMensaje({
        tipo: 'ok',
        texto:
          accion === 'enviar'
            ? 'Contrato enviado: GHL le manda el enlace al cliente por WhatsApp y correo.'
            : accion === 'reenviar'
              ? 'Aviso reenviado con el mismo enlace.'
              : 'Contrato anulado.',
      })
      router.refresh()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo completar. Revisa tu conexión e intenta de nuevo.' })
    } finally {
      setOcupado(null)
    }
  }

  const boton = 'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 font-inter text-xs font-semibold disabled:opacity-50'

  return (
    <section
      id="contrato-para-firma"
      className="scroll-mt-6 rounded-2xl bg-white p-5"
      style={{ border: `1px solid ${BORDER}`, position: 'relative', zIndex: 1 }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: '#EDF3FC', color: ACCENT }}>
            <FileSignature size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-plus-jakarta text-base font-extrabold" style={{ color: NAVY }}>
              Contrato para firma
            </h2>
            <p className="font-inter text-xs" style={{ color: MUTED }}>
              {u
                ? `Último: ${fechaHora(u.creadoEn)} por ${u.creadoPor}`
                : 'Aún no se ha enviado. Llena los pasos del Generador y envíalo desde aquí.'}
            </p>
          </div>
        </div>
        {u && (
          <span className="rounded-full px-3 py-1 font-inter text-xs font-semibold" style={{ background: ESTADO[u.estado].fondo, color: ESTADO[u.estado].color }}>
            {ESTADO[u.estado].texto}
          </span>
        )}
      </div>

      {u?.estado === 'firmado' && (
        <p className="mt-4 flex items-start gap-2 rounded-xl p-3 font-inter text-xs" style={{ background: '#F4FAF5', color: '#24481a' }}>
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>
            Firmado por <strong>{u.firmante}</strong> el {fechaHora(u.firmadoEn!)}.
            {u.pdfSha256 && <span className="block break-all opacity-70">Huella del PDF: {u.pdfSha256}</span>}
          </span>
        </p>
      )}

      {problemas.length > 0 && !(u?.estado === 'firmado') && (
        <div className="mt-4 rounded-xl p-3 font-inter text-xs" style={{ background: '#FFFBEB', color: '#78350F', border: '1px solid #FDE68A' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={14} /> Falta completar antes de enviar:
            </p>
            <button type="button" onClick={revisar} disabled={revisando} className="inline-flex items-center gap-1 font-semibold underline disabled:opacity-50">
              {revisando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Volver a revisar
            </button>
          </div>
          <ul className="mt-1 list-disc pl-5">
            {problemas.map(p => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/reservas/${opportunityId}/contrato`}
          className={boton}
          style={{ border: `1px solid ${BORDER}`, color: NAVY }}
        >
          <Eye size={14} /> Vista previa
        </Link>

        {u?.estado === 'firmado' ? (
          <>
            <a href={`/admin/contratos/${u.id}/pdf`} target="_blank" rel="noopener noreferrer" className={boton} style={{ background: ACCENT, color: '#fff' }}>
              <FileSignature size={14} /> Ver PDF firmado
            </a>
            <button type="button" onClick={reenviarCopia} disabled={ocupado !== null} className={boton} style={{ border: `1px solid ${BORDER}`, color: NAVY }}>
              {ocupado === 'copia' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Reenviar copia firmada
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => correr('enviar')}
            disabled={ocupado !== null}
            className={boton}
            style={{ background: ACCENT, color: '#fff' }}
          >
            {ocupado === 'enviar' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {vigente ? 'Enviar versión nueva' : 'Enviar contrato para firma'}
          </button>
        )}

        {vigente && (
          <>
            <button type="button" onClick={() => correr('reenviar')} disabled={ocupado !== null} className={boton} style={{ border: `1px solid ${BORDER}`, color: NAVY }}>
              {ocupado === 'reenviar' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Reenviar aviso
            </button>
            <button type="button" onClick={() => correr('anular')} disabled={ocupado !== null} className={boton} style={{ border: '1px solid #FECDD3', color: '#BE123C' }}>
              {ocupado === 'anular' ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
              Anular
            </button>
          </>
        )}
      </div>

      {mensaje && (
        <p
          className="mt-3 rounded-xl px-3 py-2 font-inter text-xs"
          style={mensaje.tipo === 'ok' ? { background: '#F4FAF5', color: '#24481a' } : { background: '#FFF1F2', color: '#BE123C' }}
        >
          {mensaje.texto}
        </p>
      )}
    </section>
  )
}
