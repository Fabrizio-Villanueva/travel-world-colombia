import type { Metadata } from 'next'
import Image from 'next/image'
import Script from 'next/script'
import { Target, Eye, Award, Users, Star, Globe } from 'lucide-react'
import { SectionTag } from '@/components/ui/SectionTag'
import { Button } from '@/components/ui/Button'
import { EquipoSection } from '@/components/equipo/EquipoSection'
import { FaqSection } from '@/components/faq/FaqSection'
import { CountUp } from '@/components/ui/CountUp'
import { NuevaPestana } from '@/components/ui/NuevaPestana'
import { SITE, whatsappUrl } from '@/lib/site'
import { HOTELES_CRUCEROS, AEROLINEAS, type Alianza } from '@/lib/alianzas'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Nuestra Historia',
  description:
    `Conoce a Travel World Colombia — agencia de viajes en Fusagasugá con más de 14 años de experiencia, ${SITE.reseñas} reseñas ⭐⭐⭐⭐⭐ y RNT 27287. Misión, visión y equipo.`,
  alternates: { canonical: '/nosotros' },
}

/* ─────────── DATOS ESTÁTICOS ─────────── */

const STATS = [
  { icon: Star,   to: SITE.reseñas, prefix: '', suffix: '', label: 'reseñas 5 estrellas' },
  { icon: Users,  to: 1500, prefix: '+', suffix: '', label: 'familias atendidas' },
  { icon: Globe,  to: 500,  prefix: '+', suffix: '', label: 'destinos disponibles' },
  { icon: Award,  to: 14,   prefix: '+', suffix: '', label: 'años de experiencia' },
]

/* ─────────── COMPONENTES INTERNOS ─────────── */

function Divider() {
  return (
    <div className="mx-auto my-2 h-px w-16" style={{ background: 'var(--border-orange)' }} />
  )
}

function LogoCard({ alianza }: { alianza: Alianza }) {
  return (
    <div className="alianza-item shrink-0">
      {alianza.logo ? (
        <Image
          src={alianza.logo}
          alt={alianza.alt}
          width={160}
          height={64}
          className="alianza-logo h-9 w-auto object-contain sm:h-11"
          draggable={false}
        />
      ) : (
        <span
          className="alianza-wordmark font-plus-jakarta text-base font-bold whitespace-nowrap"
          aria-label={alianza.alt}
        >
          {alianza.nombre}
        </span>
      )}
    </div>
  )
}

/* ─────────── PAGE ─────────── */

