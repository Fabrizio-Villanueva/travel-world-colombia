import Image from '@/components/ui/Foto'
import type { ItinerarioDia } from '@/types/destino'

/**
 * Descripción de un día. Si el texto trae saltos de línea (una actividad por
 * línea, como se escribe en el panel), cada línea se muestra como un punto de
 * una lista con marcador — mucho más legible que el párrafo corrido. Si es un
 * solo párrafo, se muestra justificado como respaldo.
 */
function DescripcionDia({ texto }: { texto: string }) {
  const lineas = texto
    .split(/\n+/)
    .map(l => l.replace(/^[•\-–▪]\s*/, '').trim())
    .filter(Boolean)

  if (lineas.length <= 1) {
    return (
      <p
        className="mt-3 font-inter text-sm leading-relaxed sm:text-[15px]"
        style={{ color: 'var(--text-dim)', textAlign: 'justify', hyphens: 'auto' }}
      >
        {texto}
      </p>
    )
  }

  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {lineas.map((linea, i) => (
        <li
          key={i}
          className="flex gap-3 font-inter text-sm leading-relaxed sm:text-[15px]"
          style={{ color: 'var(--text-dim)' }}
        >
          <span
            aria-hidden
            className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--orange)' }}
          />
          <span className="min-w-0">{linea}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Itinerario día a día en filas: foto a la izquierda con la etiqueta del día
 * ("DÍA 03 · 11 NOV") superpuesta, y a la derecha el título con la descripción
 * en texto justificado. En móvil la foto va arriba y el texto debajo. Los días
 * sin foto ocupan todo el ancho con la etiqueta sobre el título. El número de
 * día sale de la posición en el array (como se cargan en el panel); la fecha
 * es opcional (solo salidas con fecha fija).
 */
export function ItinerarioTimeline({ dias }: { dias: ItinerarioDia[] }) {
  return (
    <ol
      className="itin-stack"
      style={{ '--n': dias.length } as React.CSSProperties}
    >
      {dias.map((dia, i) => {
        const etiquetaDia = `DÍA ${String(i + 1).padStart(2, '0')}${dia.fecha ? ` · ${dia.fecha}` : ''}`
        const chipDia = (extra = '') => (
          // Isla oscura dentro de la página clara: `tema-oscuro` hace que
          // var(--orange) resuelva al amarillo de marca (como en el mockup).
          <span
            className={`tema-oscuro rounded-md px-3.5 py-2 font-cinzel text-[11px] font-bold uppercase leading-none tracking-[0.18em] ${extra}`}
            style={{
              background: 'var(--navy)',
              color: 'var(--orange)',
              boxShadow: '0 10px 24px -10px rgba(13, 30, 60, 0.55)',
            }}
          >
            {etiquetaDia}
          </span>
        )

        return (
          <li
            key={i}
            className="itin-card-wrap"
            style={{ '--i': i, '--rev': dias.length - 1 - i } as React.CSSProperties}
          >
            <article
              className={`itin-card tema-oscuro ${dia.imagen ? 'grid gap-5 md:grid-cols-[minmax(0,300px)_1fr] md:items-start md:gap-8' : ''}`}
            >
              {/* Foto del día con la etiqueta superpuesta */}
              {dia.imagen && (
                <div className="relative">
                  <span className="absolute left-4 top-3 z-10 inline-flex">{chipDia()}</span>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                    <Image
                      src={dia.imagen}
                      alt={`Día ${i + 1} — ${dia.titulo}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Título + etiqueta opcional + descripción */}
              <div>
                {!dia.imagen && <span className="mb-3 inline-flex">{chipDia()}</span>}
                <h3
                  className="font-plus-jakarta text-xl font-bold leading-tight sm:text-2xl"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {dia.titulo}
                </h3>
                {dia.badge && (
                  <span
                    className="mt-2 inline-block rounded px-3 py-1 font-inter text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: 'color-mix(in srgb, var(--orange) 10%, transparent)', color: 'var(--orange)' }}
                  >
                    {dia.badge}
                  </span>
                )}
                {dia.descripcion && <DescripcionDia texto={dia.descripcion} />}
              </div>
            </article>
          </li>
        )
      })}
    </ol>
  )
}
