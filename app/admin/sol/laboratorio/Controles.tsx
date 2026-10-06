'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cargarEscenariosBase, correrEscenarioAccion, nuevoChat } from './actions'

const boton = 'rounded-md px-4 py-2 font-plus-jakarta text-sm font-bold'
const primario = { background: 'var(--orange)', color: 'var(--orange-contrast)' } as const
const secundario = { border: '1px solid var(--border-orange)', color: 'var(--orange)' } as const

export function BotonNuevoChat() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  return (
    <span className="flex items-center gap-3">
      <button className={boton} style={{ ...primario, opacity: pending ? 0.6 : 1 }} disabled={pending}
        onClick={() => start(async () => {
          const r = await nuevoChat()
          if (r.corridaId) router.push(`/admin/sol/laboratorio/${r.corridaId}`)
          else setError(r.error)
        })}>
        {pending ? 'Abriendo…' : '💬 Nuevo chat de prueba (tú eres el cliente)'}
      </button>
      {error && <span className="font-inter text-xs" style={{ color: '#ef4444' }}>{error}</span>}
    </span>
  )
}

export function BotonCargarEscenarios() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string>()
  return (
    <span className="flex items-center gap-2">
      <button className={boton} style={{ ...secundario, opacity: pending ? 0.6 : 1 }} disabled={pending}
        onClick={() => start(async () => {
          const r = await cargarEscenariosBase()
          setMsg(r.error ?? r.ok)
          router.refresh()
        })}>
        {pending ? 'Cargando…' : 'Cargar escenarios base'}
      </button>
      {msg && <span className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>{msg}</span>}
    </span>
  )
}

export function BotonCorrer({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  return (
    <span className="flex flex-col items-end gap-1">
      <button className={boton} style={{ ...secundario, opacity: pending ? 0.6 : 1 }} disabled={pending}
        onClick={() => start(async () => {
          const r = await correrEscenarioAccion(id)
          if (r.corridaId) router.push(`/admin/sol/laboratorio/${r.corridaId}`)
          else setError(r.error)
        })}>
        {pending ? 'Conversando… (1-3 min)' : '▶ Correr'}
      </button>
      {error && <span className="font-inter text-xs" style={{ color: '#ef4444' }}>{error}</span>}
    </span>
  )
}

/** Corre los escenarios uno por uno (cada uno en su propia llamada, para no pasar el tiempo máximo). */
export function BotonCorrerTodos({ ids }: { ids: string[] }) {
  const router = useRouter()
  const [hechos, setHechos] = useState<number | null>(null)
  const [corriendo, setCorriendo] = useState(false)
  return (
    <button className={boton} style={{ ...primario, opacity: corriendo ? 0.6 : 1 }} disabled={corriendo}
      onClick={async () => {
        if (!confirm(`¿Correr los ${ids.length} escenarios? Tarda varios minutos y cuesta del orden de US$0,30-0,60 por escenario.`)) return
        setCorriendo(true)
        setHechos(0)
        for (let i = 0; i < ids.length; i++) {
          await correrEscenarioAccion(ids[i])
          setHechos(i + 1)
          router.refresh()
        }
        setCorriendo(false)
      }}>
      {corriendo ? `Corriendo ${hechos}/${ids.length}…` : '▶ Correr todos'}
    </button>
  )
}
