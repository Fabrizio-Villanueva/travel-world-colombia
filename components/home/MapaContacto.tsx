import { MapPin, Clock, Phone, Mail } from 'lucide-react'
import { SITE, WHATSAPP, SOCIALS } from '@/lib/site'
import { SectionTag } from '@/components/ui/SectionTag'
import { Button } from '@/components/ui/Button'
import { whatsappUrl } from '@/lib/site'
import { NuevaPestana } from '@/components/ui/NuevaPestana'
import { TextoRico } from '@/components/ui/TextoRico'
import { getTextosSitio, textoInicio } from '@/lib/textos'

const esExterno = (href: string) => !href.startsWith('mailto:') && !href.startsWith('tel:')

const infoItems = [
  {
    icon: MapPin,
    label: 'Dirección',
    value: SITE.direccion,
    sub: `${SITE.ciudad}, ${SITE.region}, ${SITE.pais}`,
    href: SOCIALS.maps,
  },
  {
    icon: Clock,
    label: 'Horario',
    value: SITE.horario,
  },
  {
    icon: Phone,
    label: 'Teléfono / WhatsApp',
    value: WHATSAPP.telefonoDisplay,
    href: whatsappUrl(),
  },
  {
    icon: Mail,
    label: 'Correo electrónico',
    value: SITE.email,
    href: `mailto:${SITE.email}`,
  },
]

export async function MapaContacto() {
  const T = await getTextosSitio()
  const subtitulo = textoInicio(T, 'inicio.contacto.subtitulo')
  return (
    <section
      aria-labelledby="contacto-title"
      className="py-20 px-6"
      style={{ background: 'var(--bg-alt)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionTag className="mb-3"><TextoRico texto={textoInicio(T, 'inicio.contacto.etiqueta')} /></SectionTag>
          <h2
            id="contacto-title"
            className="font-plus-jakarta text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            <TextoRico texto={textoInicio(T, 'inicio.contacto.titulo')} />
          </h2>
          {subtitulo && (
            <p
              className="mx-auto mt-4 max-w-md font-inter text-sm leading-relaxed"
              style={{ color: 'var(--text-dim)' }}
            >
              <TextoRico texto={subtitulo} />
            </p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Mapa embed */}
          <div
            className="overflow-hidden rounded-lg"
            style={{ border: '1px solid var(--border)', minHeight: '360px' }}
          >
            <iframe
              title="Ubicación Travel World Colombia — C.C. Manila, Fusagasugá"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3978.0148!2d-74.3703131!3d4.3329312!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3f048d63482781%3A0x8529c56d8ed0e7f9!2sTRAVEL%20WORLD%20COLOMBIA%20Agencia%20de%20Viajes!5e0!3m2!1ses!2sco!4v1720000000000!5m2!1ses!2sco"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '360px', filter: 'invert(0.85) hue-rotate(180deg)' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Info de contacto */}
          <div className="flex flex-col justify-between gap-6">
            <ul className="flex flex-col gap-5">
              {infoItems.map(({ icon: Icon, label, value, sub, href }) => (
                <li key={label} className="flex items-start gap-4">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p
                      className="font-cinzel text-[9px] tracking-[0.3em] uppercase mb-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {label}
                    </p>
                    {href ? (
                      // mailto:/tel: abren la app del sistema: sin pestaña nueva.
                      esExterno(href) ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-inter text-sm transition-colors duration-200 hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {value}
                          <NuevaPestana />
                        </a>
                      ) : (
                        <a
                          href={href}
                          className="font-inter text-sm transition-colors duration-200 hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {value}
                        </a>
                      )
                    ) : (
                      <p className="font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                        {value}
                      </p>
                    )}
                    {sub && (
                      <p className="font-inter text-[12px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                        {sub}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="whatsapp" size="sm" href={whatsappUrl()}>
                Escribir por WhatsApp
              </Button>
              <Button variant="outline" size="sm" href={SOCIALS.maps}>
                Cómo llegar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
