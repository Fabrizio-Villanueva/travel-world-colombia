import type { MetadataRoute } from 'next'
import { getDestinos } from '@/lib/destinos'
import { SITE } from '@/lib/site'
import { getPaginasPublicadas } from '@/lib/paginas-info'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const destinos = await getDestinos()
  const base = SITE.url
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${base}/destinos`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${base}/nosotros`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/contacto`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/pagos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // Páginas legales — poco cambio, prioridad baja
    ...['/sostenibilidad', '/codigo-de-conducta', '/rnt', '/privacidad', '/terminos-y-condiciones'].map(
      path => ({
        url: `${base}${path}`,
        lastModified: now,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      })
    ),
  ]

  const destinoRoutes: MetadataRoute.Sitemap = destinos.map(d => ({
    url: `${base}/destinos/${d.slug}`,
    lastModified: new Date(d.updated_at),
    changeFrequency: 'weekly' as const,
    priority: d.destacado ? 0.85 : 0.75,
  }))

  // Páginas del pie de página con texto publicado en el panel.
  const infoRoutes: MetadataRoute.Sitemap = [...(await getPaginasPublicadas()).values()].map(p => ({
    url: `${base}/info/${p.slug}`,
    lastModified: new Date(p.actualizado_en),
    changeFrequency: 'yearly' as const,
    priority: 0.3,
  }))

  return [...staticRoutes, ...destinoRoutes, ...infoRoutes]
}
