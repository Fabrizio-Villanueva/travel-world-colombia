'use client'

import { useState } from 'react'
import { CircleCheck, OctagonAlert } from 'lucide-react'
import { normalizarNumero } from '@/lib/aviso-seguridad-numeros'

/** "¿Te escribieron de este número?": compara contra la lista oficial. */
export function Verificador({ oficiales }: { oficiales: string[] }) {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState<null | 'oficial' | 'falso'>(null)

  function verificar(e: React.FormEvent) {
    e.preventDefault()
    const n = normalizarNumero(texto)
    if (n.length < 7) return
    setResultado(oficiales.includes(n) ? 'oficial' : 'falso')
  }

  return (
    <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'var(--card-bg, white)', border: '1px solid var(--border)' }}>
      <form onSubmit={verificar} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Número que te contactó</span>
          <input
            type="tel"
            inputMode="tel"
            value={texto}
            onChange={e => { setTexto(e.target.value); setResultado(null) }}
            placeholder="Ej.: 300 123 4567"
            className="w-full rounded-md px-4 py-3 font-inter text-base outline-none"
            style={{ background: 'white', border: '1px solid var(--border)', color: '#0D1E3C' }}
          />
        </label>
        <button
          type="submit"
          className="rounded-md px-6 py-3 font-plus-jakarta text-sm font-bold"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
        >
          Verificar número
        </button>
      </form>

      {resultado === 'oficial' && (
        <p role="status" className="mt-4 flex items-start gap-2.5 rounded-md p-4 font-inter text-sm" style={{ background: '#E7F5EA', color: '#1B5E20' }}>
          <CircleCheck size={20} className="shrink-0" aria-hidden />
          <span><strong>Sí, es nuestro número oficial.</strong> Aun así, paga solo a las cuentas a nombre de Vamos Por Más S.A.S. que aparecen en Pagos.</span>
        </p>
      )}
      {resultado === 'falso' && (
        <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-md p-4 font-inter text-sm" style={{ background: '#FDECEC', color: '#8E1B1B' }}>
          <OctagonAlert size={20} className="shrink-0" aria-hidden />
          <span>
            <strong>Este número NO es de Travel World Colombia.</strong> No envíes dinero ni datos personales. Escríbenos a nuestro
            WhatsApp oficial para confirmar cualquier oferta.
          </span>
        </p>
      )}
    </div>
  )
}
