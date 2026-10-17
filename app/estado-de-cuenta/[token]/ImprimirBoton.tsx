'use client'

import { Printer } from 'lucide-react'

/** Imprimir o guardar como PDF desde el navegador. */
export function ImprimirBoton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-inter text-xs font-semibold print:hidden"
      style={{ border: '1px solid #D5DEEA', color: '#2957A4', background: 'white' }}
    >
      <Printer size={14} /> Guardar en PDF
    </button>
  )
}
