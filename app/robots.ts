import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/_next/` NO se bloquea: Googlebot necesita los assets y las
        // imágenes optimizadas para renderizar la página al indexarla.
        // /documentos/<token>: enlaces personales del portal de documentos
        // de viajeros (además llevan noindex en su layout).
        disallow: ['/admin/', '/api/', '/documentos/'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
