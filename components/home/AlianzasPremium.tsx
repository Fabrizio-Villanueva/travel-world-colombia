import Image from 'next/image'
import { SectionTag } from '@/components/ui/SectionTag'
import { Pausable } from '@/components/ui/Pausable'
import { HOTELES_CRUCEROS, AEROLINEAS, type Alianza } from '@/lib/alianzas'

/** Una marca dentro del carrusel — logo optimizado o wordmark de texto. */
function LogoItem({ alianza, copia = false }: { alianza: Alianza; copia?: boolean }) {
  return (
    // La copia del loop se oculta a lectores de pantalla (no repetir la lista).
    <li className="alianza-item shrink-0" aria-hidden={copia || undefined}>
      {alianza.logo ? (
        <Image
          src={alianza.logo}
          alt={alianza.alt}
          width={160}
          height={64}
          className="alianza-logo h-12 w-auto object-contain sm:h-14"
          draggable={false}
        />
      ) : (
        <span
          className="alianza-wordmark font-plus-jakarta text-lg font-bold whitespace-nowrap sm:text-xl"
          aria-label={alianza.alt}
        >
          {alianza.nombre}
        </span>
      )}
    </li>
  )
}

/** Una fila del marquee. La lista se duplica para un loop continuo y sin saltos. */
function MarqueeRow({
  items,
  direction,
}: {
  items: Alianza[]
  direction: 'left' | 'right'
}) {
  // Duplicamos los ítems: la animación traslada exactamente el 50% del track,
  // de modo que el segundo set toma el lugar del primero sin discontinuidad.
  const doubled = [...items, ...items]

  return (
    <div className="marquee">
      <ul
        className={`marquee-track ${direction === 'left' ? 'marquee-left' : 'marquee-right'}`}
      >
        {doubled.map((a, i) => (
          <LogoItem key={`${a.nombre}-${i}`} alianza={a} copia={i >= items.length} />
        ))}
      </ul>
    </div>
  )
}

export function AlianzasPremium() {
  return (
    <section
      aria-labelledby="alianzas-title"
      className="overflow-hidden px-6 py-16"
      style={{ background: 'var(--bg-alt)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <SectionTag className="mb-3">Respaldo internacional</SectionTag>
          <h2
            id="alianzas-title"
            className="font-plus-jakarta text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Nuestras alianzas premium
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl font-inter text-sm leading-relaxed"
            style={{ color: 'var(--text-dim)' }}
          >
            Trabajamos directamente con las mejores cadenas hoteleras, líneas de
            crucero y aerolíneas del mundo para ofrecerte tarifas exclusivas.
          </p>
        </div>

        <Pausable clasePausado="marquee-pausado" etiqueta="carrusel de alianzas">
          <div className="flex flex-col gap-6">
            <MarqueeRow items={HOTELES_CRUCEROS} direction="left" />
            <MarqueeRow items={AEROLINEAS} direction="right" />
          </div>
        </Pausable>
      </div>
    </section>
  )
}
