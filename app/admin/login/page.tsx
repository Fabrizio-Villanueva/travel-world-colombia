'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signIn, type LoginState } from '../actions'

const initial: LoginState = {}

const inputStyle = {
  background: '#fff',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#0d1e3c',
} as const

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initial)
  // ?next= (lo pone el proxy): volver a la página que se pidió, p. ej. el
  // enlace de documentos del CRM. El servidor valida que sea del panel.
  function entrar(formData: FormData) {
    formData.set('next', new URLSearchParams(window.location.search).get('next') ?? '')
    action(formData)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form
        action={entrar}
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#16315f', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 60px -24px rgba(13, 30, 60,0.45)' }}
      >
        <h1 className="mb-1 font-plus-jakarta text-2xl font-extrabold" style={{ color: '#fff' }}>
          Panel de administración
        </h1>
        <p className="mb-6 font-inter text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Travel World Colombia
        </p>

        <label className="mb-1 block font-inter text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Email</label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mb-4 w-full rounded-md px-3 py-2 font-inter text-sm outline-none"
          style={inputStyle}
        />

        <label className="mb-1 block font-inter text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Contraseña</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mb-6 w-full rounded-md px-3 py-2 font-inter text-sm outline-none"
          style={inputStyle}
        />

        {state.error && (
          <p className="mb-4 font-inter text-xs" style={{ color: '#fca5a5' }}>{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md px-4 py-2.5 font-plus-jakarta text-sm font-bold uppercase tracking-wide"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="mt-5 text-center font-inter text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          <Link href="/admin/recuperar" style={{ color: 'var(--orange)' }}>¿Olvidaste tu contraseña?</Link>
        </p>

        <p className="mt-2 text-center font-inter text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          ¿No tienes cuenta?{' '}
          <Link href="/admin/registro" style={{ color: 'var(--orange)' }}>Crear cuenta</Link>
        </p>
      </form>
    </div>
  )
}
