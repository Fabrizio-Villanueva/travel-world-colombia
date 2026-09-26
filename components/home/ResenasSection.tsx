import Script from 'next/script'
import { SectionTag } from '@/components/ui/SectionTag'
import { TextoRico } from '@/components/ui/TextoRico'
import { getTextosSitio, textoInicio } from '@/lib/textos'

export async function ResenasSection() {
  const T = await getTextosSitio()
  return (
    <section
      aria-labelledby="resenas-title"
      className="py-20 px-6"
      style={{ background: 'var(--bg-alt)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <SectionTag className="mb-3"><TextoRico texto={textoInicio(T, 'inicio.resenas.etiqueta')} /></SectionTag>
          <h2
            id="resenas-title"
            className="font-plus-jakarta text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            <TextoRico texto={textoInicio(T, 'inicio.resenas.titulo')} />
          </h2>
        </div>

        <Script
          src="https://reputationhub.site/reputation/assets/review-widget.js"
          strategy="lazyOnload"
        />
        <iframe
          className="lc_reviews_widget"
          src="https://reputationhub.site/reputation/widgets/review_widget/RMFUo0i4KOVl7eZHEn7s?widgetId=6a1da4d9fa32d9575fc393d4"
          frameBorder={0}
          scrolling="no"
          style={{ minWidth: '100%', width: '100%', border: 'none' }}
          title="Reseñas de clientes — Travel World Colombia"
        />
      </div>
    </section>
  )
}
