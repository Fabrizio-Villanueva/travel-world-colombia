import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { Compass, ShieldCheck, Headset, Star, ArrowRight } from 'lucide-react'
import { SectionTag } from '@/components/ui/SectionTag'
import { Reveal } from '@/components/ui/Reveal'
import { SITE, SOCIALS } from '@/lib/site'
import { NuevaPestana } from '@/components/ui/NuevaPestana'

// Amarillo de marca fijo: dentro de las tarjetas azules --orange puede ser el
// MISMO azul (tema claro) y quedaba azul sobre azul (1:1). #FFCC29 sobre
// #2957A4 da 4,6:1.
const AMARILLO = '#FFCC29'

/* ─────────── Logo de Google (marca, SVG inline) ─────────── */
function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

/* ─────────── Fila de estrellas ─────────── */
function Stars({ size = 14, color = AMARILLO }: { size?: number; color?: string }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label="5 de 5 estrellas">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} style={{ color, fill: color }} aria-hidden />
      ))}
    </span>
  )
}

/* ─────────── Stack de avatares (fotos reales de viajeros) ─────────── */
function AvatarStack({ fotos, borderColor }: { fotos: string[]; borderColor: string }) {
  return (
    <div className="flex -space-x-3">
      {fotos.map((src, i) => (
        <Image
          key={src + i}
          src={src}
          // Decorativa: el texto "+N viajeros" de al lado ya da el dato.
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-cover"
          style={{ border: `2px solid ${borderColor}` }}
        />
      ))}
    </div>
  )
}

/* ─────────── Datos de las tarjetas ─────────── */
interface Card {
  icon: LucideIcon
  titulo: string
  descripcion: string
  quote: string
  autor: string
  fotos: string[]
}

// Avatares: el autor de cada reseña va primero, luego una mezcla de viajeros.
const V = (n: string) => `/img/viajeros/${n}.webp`

const CARDS: Card[] = [
  {
    icon: Compass,
    titulo: 'Especialistas en Destinos',
    descripcion:
      'Diseñamos tu viaje de principio a fin según lo que realmente quieres vivir. Te conectamos con el destino perfecto para ti y tu familia.',
    quote: 'Excelente agencia, nos acompañó en todo momento, muy cumplidos con el hotel y todo el itinerario.',
    autor: 'Laura R. — Cancún',
    fotos: [V('laura'), V('4'), V('5'), V('anca')],
  },
  {
    icon: ShieldCheck,
    titulo: 'Reservas 100% Seguras',
    descripcion:
      'Confirmamos cada hotel, traslado y experiencia directamente con los proveedores. Tu inversión está protegida en cada paso del proceso.',
    quote: 'Agencia seria, responsable y cumplida. Hemos viajado varias veces y siempre nos ha ido perfecto.',
    autor: 'Anca P. — Viajera frecuente',
    fotos: [V('anca'), V('jhon'), V('laura'), V('5')],
  },
  {
    icon: Headset,
    titulo: 'Acompañamiento 24/7',
    descripcion:
      'Desde el primer mensaje hasta tu regreso a casa, siempre hay un asesor disponible por WhatsApp. No viajas solo — viajas con respaldo real.',
    quote: 'Nos ayudaron con toda la documentación para migración. Estuvieron pendientes durante todo el viaje. 100% recomendada.',
    autor: 'Jhon A. — Estados Unidos',
    fotos: [V('jhon'), V('5'), V('4'), V('laura')],
  },
]

const GRADIENT_DIVIDER =
  'linear-gradient(90deg, transparent, var(--orange), var(--gold), transparent)'

