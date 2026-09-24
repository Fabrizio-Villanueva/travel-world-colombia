import type { Metadata } from 'next'
import Image from 'next/image'
import { getDestinos } from '@/lib/destinos'
import { DestinosExplorador } from '@/components/destinos/DestinosExplorador'
import { SectionTag } from '@/components/ui/SectionTag'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Destinos de Viaje',
  description:
    'Explora todos nuestros destinos nacionales e internacionales. Paquetes todo incluido desde Fusagasugá. Cotiza gratis.',
  alternates: { canonical: '/destinos' },
}

export default async function DestinosPage() {
  // Los cruceros tienen su propia página (/cruceros); aquí solo destinos.
  const destinos = (await getDestinos()).filter(d => !d.es_crucero)

  return (
    <div className="tema-claro">
      {/* Hero */}
      <section className="tema-oscuro relative overflow-hidden pt-32 pb-16 px-6">
        {/* Mapa de rutas de fondo */}
        <Image
          src="/img/paginas/mapa-rutas-destinos-travel-world-colombia.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Overlay: oscurece la izquierda para el texto, revela el mapa a la derecha */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(13, 30, 60,0.96) 0%, rgba(13, 30, 60,0.8) 35%, rgba(13, 30, 60,0.5) 70%, rgba(13, 30, 60,0.2) 100%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl">
          <SectionTag className="mb-4">Explora el mundo</SectionTag>

          <h1
            className="font-plus-jakarta text-4xl font-extrabold leading-tight sm:text-6xl"
            style={{ color: 'var(--text-primary)', textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}
          >
            Todos nuestros
            <br />
            <span style={{ color: 'var(--orange)' }}>destinos</span>
          </h1>

          <p
            className="mt-5 max-w-lg font-inter text-sm leading-relaxed sm:text-base"
            style={{ color: 'var(--text-primary)', opacity: 0.9, textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}
          >
            {destinos.length} destinos seleccionados para ti. Nacionales e internacionales,
            con atención personalizada desde Fusagasugá.
          </p>
        </div>
      </section>

      {/* Lista + filtros */}
      <section className="px-6 py-14">
        <div className="mx-auto max-w-6xl">
          {/* Sin Suspense/useSearchParams a propósito: así el menú de
              categorías queda en el HTML estático; el ?f= se aplica en cliente. */}
          <DestinosExplorador destinos={destinos} />
        </div>
      </section>
    </div>
  )
}
