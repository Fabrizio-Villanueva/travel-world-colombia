import type { Metadata } from 'next'
import { preload } from 'react-dom'
import { getDestinos } from '@/lib/destinos'
import { heroBg } from '@/lib/hero'
import { HeroSection } from '@/components/hero/HeroSection'
import { TrustBar } from '@/components/home/TrustBar'
import { DestinosGrid } from '@/components/home/DestinosGrid'
import { ComoFunciona } from '@/components/home/ComoFunciona'
import { EquipoSection } from '@/components/equipo/EquipoSection'
import { PorQueElegirnos } from '@/components/home/PorQueElegirnos'
import { AlianzasPremium } from '@/components/home/AlianzasPremium'
import { ResenasSection } from '@/components/home/ResenasSection'
import { CTABanner } from '@/components/home/CTABanner'
import { MapaContacto } from '@/components/home/MapaContacto'
import { OrganizationReviews } from '@/components/seo/OrganizationReviews'
import { getTextosSitio, textoInicio } from '@/lib/textos'

export const revalidate = 1800 // home: revalidar cada 30 min

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function Home() {
  // Sin cruceros, igual que /destinos: los cruceros tienen su propia página.
  const destinos = (await getDestinos()).filter(d => !d.es_crucero)

  // Precarga la imagen LCP del hero (mismo destino que elige HeroSection por
  // defecto: primer destacado, o el primero). El hero es un background-image de
  // CSS, que el navegador descubre tarde; el preload adelanta su descarga.
  const heroPrincipal = destinos.find(d => d.destacado) ?? destinos[0]
  if (heroPrincipal) {
    preload(heroBg(heroPrincipal), { as: 'image', fetchPriority: 'high' })
  }

  // Títulos de sección editables en el panel. Las secciones de servidor los
  // leen solas; a los componentes de cliente se les pasan como props.
  const T = await getTextosSitio()
  const t = (clave: string) => textoInicio(T, clave)

  return (
    <div className="tema-claro">
      <HeroSection destinos={destinos} />
      <TrustBar />
      <DestinosGrid
        destinos={destinos}
        textos={{ etiqueta: t('inicio.destinos.etiqueta'), titulo: t('inicio.destinos.titulo'), subtitulo: t('inicio.destinos.subtitulo') }}
      />
      <ComoFunciona />
      <EquipoSection
        textos={{ etiqueta: t('inicio.equipo.etiqueta'), titulo: t('inicio.equipo.titulo'), subtitulo: t('inicio.equipo.subtitulo') }}
      />
      <PorQueElegirnos />
      <AlianzasPremium />
      <ResenasSection />
      <OrganizationReviews />
      <CTABanner />
      <MapaContacto />
    </div>
  )
}
