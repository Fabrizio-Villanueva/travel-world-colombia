import { ChevronDown } from 'lucide-react'

/**
 * Encabezado de un paso del flujo principal del Generador (1. documentos →
 * 2. contrato). Con `plegable` el contenido va en un <details> que la asesora
 * abre o cierra; sin él, el contenido queda siempre a la vista.
 */

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const ACCENT = '#2957A4'

export function PasoFlujo({
  n,
  titulo,
  descripcion,
  estado,
  plegable = false,
  abierto = true,
  children,
}: {
  n: number
  titulo: string
  descripcion: string
  /** Chip corto a la derecha (ej. "Documentos completos"). */
  estado?: { texto: string; color: string; fondo: string }
  plegable?: boolean
  abierto?: boolean
  children: React.ReactNode
}) {
  const cabecera = (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-plus-jakarta text-sm font-extrabold text-white"
        style={{ background: ACCENT }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-inter text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
          Paso {n}
        </p>
        <h2 className="font-plus-jakarta text-lg font-extrabold leading-tight" style={{ color: NAVY }}>
          {titulo}
        </h2>
        <p className="mt-0.5 font-inter text-xs" style={{ color: MUTED }}>
          {descripcion}
        </p>
      </div>
      {estado && (
        <span
          className="rounded-full px-3 py-1 font-inter text-xs font-semibold"
          style={{ background: estado.fondo, color: estado.color }}
        >
          {estado.texto}
        </span>
      )}
      {plegable && (
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform group-open:rotate-180"
          style={{ color: MUTED }}
        />
      )}
    </div>
  )

  if (!plegable) {
    return (
      <section className="mb-8">
        <div className="mb-3">{cabecera}</div>
        {children}
      </section>
    )
  }

  return (
    <details open={abierto} className="group mb-8">
      <summary className="mb-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">{cabecera}</summary>
      {children}
    </details>
  )
}
