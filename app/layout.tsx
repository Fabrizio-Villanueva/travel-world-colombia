import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Cinzel, Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { PublicOnly } from '@/components/layout/PublicOnly'
import { Analytics, AnalyticsNoScript } from '@/components/analytics/Analytics'
import { FbPixelTracker } from '@/components/analytics/FbPixelTracker'
import { SITE, WHATSAPP, SOCIALS } from '@/lib/site'
import { jsonLd } from '@/lib/seo/jsonLd'
import { getDestinos } from '@/lib/destinos'
import { menuDestinos } from '@/lib/menuDestinos'

const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'TravelAgency',
  '@id': `${SITE.url}/#organization`,
  name: SITE.nombre,
  url: SITE.url,
  logo: `${SITE.url}/images/travel-world-colombia-logo.png`,
  image: `${SITE.url}/og-image.jpg`,
  description:
    `Agencia de viajes en Fusagasugá con más de ${SITE.reseñas} reseñas ⭐⭐⭐⭐⭐. Paquetes nacionales e internacionales todo incluido. RNT 27287.`,
  telephone: WHATSAPP.telefonoDisplay,
  email: SITE.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: SITE.direccion,
    addressLocality: SITE.ciudad,
    addressRegion: SITE.region,
    addressCountry: 'CO',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 4.3376,
    longitude: -74.3677,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '09:00',
      closes: '13:00',
    },
  ],
  sameAs: [
    SOCIALS.facebook,
    SOCIALS.instagram,
    SOCIALS.youtube,
    SOCIALS.tiktok,
  ],
  // aggregateRating + review se emiten aparte (OrganizationReviews), respaldados
  // con reseñas reales de la BD — evita un rating "auto-servido" sin reseñas.
  currenciesAccepted: 'COP, USD',
  paymentAccepted: 'Cash, Credit Card, Bank Transfer',
  priceRange: '$$',
  areaServed: {
    '@type': 'Country',
    name: 'Colombia',
  },
}

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-cinzel',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'Agencia de Viajes Fusagasugá | Travel World Colombia',
    template: '%s | Travel World Colombia',
  },
  description:
    `Agencia de viajes en Fusagasugá con más de ${SITE.reseñas} reseñas ⭐⭐⭐⭐⭐ Paquetes a todo el mundo. Cotiza gratis ✈️ RNT 27287.`,
  keywords: [
    'agencia de viajes fusagasugá',
    'paquetes de viaje colombia',
    'viajes internacionales colombia',
    'travel world colombia',
  ],
  openGraph: {
    siteName: 'Travel World Colombia',
    locale: 'es_CO',
    type: 'website',
    url: '/',
    title: 'Agencia de Viajes Fusagasugá | Travel World Colombia',
    description:
      `Agencia de viajes en Fusagasugá con más de ${SITE.reseñas} reseñas ⭐⭐⭐⭐⭐ Paquetes a todo el mundo. Cotiza gratis ✈️ RNT 27287.`,
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Travel World Colombia — Agencia de viajes en Fusagasugá',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agencia de Viajes Fusagasugá | Travel World Colombia',
    description:
      'Agencia de viajes en Fusagasugá. Paquetes nacionales e internacionales todo incluido. Cotiza gratis. RNT 27287.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Menú "Destinos" del navbar con destinos reales (mismo criterio que
  // /destinos: sin cruceros). getDestinos está cacheado por request, así que en
  // las páginas que ya lo consultan no agrega viajes extra a Supabase.
  const destinosMenu = menuDestinos((await getDestinos()).filter(d => !d.es_crucero))

  return (
    <html
      lang="es"
      // Next 16 ya no anula el scroll-behavior:smooth global (globals.css) al
      // navegar, lo que rompía el scroll a anclas (#id) entre páginas; este
      // atributo restaura el override recomendado por la guía de migración.
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${cinzel.variable} ${inter.variable}`}
    >
      <body className="min-h-screen antialiased">
        {/* Saltar al contenido — primer elemento focuseable, visible solo al tabular */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:font-plus-jakarta focus:text-sm focus:font-bold focus:text-white focus:outline-2"
          style={{ background: '#0d1e3c', outlineColor: '#FFCC29' }}
        >
          Saltar al contenido
        </a>
        {/* Tracking solo en el sitio público — el panel /admin no debe
            alimentar píxel ni GTM (ensuciaría públicos y estadísticas). */}
        <PublicOnly>
          <Analytics />
          <AnalyticsNoScript />
          <FbPixelTracker />
        </PublicOnly>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(schemaOrg) }}
        />
        <PublicOnly><Navbar destinosMenu={destinosMenu} /></PublicOnly>
        <main id="contenido">{children}</main>
        <PublicOnly><Footer /></PublicOnly>
        <PublicOnly><WhatsAppButton /></PublicOnly>
      </body>
    </html>
  )
}
