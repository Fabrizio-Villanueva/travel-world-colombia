'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, Loader2, Lock, Mail, MessageCircle, ShieldCheck, Timer } from 'lucide-react'
import { pedirCodigo, verificar } from './actions'

/**
 * Entrada al portal con código de un solo uso (auditoría 2026-10-03 #2):
 *  1. El cliente pide el código por WhatsApp (o correo). Nunca se envía solo
 *     al abrir: las vistas previas de WhatsApp abren los enlaces.
 *  2. Escribe los 6 dígitos (se envía solo al completar el sexto).
 * Debajo, las tres garantías de seguridad.
 */

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.08)'
const PAGE = '#F4F7FB'
const ACCENT = '#2957A4'
const LARGO = 6

type Canal = 'whatsapp' | 'email'

export function Verificacion({
  token,
  nombreViaje,
  telefonoFinal,
}: {
  token: string
  nombreViaje: string | null
  telefonoFinal: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [paso, setPaso] = useState<'pedir' | 'codigo'>('pedir')
  const [canal, setCanal] = useState<Canal>('whatsapp')
  const [destino, setDestino] = useState('')
  const [codigo, setCodigo] = useState('')
  const [foco, setFoco] = useState(false)
  const [ocupado, setOcupado] = useState<null | 'pedir' | 'verificar'>(null)
  const [error, setError] = useState<string | null>(null)
  const [espera, setEspera] = useState(0)

  // Cuenta regresiva para "Reenviar".
  useEffect(() => {
    if (espera <= 0) return
    const t = window.setTimeout(() => setEspera(e => e - 1), 1000)
    return () => window.clearTimeout(t)
  }, [espera])

  async function pedir(c: Canal) {
    if (ocupado) return
    setOcupado('pedir')
    setError(null)
    try {
      const r = await pedirCodigo(token, c)
      if (!r.ok) return setError(r.error)
      setCanal(r.datos.canal)
      setDestino(r.datos.destino)
      setEspera(r.datos.esperar)
      setCodigo('')
      setPaso('codigo')
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch {
      setError('No pudimos enviar el código. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  async function enviar(valor = codigo) {
    if (valor.length !== LARGO || ocupado) return
    setOcupado('verificar')
    setError(null)
    try {
      const r = await verificar(token, valor)
      if (!r.ok) {
        setError(r.error)
        setCodigo('')
        inputRef.current?.focus()
        return
      }
      // La cookie ya quedó puesta: el servidor renderiza el portal.
      router.refresh()
    } catch {
      setError('No pudimos verificar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  function cambiar(v: string) {
    const limpio = v.replace(/\D/g, '').slice(0, LARGO)
    setCodigo(limpio)
    if (limpio.length === LARGO) void enviar(limpio)
  }

  const otro: Canal = canal === 'whatsapp' ? 'email' : 'whatsapp'

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[24px] bg-white p-6 sm:p-8" style={{ border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(13,30,60,0.04)' }}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#EDF3FC', color: ACCENT }}>
          <ShieldCheck size={28} strokeWidth={1.8} />
        </span>
        <h1 className="mt-5 font-plus-jakarta text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: NAVY }}>
          Documentos de tu viaje
        </h1>
        {nombreViaje && (
          <p className="mt-1 font-inter text-sm" style={{ color: MUTED }}>
            {nombreViaje}
          </p>
        )}

        {paso === 'pedir' ? (
          <>
            <p className="mt-4 font-inter text-[15px] leading-relaxed" style={{ color: NAVY }}>
              Para proteger tu información te enviaremos un <strong>código de 6 dígitos</strong> a tu WhatsApp terminado
              en <strong className="tabular-nums">{telefonoFinal}</strong>.
            </p>
            {error && <Error texto={error} />}
            <button
              type="button"
              onClick={() => pedir('whatsapp')}
              disabled={ocupado !== null}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {ocupado === 'pedir' ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
              Enviarme el código por WhatsApp
            </button>
            <button
              type="button"
              onClick={() => pedir('email')}
              disabled={ocupado !== null}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white font-inter text-[14px] font-medium disabled:opacity-50"
              style={{ border: `1px solid ${BORDER}`, color: NAVY }}
            >
              <Mail size={16} /> Prefiero recibirlo por correo
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 font-inter text-[15px] leading-relaxed" style={{ color: NAVY }}>
              Te enviamos un código por {canal === 'whatsapp' ? 'WhatsApp al número' : 'correo a'}{' '}
              <strong className="tabular-nums">{destino}</strong>. Escríbelo aquí:
            </p>

            <form
              onSubmit={e => {
                e.preventDefault()
                void enviar()
              }}
              className="mt-6"
            >
              <label className="relative block" onClick={() => inputRef.current?.focus()}>
                <span className="sr-only">Código de 6 dígitos</span>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: LARGO }, (_, i) => {
                    const activa = foco && (codigo.length === i || (codigo.length === LARGO && i === LARGO - 1))
                    return (
                      <span
                        key={i}
                        className="flex h-14 items-center justify-center rounded-xl font-plus-jakarta text-2xl font-bold tabular-nums transition-all"
                        style={{
                          background: PAGE,
                          border: `2px solid ${activa ? ACCENT : BORDER}`,
                          color: NAVY,
                          boxShadow: activa ? '0 0 0 4px rgba(41,87,164,0.12)' : 'none',
                        }}
                      >
                        {codigo[i] ?? <span style={{ color: 'rgba(13,30,60,0.18)' }}>•</span>}
                      </span>
                    )
                  })}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={LARGO}
                  value={codigo}
                  onChange={e => cambiar(e.target.value)}
                  onFocus={() => setFoco(true)}
                  onBlur={() => setFoco(false)}
                  aria-label="Código de 6 dígitos"
                  className="absolute inset-0 h-full w-full opacity-0"
                  style={{ caretColor: 'transparent' }}
                />
              </label>

              {error && <Error texto={error} />}

              <button
                type="submit"
                disabled={codigo.length !== LARGO || ocupado !== null}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {ocupado === 'verificar' && <Loader2 size={18} className="animate-spin" />}
                {ocupado === 'verificar' ? 'Verificando…' : 'Entrar'}
              </button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2 font-inter text-[13px]">
              <button
                type="button"
                onClick={() => pedir(canal)}
                disabled={espera > 0 || ocupado !== null}
                className="font-medium disabled:opacity-50"
                style={{ color: ACCENT }}
              >
                {espera > 0 ? `Reenviar código en ${espera} s` : 'Reenviar código'}
              </button>
              <button
                type="button"
                onClick={() => pedir(otro)}
                disabled={espera > 0 || ocupado !== null}
                className="disabled:opacity-50"
                style={{ color: MUTED }}
              >
                {otro === 'email' ? 'Enviármelo por correo' : 'Enviármelo por WhatsApp'}
              </button>
            </div>
          </>
        )}

        <p className="mt-5 font-inter text-xs leading-relaxed" style={{ color: MUTED }}>
          ¿Cambiaste de número o no te llega? Escríbele a tu asesora para que actualice tus datos y te mande un enlace nuevo.
        </p>
      </section>

      <Garantias />
    </div>
  )
}

function Error({ texto }: { texto: string }) {
  return (
    <p className="mt-4 rounded-xl px-4 py-3 font-inter text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
      {texto}
    </p>
  )
}

/** Tres garantías, las mismas en la verificación y en el portal. */
export function Garantias() {
  const items = [
    { Icono: Lock, titulo: 'Cifrado', texto: 'Tus fotos viajan y se guardan cifradas.' },
    { Icono: EyeOff, titulo: 'Solo tu asesora', texto: 'Nadie más puede verlas; cada vista queda registrada.' },
    { Icono: Timer, titulo: '30 días', texto: 'Se borran solas después del regreso.' },
  ]
  return (
    <ul className="grid grid-cols-3 gap-2">
      {items.map(({ Icono, titulo, texto }) => (
        <li key={titulo} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 text-center" style={{ border: `1px solid ${BORDER}` }}>
          <Icono size={18} strokeWidth={1.8} style={{ color: ACCENT }} />
          <span className="font-inter text-[12px] font-semibold" style={{ color: NAVY }}>{titulo}</span>
          <span className="font-inter text-[10px] leading-snug" style={{ color: MUTED }}>{texto}</span>
        </li>
      ))}
    </ul>
  )
}
