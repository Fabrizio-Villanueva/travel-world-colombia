'use client'

import { useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

type Tab = 'incluye' | 'no_incluye'
const TABS: Tab[] = ['incluye', 'no_incluye']

function TabBtn({ id, panelId, activa, label, onClick, onKeyDown, btnRef }: {
  id: string
  panelId: string
  activa: boolean
  label: string
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  btnRef: (el: HTMLButtonElement | null) => void
}) {
  return (
    <button
      ref={btnRef}
      id={id}
      type="button"
      role="tab"
      aria-selected={activa}
      aria-controls={panelId}
      // Roving tabindex: solo la pestaña activa entra en el orden de Tab;
      // entre pestañas se navega con flechas.
      tabIndex={activa ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="group relative pb-3 font-plus-jakarta text-sm font-bold uppercase tracking-widest transition-opacity"
      // Inactiva a 0.65 (antes 0.4 = 3,7:1 sobre navy; ahora ≥4.5:1).
      style={{ color: '#fff', opacity: activa ? 1 : 0.65 }}
    >
      {label}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 mx-auto block h-[3px] w-24 max-w-full rounded-sm transition-opacity"
        style={{ background: 'var(--orange)', opacity: activa ? 1 : 0 }}
      />
    </button>
  )
}

/**
 * "¿Qué incluye tu viaje?" con pestañas: INCLUYE / NO INCLUYE. La lista activa
 * se muestra en una tarjeta translúcida a dos columnas con checks verdes (o
 * equis rojas). Si una de las dos listas viene vacía, no se muestran pestañas
 * (y si solo hay "No incluye", se titula de forma visible: no basta la equis roja).
 * Patrón de pestañas WAI-ARIA: flechas ←/→, Inicio/Fin y roving tabindex.
 */
export function IncluyeTabs({ incluye = [], noIncluye = [] }: { incluye?: string[]; noIncluye?: string[] }) {
  const [tab, setTab] = useState<Tab>(incluye.length ? 'incluye' : 'no_incluye')
  const conTabs = incluye.length > 0 && noIncluye.length > 0
  const baseId = useId()
  const tabId = (t: Tab) => `${baseId}-tab-${t}`
  const panelId = `${baseId}-panel`
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ incluye: null, no_incluye: null })

  const items = tab === 'incluye' ? incluye : noIncluye
  const esIncluye = tab === 'incluye'
  // Dos columnas balanceadas conservando el orden (primera mitad a la izquierda).
  const mitad = Math.ceil(items.length / 2)
  const columnas = [items.slice(0, mitad), items.slice(mitad)]

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.indexOf(tab)
    let sig: Tab | null = null
    if (e.key === 'ArrowRight') sig = TABS[(i + 1) % TABS.length]
    else if (e.key === 'ArrowLeft') sig = TABS[(i - 1 + TABS.length) % TABS.length]
    else if (e.key === 'Home') sig = TABS[0]
    else if (e.key === 'End') sig = TABS[TABS.length - 1]
    if (!sig) return
    e.preventDefault()
    setTab(sig)
    refs.current[sig]?.focus()
  }

  return (
    <div>
      {conTabs && (
        <div role="tablist" aria-label="Qué incluye el paquete" className="mb-10 flex justify-center gap-12">
          <TabBtn
            id={tabId('incluye')}
            panelId={panelId}
            activa={tab === 'incluye'}
            label="Incluye"
            onClick={() => setTab('incluye')}
            onKeyDown={onKeyDown}
            btnRef={el => { refs.current.incluye = el }}
          />
          <TabBtn
            id={tabId('no_incluye')}
            panelId={panelId}
            activa={tab === 'no_incluye'}
            label="No incluye"
            onClick={() => setTab('no_incluye')}
            onKeyDown={onKeyDown}
            btnRef={el => { refs.current.no_incluye = el }}
          />
        </div>
      )}

      {/* Sin pestañas y solo con "No incluye": título visible. */}
      {!conTabs && !esIncluye && (
        <h3 className="mb-6 text-center font-plus-jakarta text-sm font-bold uppercase tracking-widest" style={{ color: '#fff' }}>
          No incluye
        </h3>
      )}

      <div
        id={panelId}
        role={conTabs ? 'tabpanel' : undefined}
        aria-labelledby={conTabs ? tabId(tab) : undefined}
        tabIndex={conTabs ? 0 : undefined}
        className="rounded-2xl p-8 md:p-12"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
          {columnas.map((col, c) => (
            <ul key={`${tab}-${c}`} className="space-y-6">
              {col.map(item => (
                <li key={item} className="flex items-start gap-4">
                  {esIncluye ? (
                    <Check size={20} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: '#4ade80' }} aria-hidden />
                  ) : (
                    <X size={20} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: '#f87171' }} aria-hidden />
                  )}
                  <span
                    className="font-inter text-[15px] leading-relaxed"
                    style={{ color: esIncluye ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)' }}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}
