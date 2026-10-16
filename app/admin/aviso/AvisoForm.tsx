'use client'

import { useActionState, useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { AvisoSeguridad } from '@/components/layout/AvisoSeguridad'
import { numeroLegible, parsearNumeros } from '@/lib/aviso-seguridad-numeros'
import { guardarAviso, type AvisoState } from './actions'

const inputCls = 'w-full rounded-md px-3 py-2.5 font-inter text-sm outline-none'
const inputStyle = { background: 'white', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const

export function AvisoForm({ inicial, editable }: {
  inicial: { activo: boolean; popup: boolean; mensaje: string; numeros: string[] }
  editable: boolean
}) {
  const [state, formAction, pending] = useActionState<AvisoState, FormData>(guardarAviso, {})
  const [activo, setActivo] = useState(inicial.activo)
  const [popup, setPopup] = useState(inicial.popup)
  const [mensaje, setMensaje] = useState(inicial.mensaje)
  const [numeros, setNumeros] = useState(inicial.numeros.map(numeroLegible).join('\n'))
  const primero = parsearNumeros(numeros)[0]

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <p className="mb-2 font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>Así se ve arriba de todas las páginas</p>
        <div className="overflow-hidden rounded-md" style={{ border: '1px solid var(--border)', opacity: activo ? 1 : 0.45 }}>
          <AvisoSeguridad key={`${mensaje}|${primero}`} mensaje={mensaje || '…'} numero={primero ? numeroLegible(primero) : '…'} />
        </div>
        {!activo && <p className="mt-2 font-inter text-xs" style={{ color: '#b45309' }}>Apagada: no se muestra en la web.</p>}
      </section>

      <section className="flex flex-col gap-4 rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" name="activo" checked={activo} onChange={e => setActivo(e.target.checked)} disabled={!editable} />
          Mostrar la franja en todo el sitio
        </label>
        <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" name="popup" checked={popup} onChange={e => setPopup(e.target.checked)} disabled={!editable} />
          Mostrar el pop-up «Nuestras únicas cuentas y canales» al entrar (una vez por visita)
        </label>

        <label className="block">
          <span className="mb-1 block font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
            Mensaje (el número oficial y el enlace «Verifica un número aquí» se agregan solos)
          </span>
          <textarea name="mensaje" rows={3} maxLength={220} value={mensaje} onChange={e => setMensaje(e.target.value)} disabled={!editable} className={inputCls} style={inputStyle} />
          <span className="mt-1 block text-right font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>{mensaje.length}/220</span>
        </label>

        <label className="block">
          <span className="mb-1 block font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>
            Números oficiales de WhatsApp (uno por línea, con indicativo). El primero sale en la franja; todos cuentan como oficiales en el verificador.
          </span>
          <textarea name="numeros" rows={3} value={numeros} onChange={e => setNumeros(e.target.value)} disabled={!editable} className={inputCls} style={inputStyle} />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <a href="/verificar" target="_blank" rel="noreferrer" className="flex items-center gap-1 font-inter text-xs" style={{ color: 'var(--orange)' }}>
            Ver la página /verificar <ExternalLink size={13} />
          </a>
          {editable && (
            <button
              type="submit"
              disabled={pending}
              className="ml-auto rounded-md px-5 py-2.5 font-inter text-sm font-semibold"
              style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
        {state.error && <p className="font-inter text-sm" style={{ color: '#dc2626' }}>{state.error}</p>}
        {state.ok && <p className="flex items-center gap-1 font-inter text-sm" style={{ color: '#2e7d32' }}><Check size={15} /> Guardado. Ya se ve así en la web.</p>}
      </section>
    </form>
  )
}
