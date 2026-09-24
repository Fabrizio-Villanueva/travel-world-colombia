import type { Metadata } from 'next'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import { getDestinos } from '@/lib/destinos'
import { FormularioCotizacion } from '@/components/contacto/FormularioCotizacion'
import { SectionTag } from '@/components/ui/SectionTag'
import { SITE, WHATSAPP, SOCIALS, whatsappUrl } from '@/lib/site'
import { NuevaPestana } from '@/components/ui/NuevaPestana'

const esExterno = (href: string) => !href.startsWith('mailto:') && !href.startsWith('tel:')

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cotiza tu viaje gratis',
  description:
    `Solicita tu cotización gratuita. Agencia de viajes en Fusagasugá con más de ${SITE.reseñas} reseñas ⭐⭐⭐⭐⭐ — RNT 27287.`,
  alternates: { canonical: '/contacto' },
}

const contactItems = [
  {
    icon: Phone,
    label: 'WhatsApp',
    value: WHATSAPP.telefonoDisplay,
    href: whatsappUrl(),
  },
  {
    icon: Mail,
    label: 'Correo',
    value: SITE.email,
    href: `mailto:${SITE.email}`,
  },
  {
    icon: MapPin,
    label: 'Dirección',
    value: SITE.direccion,
    sub: `${SITE.ciudad}, ${SITE.region}`,
    href: SOCIALS.maps,
  },
  {
    icon: Clock,
    label: 'Horario',
    value: SITE.horario,
  },
]

export default async function ContactoPage() {
  const destinos = await getDestinos()

  return (
    <div className="tema-claro">
      {/* ── Hero strip ── */}
      <section
        className="tema-oscuro relative overflow-hidden pt-32 pb-16 px-6"
        style={{ background: 'linear-gradient(to bottom, rgba(13, 30, 60,0.98), var(--navy))' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--orange) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-6xl">
          <SectionTag className="mb-4">Contacto</SectionTag>
          <h1
            className="font-plus-jakarta text-4xl font-extrabold leading-tight sm:text-5xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Cotiza tu viaje{' '}
            <span style={{ color: 'var(--orange)' }}>gratis</span>
          </h1>
          <p
            className="mt-4 max-w-lg font-inter text-sm leading-relaxed sm:text-base"
            style={{ color: 'var(--text-dim)' }}
          >
            Cuéntanos a dónde quieres ir y en menos de 24 horas un asesor te contacta
            con una propuesta personalizada.
          </p>
        </div>
      </section>

      {/* ── Contenido principal ── */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_380px]">

          {/* Formulario */}
          <div>
            <h2
              className="mb-8 font-plus-jakarta text-xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              Formulario de cotización
            </h2>
            <FormularioCotizacion destinos={destinos} />
          </div>

          {/* Panel lateral info */}
          <aside className="flex flex-col gap-8">
            {/* Info de contacto */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
            >
              <h3
                className="mb-5 font-plus-jakarta text-sm font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                Información de contacto
              </h3>
              <ul className="flex flex-col gap-4">
                {contactItems.map(({ icon: Icon, label, value, sub, href }) => (
                  <li key={label} className="flex items-start gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
                    >
                      <Icon size={14} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-cinzel text-[9px] tracking-[0.3em] uppercase" style={{ color: 'var(--text-muted)' }}>
                        {label}
                      </p>
                      {href ? (
                        // mailto:/tel: abren la app del sistema: sin target _blank.
                        esExterno(href) ? (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            className="font-inter text-sm hover:underline" style={{ color: 'var(--text-primary)' }}>
                            {value}
                            <NuevaPestana />
                          </a>
                        ) : (
                          <a href={href} className="font-inter text-sm hover:underline" style={{ color: 'var(--text-primary)' }}>
                            {value}
                          </a>
                        )
                      ) : (
                        <p className="font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{value}</p>
                      )}
                      {sub && <p className="font-inter text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{sub}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Por qué elegirnos */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'color-mix(in srgb, var(--orange) 6%, transparent)', border: '1px solid var(--border-orange)' }}
            >
              <h3
                className="mb-4 font-plus-jakarta text-sm font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                ¿Por qué cotizar con nosotros?
              </h3>
              <ul className="flex flex-col gap-3">
                {[
                  'Sin costo ni compromiso',
                  'Respuesta en menos de 24 horas',
                  `+${SITE.familias} familias atendidas`,
                  'RNT 27287 — agencia certificada',
                  'Atención personalizada',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--orange)' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
