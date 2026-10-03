'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck, Smartphone } from 'lucide-react'
import { verificar } from './actions'

/**
 * Pantalla de entrada: el cliente escribe los últimos 4 dígitos del celular
 * que tiene registrado la agencia. Varios fallos bloquean el enlace un rato.
 */
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
  const [digitos, setDigitos] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(
    bloqueadoMinutos > 0
      ? `Por seguridad el enlace está bloqueado ${bloqueadoMinutos} minutos. Inténtalo después.`
      : null
  )

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (digitos.length !== 4 || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const r = await verificar(token, digitos)
      if (!r.ok) {
        setError(r.error)
        setDigitos('')
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

  return (
    <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid var(--border)' }}>
      <div className="mb-5 flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'rgba(41,87,164,0.1)', color: 'var(--orange)' }}
        >
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="font-plus-jakarta text-xl font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
            Documentos de tu viaje
          </h1>
          {nombreViaje && (
            <p className="mt-0.5 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
              {nombreViaje}
            </p>
          )}
        </div>
      </div>

      <p className="font-inter text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        Para proteger tu información, confirma que eres tú: escribe los{' '}
        <strong>últimos 4 dígitos del celular</strong> con el que hablas con tu asesora.
      </p>

      <form onSubmit={enviar} className="mt-5 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            <Smartphone size={13} /> Últimos 4 dígitos
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={4}
            value={digitos}
            onChange={e => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="• • • •"
            autoFocus
            className="w-full rounded-lg px-4 py-3 text-center font-inter text-2xl tracking-[0.6em] outline-none"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </label>

        {error && (
          <p className="rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fef2f2', color: '#b91c1c' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={digitos.length !== 4 || enviando || bloqueadoMinutos > 0}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-inter text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
        >
          {enviando && <Loader2 size={16} className="animate-spin" />}
          Entrar
        </button>
      </form>

      <p className="mt-4 font-inter text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        ¿Cambiaste de número? Escríbele a tu asesora para que actualice tu celular y te mande un enlace nuevo.
      </p>
    </div>
  )
}
