'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, Download, Eraser, Loader2, PenLine, ShieldCheck } from 'lucide-react'
import { Gracias } from '@/app/documentos/[token]/Gracias'
import { firmar } from './actions'
import { PantallaFirmando } from './PantallaFirmando'

/**
 * Recuadro de firma al final del contrato: nombre, documento, trazo con el
 * dedo (o el mouse), casilla de aceptación y botón. Mientras el cliente lee,
 * un botón flotante lo lleva a firmar; se oculta al llegar al recuadro.
 * Al firmar: pantalla animada mientras se sella y se genera el PDF, y luego
 * el agradecimiento (mismo lenguaje visual que el portal de documentos).
 */

/** Tiempo mínimo de la animación de firma, para que se vea completa. */
const MIN_ANIMACION_MS = 2800

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.12)'
const ACCENT = '#2957A4'

export function Firmar({
  token,
  nombreInicial,
  documentoInicial,
}: {
  token: string
  nombreInicial: string
  documentoInicial: string
}) {
  const router = useRouter()
  const tarjeta = useRef<HTMLElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const [trazos, setTrazos] = useState(0)
  const [nombre, setNombre] = useState(nombreInicial)
  const [documento, setDocumento] = useState(documentoInicial)
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verTarjeta, setVerTarjeta] = useState(false)
  const [firmado, setFirmado] = useState(false)

  // El botón flotante desaparece cuando el recuadro de firma está a la vista.
  useEffect(() => {
    const el = tarjeta.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVerTarjeta(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Lienzo nítido en pantallas retina: tamaño interno = CSS × devicePixelRatio.
  useEffect(() => {
    const c = lienzo.current
    if (!c) return
    let ancho = 0
    const ajustar = () => {
      const r = c.getBoundingClientRect()
      // En celular la barra del navegador cambia el alto al hacer scroll:
      // solo se reinicia (y borra) si de verdad cambió el ancho.
      if (Math.round(r.width) === ancho) return
      ancho = Math.round(r.width)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      const ctx = c.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2.4
      ctx.strokeStyle = NAVY
      setTrazos(0)
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Algunos navegadores no permiten capturar (p. ej. lápiz ya liberado): se dibuja igual.
    }
    dibujando.current = true
    ultimo.current = punto(e)
    const ctx = e.currentTarget.getContext('2d')!
    ctx.beginPath()
    ctx.arc(ultimo.current.x, ultimo.current.y, 1.1, 0, Math.PI * 2)
    ctx.fillStyle = NAVY
    ctx.fill()
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || !ultimo.current) return
    const p = punto(e)
    const ctx = e.currentTarget.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(ultimo.current.x, ultimo.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ultimo.current = p
  }

  function terminar() {
    if (dibujando.current) setTrazos(t => t + 1)
    dibujando.current = false
    ultimo.current = null
  }

  function borrar() {
    const c = lienzo.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setTrazos(0)
  }

  const listo = trazos > 0 && acepto && nombre.trim().length >= 5 && documento.replace(/\D/g, '').length >= 5

  async function enviar() {
    if (!listo || enviando || !lienzo.current) return
    setEnviando(true)
    setError(null)
    try {
      const [r] = await Promise.all([
        firmar(token, { firmaPng: lienzo.current.toDataURL('image/png'), nombre, documento, acepto }),
        new Promise(res => window.setTimeout(res, MIN_ANIMACION_MS)),
      ])
      if (!r.ok) {
        setError(r.error)
        return
      }
      setFirmado(true)
    } catch {
      setError('No pudimos registrar tu firma. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <section
        ref={tarjeta}
        id="firmar"
        className="mx-auto mt-6 max-w-[816px] rounded-none bg-white p-5 sm:rounded-[24px] sm:p-8"
        style={{ border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(13,30,60,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: '#EDF3FC', color: ACCENT }}>
            <PenLine size={22} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-plus-jakarta text-xl font-extrabold" style={{ color: NAVY }}>
              Firma tu contrato
            </h2>
            <p className="font-inter text-[13px]" style={{ color: MUTED }}>
              Revisa tus datos, firma en el recuadro y confirma.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-inter text-[12px] font-semibold" style={{ color: MUTED }}>Nombre completo</span>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              autoComplete="name"
              className="mt-1 h-11 w-full rounded-xl px-3 font-inter text-[15px] outline-none focus:ring-2"
              style={{ border: `1px solid ${BORDER}`, color: NAVY }}
            />
          </label>
          <label className="block">
            <span className="font-inter text-[12px] font-semibold" style={{ color: MUTED }}>Documento de identidad</span>
            <input
              value={documento}
              onChange={e => setDocumento(e.target.value)}
              placeholder="CC 1.023.456.789"
              className="mt-1 h-11 w-full rounded-xl px-3 font-inter text-[15px] outline-none focus:ring-2"
              style={{ border: `1px solid ${BORDER}`, color: NAVY }}
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="font-inter text-[12px] font-semibold" style={{ color: MUTED }}>Tu firma</span>
            <button
              type="button"
              onClick={borrar}
              disabled={trazos === 0}
              className="inline-flex items-center gap-1 font-inter text-[12px] font-medium disabled:opacity-40"
              style={{ color: ACCENT }}
            >
              <Eraser size={13} /> Borrar
            </button>
          </div>
          <div className="relative mt-1">
            <canvas
              ref={lienzo}
              onPointerDown={empezar}
              onPointerMove={mover}
              onPointerUp={terminar}
              onPointerCancel={terminar}
              onPointerLeave={terminar}
              aria-label="Recuadro para firmar con el dedo o el mouse"
              className="block h-44 w-full cursor-crosshair rounded-2xl"
              style={{ background: '#F8FAFD', border: `1.5px dashed ${trazos ? ACCENT : BORDER}`, touchAction: 'none' }}
            />
            {trazos === 0 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-inter text-[14px]" style={{ color: 'rgba(13,30,60,0.35)' }}>
                Firma aquí con tu dedo
              </span>
            )}
            <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b" style={{ borderColor: 'rgba(13,30,60,0.18)' }} />
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl p-4" style={{ background: '#F4F7FB' }}>
          <input
            type="checkbox"
            checked={acepto}
            onChange={e => setAcepto(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#2957A4]"
          />
          <span className="font-inter text-[13.5px] leading-relaxed" style={{ color: NAVY }}>
            Leí el contrato completo y <strong>acepto sus condiciones</strong>, la cláusula de responsabilidad y
            penalidades, y el tratamiento de mis datos personales. Entiendo que esta firma electrónica tiene la misma
            validez que mi firma manuscrita.
          </span>
        </label>

        {error && (
          <p className="mt-4 rounded-xl px-4 py-3 font-inter text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={!listo || enviando}
          className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-inter text-[16px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          {enviando ? 'Firmando y generando tu PDF…' : 'Firmar contrato'}
        </button>
        <p className="mt-3 text-center font-inter text-[11px]" style={{ color: MUTED }}>
          Guardaremos la fecha, la hora y el dispositivo como evidencia de tu firma.
        </p>
      </section>

      {enviando && <PantallaFirmando />}

      {firmado && (
        <Gracias
          nombre={nombre}
          etiqueta="Contrato firmado"
          mensaje="Tu contrato quedó firmado y guardado de forma segura. Tu asesora ya fue notificada y te acompañará en los siguientes pasos."
          principal={
            <a href={`/contrato/${token}/pdf`}>
              <Download size={18} /> Descargar mi copia en PDF
            </a>
          }
          textoBoton="Ver mi contrato firmado"
          onCerrar={() => router.refresh()}
        />
      )}

      {!verTarjeta && !firmado && (
        <a
          href="#firmar"
          className="fixed bottom-5 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 font-inter text-[14px] font-semibold text-white shadow-xl"
          style={{ background: ACCENT }}
        >
          <ArrowDown size={16} /> Ir a firmar
        </a>
      )}
    </>
  )
}