/* ─────────── Componente ─────────── */
export function PorQueElegirnos() {
  return (
    <section
      aria-labelledby="porque-title"
      className="relative overflow-hidden px-6 py-20 md:py-28"
    >
      {/* Divisores con gradiente */}
      <div aria-hidden className="absolute left-0 top-0 h-px w-full opacity-50" style={{ background: GRADIENT_DIVIDER }} />
      <div aria-hidden className="absolute bottom-0 left-0 h-px w-full opacity-50" style={{ background: GRADIENT_DIVIDER }} />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center md:mb-20">
          <SectionTag className="mb-3">Por qué elegirnos</SectionTag>
          <h2
            id="porque-title"
            className="font-plus-jakarta text-3xl font-extrabold leading-tight sm:text-5xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Tu viaje soñado, en manos expertas.
          </h2>
          <p
            className="mx-auto mt-5 max-w-2xl font-inter text-base leading-relaxed sm:text-lg"
            style={{ color: 'var(--text-dim)' }}
          >
            Cada detalle de tu viaje está diseñado por especialistas que conocen cada
            destino. Desde la primera consulta hasta tu regreso a casa.
          </p>
        </div>

        {/* Grid de tarjetas */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((card, i) => {
            const featured = i === 0
            const Icon = card.icon
            const borderAvatar = featured ? 'var(--orange)' : 'var(--blue)'

            return (
              <Reveal key={card.titulo} delay={i * 120} className="h-full">
              <article
                className="porque-card flex h-full flex-col rounded-lg p-8"
                style={
                  featured
                    ? { background: 'var(--orange)' }
                    : { background: 'var(--blue)', border: '1px solid var(--border-orange)' }
                }
              >
                {/* Ícono */}
                <div
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-full"
                  style={
                    featured
                      ? { background: 'rgba(255,255,255,0.2)' }
                      : { background: 'color-mix(in srgb, var(--orange) 20%, transparent)' }
                  }
                >
                  <Icon size={24} style={{ color: featured ? '#fff' : AMARILLO }} strokeWidth={2} aria-hidden />
                </div>

                {/* Título + descripción */}
                <h3
                  className="mb-4 font-plus-jakarta text-xl font-extrabold leading-tight"
                  style={{ color: '#fff' }}
                >
                  {card.titulo}
                </h3>
                <p
                  className="mb-8 flex-grow font-inter text-sm leading-relaxed"
                  style={{ color: 'rgba(255,255,255,0.92)' }}
                >
                  {card.descripcion}
                </p>

                {/* Footer: avatares + reseña */}
                <div className="mt-auto">
                  <div className="mb-6 flex items-center gap-3">
                    <AvatarStack fotos={card.fotos} borderColor={borderAvatar} />
                    <span
                      className="font-plus-jakarta text-sm font-bold"
                      style={{ color: featured ? '#fff' : AMARILLO }}
                    >
                      +{SITE.reseñas} viajeros
                    </span>
                  </div>

                  <div
                    className="mb-6 h-px w-full"
                    style={{ background: featured ? 'rgba(255,255,255,0.3)' : 'var(--border-orange)' }}
                  />

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center rounded-full border border-white/20 bg-white p-1">
                        <GoogleG size={14} />
                      </span>
                      <Stars />
                    </div>
                    <p
                      className="font-inter text-sm italic leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.92)' }}
                    >
                      &ldquo;{card.quote}&rdquo;
                    </p>
                    <span className="mt-1 font-plus-jakarta text-sm font-bold" style={{ color: '#fff' }}>
                      {card.autor}
                    </span>
                  </div>
                </div>
              </article>
              </Reveal>
            )
          })}
        </div>

        {/* Trust bar inferior */}
        <div className="mt-16 flex flex-col items-center gap-4 text-center md:mt-20">
          <Stars size={22} color="var(--gold)" />
          <p className="font-inter text-base" style={{ color: 'var(--text-primary)' }}>
            Más de {SITE.reseñas} reseñas de 5 estrellas en Google · +{SITE.familias} familias atendidas
          </p>
          <a
            href={SOCIALS.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="porque-reviews-link mt-2 flex items-center gap-2 font-plus-jakarta text-sm font-semibold"
            style={{ color: 'var(--orange)' }}
          >
            <span className="flex items-center justify-center rounded-full border border-white/20 bg-white p-1.5">
              <GoogleG size={18} />
            </span>
            Ver todas las reseñas
            <ArrowRight size={15} aria-hidden />
            <NuevaPestana />
          </a>
        </div>
      </div>
    </section>
  )
}
