import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'reputationhub.site' },
    ],
    // Solo WebP (sin AVIF) y menos anchos: cada combinación ancho×formato es
    // una transformación facturable en Vercel. Con AVIF+WebP y 8 anchos, una
    // sola foto podía costar 16 transformaciones. Las fotos de Storage ya van
    // en WebP comprimido y se sirven tal cual (ver components/ui/Foto.tsx), así
    // que por aquí solo pasan logos, placeholders y fotos locales.
    formats: ['image/webp'],
    deviceSizes: [640, 1080, 1920],
    imageSizes: [64, 128, 256, 384],
    // Cachea las imágenes ya optimizadas 30 días (menos recomputación en Vercel).
    minimumCacheTTL: 2_592_000,
  },
  async headers() {
    // CSP compartida; solo cambia frame-ancestors: el sitio público no se
    // embebe en ningún lado, pero /admin sí — es Custom Menu Link (iframe)
    // dentro de GHL, así que se permiten los dominios de la app de GHL.
    const csp = (frameAncestors: string) =>
      [
        "default-src 'self'",
        // Nota: 'unsafe-inline' en script-src se queda a propósito — los
        // nonces exigen render por request y matarían el ISR de todo el
        // sitio público (además GTM los necesita en la práctica).
        // 'unsafe-eval' solo en dev: React lo usa para reconstruir
        // callstacks en desarrollo; en producción nunca.
        `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} *.googletagmanager.com *.facebook.net reputationhub.site`,
        "frame-src 'self' reputationhub.site *.google.com www.googletagmanager.com",
        "img-src * data: blob:",
        // Solo los backends que el navegador realmente contacta:
        // Supabase (lecturas públicas + subida de imágenes del panel),
        // GA4/GTM, beacons del Pixel de Meta y el widget de reseñas
        // de GHL (reputationhub/leadconnector).
        [
          "connect-src 'self'",
          '*.supabase.co',
          '*.google-analytics.com',
          '*.analytics.google.com',
          '*.googletagmanager.com',
          '*.facebook.com',
          '*.facebook.net',
          'reputationhub.site',
          '*.leadconnectorhq.com',
        ].join(' '),
        // next/font sirve las fuentes desde el propio dominio; los hosts
        // de Google Fonts ya no hacen falta.
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors ${frameAncestors}`,
      ].join('; ')

    const comunes = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ]

    return [
      {
        // Todo el sitio salvo /admin: sin framing de terceros.
        source: '/((?!admin).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          ...comunes,
          { key: 'Content-Security-Policy', value: csp("'self'") },
        ],
      },
      {
        // /admin: embebible SOLO desde GHL (Custom Menu Link). Sin
        // X-Frame-Options — no admite lista de dominios; frame-ancestors
        // es su reemplazo y todos los navegadores actuales lo respetan.
        //
        // Hosts EXACTOS, nunca comodines: *.gohighlevel.com y
        // *.leadconnectorhq.com alojan páginas de CUALQUIER cliente de GHL
        // (multi-tenant), y con cookies SameSite=None un tenant hostil podía
        // enmarcar el panel con la sesión viva de un admin (clickjacking).
        // Si el equipo entra por un dominio white-label propio, se agrega
        // aquí ese host exacto.
        source: '/admin/:path*',
        headers: [
          ...comunes,
          {
            key: 'Content-Security-Policy',
            value: csp(
              "'self' https://app.gohighlevel.com https://app.leadconnectorhq.com"
            ),
          },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
  async redirects() {
    // Mapa 301 del WordPress viejo (travelworldcolombia.com) → sitio nuevo.
    // Fuente: page-sitemap.xml + product-sitemap.xml del sitio viejo (ago 2026).
    // /cruceros existe en ambos sitios, no necesita redirección.
    const aDestinos = [
      '/caribe',
      '/europa',
      '/norte-america',
      '/sur-america',
      '/mexico',
      '/peru',
      '/otros-destinos',
      '/otros-destinos-internacionales',
      '/nuestros-destinos',
      '/viajes-nacionales-2',
      '/viajes-nacionales-2-2',
      '/viajes-nacionales-en-bus',
    ]
    const aServicios = ['/seguros-de-viaje', '/renta-autos']
    // /pagos ya NO redirige: la página se reconstruyó en el sitio nuevo (sep-2026).
    const aContacto = ['/contactanos']
    const aInicio = ['/tienda', '/carrito', '/mi-cuenta', '/finalizar-compra']
    // Páginas legales del WP viejo → sus equivalentes nuevas (slug limpio).
    const legales = [
      { source: '/politicas-de-sostenibilidad', destination: '/sostenibilidad' },
      { source: '/codigo-de-conducta-del-turista-responsable', destination: '/codigo-de-conducta' },
      { source: '/rnt-agencia-de-viajes-2025', destination: '/rnt' },
      { source: '/politica-de-privaciadad', destination: '/privacidad' },
      { source: '/politicas-y-condiciones', destination: '/terminos-y-condiciones' },
    ]

    return [
      ...aDestinos.map(source => ({ source, destination: '/destinos', permanent: true })),
      ...aServicios.map(source => ({ source, destination: '/servicios', permanent: true })),
      ...aContacto.map(source => ({ source, destination: '/contacto', permanent: true })),
      { source: '/somos', destination: '/nosotros', permanent: true },
      ...legales.map(r => ({ ...r, permanent: true })),
      ...aInicio.map(source => ({ source, destination: '/', permanent: true })),
      { source: '/producto/:path*', destination: '/', permanent: true },
      {
        source: '/wp-admin/:path*',
        destination: '/',
        permanent: false,
      },
      {
        source: '/wp-login.php',
        destination: '/',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