export default function NosotrosPage() {
  return (
    <div className="tema-claro">
      {/* ── HERO ── */}
      <section className="tema-oscuro relative overflow-hidden pt-36 pb-24 px-6 text-center">
        {/* Imagen de fondo — paisaje andino del Sumapaz */}
        <Image
          src="/img/paginas/paisaje-andino-sumapaz-fusagasuga.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Overlay navy para legibilidad del texto */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8, 18, 38,0.92) 0%, rgba(8, 18, 38,0.66) 55%, rgba(8, 18, 38,0.45) 100%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-3xl">
          <SectionTag className="mb-4">Quiénes somos</SectionTag>
          <h1
            className="font-plus-jakarta text-4xl font-extrabold leading-tight sm:text-6xl"
            style={{ color: 'var(--text-primary)', textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}
          >
            Nuestra historia
          </h1>
          <Divider />
          <p
            className="mt-6 font-inter text-base leading-relaxed sm:text-lg"
            style={{ color: 'var(--text-primary)', opacity: 0.92, lineHeight: '1.75', textShadow: '0 1px 10px rgba(0,0,0,0.4)' }}
          >
            Hace más de 14 años nacimos en Fusagasugá con un sueño:
            ayudar a más personas a descubrir el mundo.
          </p>
        </div>
      </section>

      {/* ── STATS ── */}
      <section
        className="border-y px-6 py-12"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}
      >
        <ul className="mx-auto grid max-w-4xl gap-8 grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ icon: Icon, to, prefix, suffix, label }) => (
            <li key={label} className="flex flex-col items-center gap-2 text-center">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
              >
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <p className="font-plus-jakarta text-3xl font-extrabold" style={{ color: 'var(--orange)' }}>
                <CountUp to={to} prefix={prefix} suffix={suffix} />
              </p>
              <p className="font-cinzel text-xs tracking-[0.15em] uppercase text-center sm:text-sm" style={{ color: 'var(--text-dim)' }}>
                {label}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── HISTORIA ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <SectionTag className="mb-3">Más de 14 años</SectionTag>
            <h2
              className="font-plus-jakarta text-3xl font-bold sm:text-4xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Un sueño que sigue creciendo
            </h2>
          </div>

          <div
            className="space-y-6 font-inter text-base leading-relaxed sm:text-lg"
            style={{ color: 'rgba(13, 30, 60,0.82)', lineHeight: '1.8' }}
          >
            <p>
              Lo que comenzó como una agencia local, hoy nos ha permitido acompañar
              a miles de viajeros en experiencias por Colombia y destinos alrededor
              del mundo. Cada viaje ha sido una oportunidad para crecer, aprender y
              confirmar algo que seguimos creyendo: detrás de cada reserva hay una
              historia, un sueño y alguien que ha depositado su confianza en nosotros.
            </p>
            <p>
              Por eso, durante todos estos años hemos trabajado con un compromiso
              claro: crear experiencias de calidad, con cercanía, cumplimiento y el
              respaldo de un equipo que acompaña a cada viajero antes, durante y
              después de su aventura.
            </p>
            <p>
              Hoy seguimos creciendo desde el corazón del Sumapaz, con la misma
              emoción de nuestros primeros viajes y la mirada puesta en nuevos
              destinos, nuevas historias y muchos más sueños por cumplir.
            </p>
          </div>

          <p
            className="mt-10 text-center font-plus-jakarta text-xl font-extrabold sm:text-2xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Más de 14 años. Miles de viajeros.{' '}
            <span style={{ color: 'var(--orange)' }}>Un mundo entero por descubrir.</span>
          </p>
        </div>
      </section>

      {/* ── MISIÓN Y VISIÓN ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <SectionTag className="mb-3">Nuestro propósito</SectionTag>
            <h2
              className="font-plus-jakarta text-3xl font-bold sm:text-4xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Misión &amp; Visión
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Misión */}
            <div
              className="flex flex-col gap-5 rounded-xl p-8"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
              >
                <Target size={22} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-plus-jakarta text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Misión
                </h3>
                <p className="font-inter text-base leading-relaxed" style={{ color: 'rgba(13, 30, 60,0.82)', lineHeight: '1.8' }}>
                  Conectar a familias y viajeros colombianos con experiencias de viaje
                  excepcionales, ofreciendo asesoría personalizada, precios transparentes
                  y acompañamiento antes, durante y después de cada viaje. Somos el aliado
                  de confianza que convierte sueños en destinos reales.
                </p>
              </div>
            </div>

            {/* Visión */}
            <div
              className="flex flex-col gap-5 rounded-xl p-8"
              style={{
                background: 'color-mix(in srgb, var(--orange) 5%, transparent)',
                border: '1px solid var(--border-orange)',
              }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--orange) 15%, transparent)', color: 'var(--orange)' }}
              >
                <Eye size={22} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-plus-jakarta text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Visión
                </h3>
                <p className="font-inter text-base leading-relaxed" style={{ color: 'rgba(13, 30, 60,0.82)', lineHeight: '1.8' }}>
                  Ser la agencia de viajes de referencia en el Sumapaz y Cundinamarca,
                  reconocida a nivel nacional por la calidad de nuestro servicio, la
                  satisfacción de nuestros viajeros y nuestra capacidad de abrir el mundo
                  para cada colombiano, sin importar su presupuesto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EQUIPO ── */}
      <EquipoSection />

      {/* ── ALIADOS HOTELEROS ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <SectionTag className="mb-3">Aliados</SectionTag>
            <h2
              className="font-plus-jakarta text-3xl font-bold sm:text-4xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Cadenas hoteleras
            </h2>
            <p className="mt-3 font-inter text-base" style={{ color: 'rgba(13, 30, 60,0.82)' }}>
              Trabajamos directamente con las mejores cadenas del Caribe y Colombia
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {HOTELES_CRUCEROS.map(a => <LogoCard key={a.nombre} alianza={a} />)}
          </div>
        </div>
      </section>

      {/* ── AEROLÍNEAS ── */}
      <section
        className="px-6 py-16"
        style={{ background: 'var(--bg-alt)' }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <SectionTag className="mb-3">Aliados</SectionTag>
            <h2
              className="font-plus-jakarta text-3xl font-bold sm:text-4xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Aerolíneas aliadas
            </h2>
            <p className="mt-3 font-inter text-base" style={{ color: 'rgba(13, 30, 60,0.82)' }}>
              Acceso a tarifas especiales con las principales aerolíneas
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {AEROLINEAS.map(a => <LogoCard key={a.nombre} alianza={a} />)}
          </div>
        </div>
      </section>

      {/* ── RNT ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* RNT agencia de viajes */}
            <div
              className="flex flex-col items-center gap-6 rounded-xl p-10 text-center sm:items-start sm:text-left"
              style={{ background: 'color-mix(in srgb, var(--orange) 6%, transparent)', border: '1px solid var(--border-orange)' }}
            >
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--orange) 10%, transparent)', border: '1px solid var(--border-orange)' }}
              >
                <Award size={38} strokeWidth={1} style={{ color: 'var(--orange)' }} />
              </div>

              <div>
                <SectionTag className="mb-3">Registro Oficial</SectionTag>
                <h2
                  className="font-plus-jakarta text-2xl font-extrabold sm:text-3xl"
                  style={{ color: 'var(--text-primary)' }}
                >
                  RNT {SITE.rnt}
                </h2>
                <p
                  className="mt-3 font-inter text-base leading-relaxed"
                  style={{ color: 'rgba(13, 30, 60,0.82)', lineHeight: '1.75' }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Travel World Colombia Agencia de Viajes
                  </strong>{' '}
                  está registrada ante el{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Registro Nacional de Turismo
                  </strong>{' '}
                  como <strong>agencia de viajes</strong> bajo el número{' '}
                  <strong style={{ color: 'var(--orange)' }}>{SITE.rnt}</strong>, cumpliendo
                  con todos los requisitos legales exigidos por el Ministerio de Comercio,
                  Industria y Turismo de Colombia.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-start">
                  <span
                    className="rounded-full px-4 py-1.5 font-inter text-xs"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    <span aria-hidden="true">✓</span> Agencia legalmente constituida
                  </span>
                  <span
                    className="rounded-full px-4 py-1.5 font-inter text-xs"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    <span aria-hidden="true">✓</span> Certificado vigente
                  </span>
                </div>
                <a
                  href={SITE.rntVerificarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-inter text-sm font-semibold transition-opacity hover:opacity-85"
                  style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
                >
                  Verificar en el RUES <span aria-hidden="true">→</span>
                  <NuevaPestana />
                </a>
              </div>
            </div>

            {/* RNT mayorista de turismo */}
            <div
              className="flex flex-col items-center gap-6 rounded-xl p-10 text-center sm:items-start sm:text-left"
              style={{ background: 'color-mix(in srgb, var(--orange) 6%, transparent)', border: '1px solid var(--border-orange)' }}
            >
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--orange) 10%, transparent)', border: '1px solid var(--border-orange)' }}
              >
                <Award size={38} strokeWidth={1} style={{ color: 'var(--orange)' }} />
              </div>

              <div>
                <SectionTag className="mb-3">Registro Oficial</SectionTag>
                <h2
                  className="font-plus-jakarta text-2xl font-extrabold sm:text-3xl"
                  style={{ color: 'var(--text-primary)' }}
                >
                  RNT {SITE.rntMayorista}
                </h2>
                <p
                  className="mt-3 font-inter text-base leading-relaxed"
                  style={{ color: 'rgba(13, 30, 60,0.82)', lineHeight: '1.75' }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Travel World Mayorista de Turismo
                  </strong>{' '}
                  cuenta con un segundo registro ante el{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Registro Nacional de Turismo
                  </strong>{' '}
                  como <strong>agencia de viajes mayorista</strong> bajo el número{' '}
                  <strong style={{ color: 'var(--orange)' }}>{SITE.rntMayorista}</strong>,
                  que nos permite operar y distribuir planes turísticos a otras agencias
                  con pleno respaldo institucional.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-start">
                  <span
                    className="rounded-full px-4 py-1.5 font-inter text-xs"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    <span aria-hidden="true">✓</span> Mayorista de turismo
                  </span>
                  <span
                    className="rounded-full px-4 py-1.5 font-inter text-xs"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    <span aria-hidden="true">✓</span> Certificado vigente
                  </span>
                </div>
                <a
                  href={SITE.rntVerificarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-inter text-sm font-semibold transition-opacity hover:opacity-85"
                  style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
                >
                  Verificar en el RUES <span aria-hidden="true">→</span>
                  <NuevaPestana />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESEÑAS (mismo widget del home) ── */}
      <section
        aria-labelledby="resenas-nosotros-title"
        className="px-6 py-20"
        style={{ background: 'var(--bg-alt)' }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <SectionTag className="mb-3">Testimonios</SectionTag>
            <h2
              id="resenas-nosotros-title"
              className="font-plus-jakarta text-3xl font-bold sm:text-4xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Lo que dicen nuestros viajeros
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

      {/* ── PREGUNTAS FRECUENTES (acordeón + JSON-LD, desde el panel) ── */}
      <FaqSection />

      {/* ── CTA FINAL ── */}
      <section
        className="tema-oscuro relative overflow-hidden px-6 py-20"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--orange) 18%, transparent) 0%, rgba(13, 30, 60,0.95) 100%)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            borderTop: '1px solid var(--border-orange)',
            borderBottom: '1px solid var(--border-orange)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--orange) 0%, transparent 70%)' }}
        />

        <div className="relative mx-auto max-w-2xl text-center">
          <SectionTag className="mb-4">¿Listo para viajar?</SectionTag>
          <h2
            className="font-plus-jakarta text-3xl font-extrabold leading-tight sm:text-5xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Hagamos tu viaje
            <br />
            <span style={{ color: 'var(--orange)' }}>realidad</span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-md font-inter text-sm leading-relaxed"
            style={{ color: 'var(--text-dim)' }}
          >
            Más de {SITE.familias} familias ya viajaron con nosotros. Cotiza gratis y recibe
            una propuesta personalizada en menos de 24 horas.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button variant="whatsapp" href={whatsappUrl()}>
              Escribir por WhatsApp
            </Button>
            <Button variant="outline" href="/contacto">
              Formulario de cotización
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
