'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, Loader2, Lock, ShieldCheck, Timer } from 'lucide-react'
import { verificar } from './actions'

/**
 * Pantalla de entrada: el cliente escribe los últimos 4 dígitos del celular
 * que tiene registrado la agencia (cuatro casillas tipo código). Varios
 * fallos bloquean el enlace un rato. Debajo, tres garantías de seguridad.
 */

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.08)'
const PAGE = '#F4F7FB'
const ACCENT = '#2957A4'

export function Verificacion({
  token,
  nombreViaje,
  bloqueadoMinutos,
}: {
  token: string
  nombreViaje: string | null
  bloqueadoMinutos: number
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [digitos, setDigitos] = useState('')
  const [foco, setFoco] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(
    bloqueadoMinutos > 0 ? `Por seguridad el enlace está bloqueado ${bloqueadoMinutos} minutos. Inténtalo después.` : null
  )
  const bloqueado = bloqueadoMinutos > 0

  async function enviar(valor = digitos) {
    if (valor.length !== 4 || enviando || bloqueado) return
    setEnviando(true)
    setError(null)
    try {
      const r = await verificar(token, valor)
      if (!r.ok) {
        setError(r.error)
        setDigitos('')
        inputRef.current?.focus()
        return
      }
      // La cookie ya quedó puesta: el servidor renderiza el portal.
      router.refresh()
    } catch {
      setError('No pudimos verificar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  function cambiar(v: string) {
    const limpio = v.replace(/\D/g, '').slice(0, 4)
    setDigitos(limpio)
    if (limpio.length === 4) void enviar(limpio)
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-[24px] bg-white p-6 sm:p-8"
        style={{ border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(13,30,60,0.04)' }}
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: '#EDF3FC', color: ACCENT }}
        >
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
        <p className="mt-4 font-inter text-[15px] leading-relaxed" style={{ color: NAVY }}>
          Confirma que eres tú: escribe los <strong>últimos 4 dígitos del celular</strong> con el que hablas con tu asesora.
        </p>

        {/* Cuatro casillas con un solo input invisible encima */}
        <form
          onSubmit={e => {
            e.preventDefault()
            void enviar()
          }}
          className="mt-6"
        >
          <label className="relative block" onClick={() => inputRef.current?.focus()}>
            <span className="sr-only">Últimos 4 dígitos del celular</span>
            <div className="grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => {
                const activa = foco && (digitos.length === i || (digitos.length === 4 && i === 3))
                return (
                  <span
                    key={i}
                    className="flex h-16 items-center justify-center rounded-2xl font-plus-jakarta text-3xl font-bold tabular-nums transition-all"
                    style={{
                      background: PAGE,
                      border: `2px solid ${activa ? ACCENT : BORDER}`,
                      color: NAVY,
                      boxShadow: activa ? '0 0 0 4px rgba(41,87,164,0.12)' : 'none',
                    }}
                  >
                    {digitos[i] ?? <span style={{ color: 'rgba(13,30,60,0.18)' }}>•</span>}
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
              maxLength={4}
              value={digitos}
              onChange={e => cambiar(e.target.value)}
              onFocus={() => setFoco(true)}
              onBlur={() => setFoco(false)}
              disabled={bloqueado}
              autoFocus
              aria-label="Últimos 4 dígitos del celular"
              className="absolute inset-0 h-full w-full opacity-0"
              style={{ caretColor: 'transparent' }}
            />
          </label>

          {error && (
            <p className="mt-4 rounded-xl px-4 py-3 font-inter text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={digitos.length !== 4 || enviando || bloqueado}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {enviando && <Loader2 size={18} className="animate-spin" />}
            {enviando ? 'Verificando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 font-inter text-xs leading-relaxed" style={{ color: MUTED }}>
          ¿Cambiaste de número? Escríbele a tu asesora para que actualice tu celular y te mande un enlace nuevo.
        </p>
      </section>

      <Garantias />
    </div>
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
        <li
          key={titulo}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 text-center"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <Icono size={18} strokeWidth={1.8} style={{ color: ACCENT }} />
          <span className="font-inter text-[12px] font-semibold" style={{ color: NAVY }}>{titulo}</span>
          <span className="font-inter text-[10px] leading-snug" style={{ color: MUTED }}>{texto}</span>
        </li>
      ))}
    </ul>
  )
}
