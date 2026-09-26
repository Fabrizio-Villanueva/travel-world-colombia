import type { Metadata } from 'next'
import Image from '@/components/ui/Foto'
import Script from 'next/script'
import { notFound } from 'next/navigation'
import { Clock, Users, ArrowRight, Quote, Star, FileText, Download, Eye, Tag } from 'lucide-react'
import { getDestino, getDestinos, getResenaDestino } from '@/lib/destinos'
import { InfoClaveCarousel } from '@/components/destinos/InfoClaveCarousel'
import { ItinerarioTimeline } from '@/components/destinos/ItinerarioTimeline'
import { IncluyeTabs } from '@/components/destinos/IncluyeTabs'
import { HospedajeShowcase } from '@/components/destinos/HospedajeShowcase'
import { SectionTag } from '@/components/ui/SectionTag'
import { Icono } from '@/components/ui/Icono'
import { Button } from '@/components/ui/Button'
import { NuevaPestana } from '@/components/ui/NuevaPestana'
import { SITE, whatsappUrl, whatsappReservaUrl, whatsappDudasUrl } from '@/lib/site'
import { jsonLd } from '@/lib/seo/jsonLd'
import { precioDesde } from '@/lib/precio'
import type { Destino } from '@/types/destino'

export const revalidate = 1800

interface Props {
  params: Promise<{ slug: string }>
}

/** "2.3 MB" / "850 KB" para los documentos adjuntos. */
function pesoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Prerenderiza en el build una página por cada viaje activo. Los viajes que se
 * activen después siguen funcionando: se generan bajo demanda la primera vez y
 * quedan cacheados (dynamicParams por defecto).
 */
export async function generateStaticParams() {
  const destinos = await getDestinos()
  return destinos.map(d => ({ slug: d.slug }))
}

/**
 * Convierte el precio libre ("desde $899 USD", "$2.000.000 COP") en una oferta
 * para JSON-LD. Toma SOLO el primer número del texto y le quita los separadores
 * de miles: "2.000.000" → "2000000".
 *
 * Antes se concatenaban todos los dígitos del texto, así que "Desde $899 USD ·
 * 8 días" publicaba lowPrice "8998" — un precio inventado que Google puede
 * mostrar como rich result.
 */
function precioToOffer(
  d: Pick<Destino, 'precio_valor' | 'precio_moneda' | 'precio_desde'>
): { lowPrice: string; priceCurrency: string } | null {
  // Estructurado primero: moneda declarada, sin adivinanzas.
  if (d.precio_valor != null && d.precio_moneda) {
    return { lowPrice: String(d.precio_valor), priceCurrency: d.precio_moneda }
  }
  // Legado: inferencia por regex sobre el texto libre.
  const precio = d.precio_desde
  if (!precio) return null
  const primerNumero = precio.match(/\d[\d.,\s]*/)?.[0]
  const lowPrice = primerNumero?.replace(/[^\d]/g, '') ?? ''
  if (!lowPrice) return null
  const priceCurrency = /usd|d[oó]lar/i.test(precio) ? 'USD' : 'COP'
  return { lowPrice, priceCurrency }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const d = await getDestino(slug)
  if (!d) return {}
  return {
    title: d.meta_title ?? d.nombre,
    description: d.meta_description ?? d.descripcion ?? undefined,
    keywords: d.keywords,
    alternates: { canonical: `/destinos/${slug}` },
    openGraph: {
      title: d.nombre,
      description: d.meta_description ?? d.descripcion ?? undefined,
      images: d.imagen_hero ? [{ url: d.imagen_hero }] : undefined,
    },
  }
}

export default async function DestinoPage({ params }: Props) {
  const { slug } = await params
  const d = await getDestino(slug)
  if (!d) notFound()

  const waUrl = whatsappUrl(d.nombre)
  const waReserva = whatsappReservaUrl(d.nombre)
  const waDudas = whatsappDudasUrl(d.nombre)
  const resena = await getResenaDestino(d.nombre)
  // Foto de "Sobre el destino": la dedicada, o la miniatura/hero como respaldo.
  const aboutImg = d.imagen_about ?? d.imagen_thumb ?? d.imagen_hero

  // Información clave: todos los datos cargados en el panel (con más de 4 se
  // muestran en carrusel).
  const infoClave = d.info_clave ?? []

  const offer = precioToOffer(d)
  const precioMostrar = precioDesde(d, { conNota: true })

  const schemaTouristDestination = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristDestination',
        name: d.nombre,
        description: d.descripcion ?? undefined,
        url: `${SITE.url}/destinos/${d.slug}`,
        image: d.imagen_hero ?? d.imagen_thumb ?? undefined,
        touristType: { '@type': 'Audience', audienceType: 'Travelers' },
        includesAttraction: d.highlights?.map(h => ({
          '@type': 'TouristAttraction',
          name: h.titulo,
          description: h.descripcion,
        })),
      },
      {
        '@type': 'TouristTrip',
        name: `Viaje a ${d.nombre}`,
        description: d.descripcion ?? undefined,
        url: `${SITE.url}/destinos/${d.slug}`,
        provider: { '@id': `${SITE.url}/#organization` },
        ...(offer
          ? {
              offers: {
                '@type': 'AggregateOffer',
                lowPrice: offer.lowPrice,
                priceCurrency: offer.priceCurrency,
                availability: 'https://schema.org/InStock',
                url: `${SITE.url}/destinos/${d.slug}`,
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio',    item: SITE.url },
          { '@type': 'ListItem', position: 2, name: 'Destinos',  item: `${SITE.url}/destinos` },
          { '@type': 'ListItem', position: 3, name: d.nombre,    item: `${SITE.url}/destinos/${d.slug}` },
        ],
      },
    ],
  }

  return (
    <div className="tema-claro">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schemaTouristDestination) }}
      />

      {/* ── HERO ── */}
      <section className="tema-oscuro relative flex items-end overflow-hidden" style={{ minHeight: '90svh' }}>
        {d.imagen_hero ? (
          <Image src={d.imagen_hero} alt="" fill priority sizes="100vw" className="object-cover" style={{ zIndex: 0 }} />
        ) : (
          <div className="absolute inset-0" style={{ background: 'var(--blue)', zIndex: 0 }} />
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(8, 18, 38,0.97) 0%, rgba(8, 18, 38,0.55) 50%, rgba(8, 18, 38,0.2) 100%)',
            zIndex: 1,
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-32">
          <div className="destino-hero-in">
            <SectionTag className="mb-4">{d.pais}</SectionTag>
            <h1 className="font-plus-jakarta text-4xl font-extrabold leading-none sm:text-6xl" style={{ color: 'var(--text-primary)' }}>
              {d.nombre}
            </h1>
            {d.frase_hero && (
              <p className="mt-5 max-w-xl font-inter text-base leading-relaxed sm:text-lg" style={{ color: 'rgba(255,255,255,0.78)' }}>
                {d.frase_hero}
              </p>
            )}
            {d.autor_frase && (
              <p className="mt-3 font-cinzel text-[11px] tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.78)' }}>
                — {d.autor_frase}{d.cargo_autor ? `, ${d.cargo_autor}` : ''}
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-4">
              {d.etiquetas?.map(e => (
                <span key={e} className="flex items-center gap-2 rounded-full px-4 py-2 font-inter text-sm backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  <Tag size={14} aria-hidden /> {e}
                </span>
              ))}
              {d.duracion && (
                <span className="flex items-center gap-2 rounded-full px-4 py-2 font-inter text-sm backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  <Clock size={14} /> {d.duracion}
                </span>
              )}
              {d.cupos_disponibles !== undefined && d.cupos_disponibles > 0 && (
                <span className="flex items-center gap-2 rounded-full px-4 py-2 font-inter text-sm backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  <Users size={14} /> {d.cupos_disponibles} cupos disponibles
                </span>
              )}
              {precioMostrar && (
                <span className="flex items-center gap-2 rounded-full px-6 py-3 font-plus-jakarta text-lg font-extrabold sm:text-xl" style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', boxShadow: '0 4px 20px color-mix(in srgb, var(--orange) 45%, transparent)' }}>
                  {precioMostrar}
                </span>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="whatsapp" href={waUrl}>Cotizar este viaje</Button>
              <Button variant="outline" href="/destinos">Ver otros destinos</Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      {d.stats && d.stats.length > 0 && (
        <section className="border-y px-6 py-12" style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}>
          {/* Flex centrado (no grid): con 3, 5 o 6 cifras ninguna queda huérfana a la izquierda. */}
          <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-8">
            {d.stats.map(s => (
              <li key={s.label} className="destino-reveal w-[calc(50%-0.75rem)] text-center md:w-52">
                <p className="font-plus-jakarta text-4xl font-extrabold tracking-tight" style={{ color: 'var(--orange)' }}>{s.num}</p>
                <p className="mt-2 font-cinzel text-xs font-semibold tracking-[0.22em] uppercase" style={{ color: 'var(--text-dim)' }}>
                  {s.label}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── SOBRE EL DESTINO (texto + foto + testimonio) ── */}
      {(d.descripcion || aboutImg) && (
        <section className="px-6 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div className="destino-reveal">
              <SectionTag className="mb-4">Sobre el destino</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold leading-[1.1] sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                {d.subtitulo ?? `Por qué elegir ${d.nombre}`}
              </h2>
              {d.descripcion && (
                <p className="mt-6 font-inter text-base" style={{ color: 'var(--text-dim)', lineHeight: '1.8' }}>
                  {d.descripcion}
                </p>
              )}
              <a href={waReserva} className="group mt-8 inline-flex items-center gap-2 font-plus-jakarta text-sm font-bold" style={{ color: 'var(--eyebrow)' }}>
                Quiero reservar
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1.5" />
              </a>
            </div>

            <div className="destino-reveal relative">
              <div className="relative h-[26rem] overflow-hidden rounded-2xl lg:h-[32rem]" style={{ boxShadow: '0 40px 80px -32px rgba(13, 30, 60,0.45)' }}>
                {aboutImg ? (
                  <Image src={aboutImg} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, #16315f, #0d1e3c)' }}>
                    <Icono nombre="image" size={64} strokeWidth={1.2} style={{ color: 'rgba(255,255,255,0.22)' }} />
                  </div>
                )}
              </div>
              {/* Acento decorativo */}
              <div aria-hidden className="absolute -right-4 -top-4 -z-10 hidden h-40 w-40 rounded-2xl lg:block" style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)' }} />

              {resena && (
                  <figure
                    className="absolute -bottom-6 left-4 right-4 rounded-xl p-5 sm:left-6 sm:right-auto sm:max-w-xs"
                    style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 24px 48px -20px rgba(13, 30, 60,0.35)' }}
                  >
                    <Quote size={20} style={{ color: 'var(--orange)' }} />
                    <blockquote className="mt-2 font-inter text-sm italic leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      “{resena.texto}”
                    </blockquote>
                    <figcaption className="mt-3 flex items-center justify-between">
                      <span className="font-plus-jakarta text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{resena.nombre}</span>
                      <span className="flex gap-0.5" role="img" aria-label={`${resena.estrellas ?? 5} de 5 estrellas`}>
                        {Array.from({ length: resena.estrellas ?? 5 }).map((_, i) => <Star key={i} size={11} fill="var(--orange)" style={{ color: 'var(--orange)' }} aria-hidden />)}
                      </span>
                    </figcaption>
                  </figure>
                )}
              </div>
          </div>
        </section>
      )}

      {/* ── QUÉ INCLUYE (sección azul marino) ── */}
      {(d.incluye?.length || d.no_incluye?.length) ? (
        <section className="tema-oscuro relative overflow-hidden px-6 py-24" style={{ background: 'var(--navy)' }}>
          {/* Atmósfera */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at top right, color-mix(in srgb, var(--orange) 12%, transparent), transparent 55%)' }} />
          <div className="relative mx-auto max-w-5xl">
            <div className="destino-reveal mb-10 text-center">
              <SectionTag className="mb-4">El paquete</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl" style={{ color: '#fff' }}>
                ¿Qué incluye tu viaje?
              </h2>
              <div aria-hidden className="mx-auto mt-5 h-1 w-12 rounded" style={{ background: 'var(--orange)' }} />
            </div>
            <div className="destino-reveal">
              <IncluyeTabs incluye={d.incluye} noIncluye={d.no_incluye} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── HOSPEDAJE (solo paquetes que lo incluyen; se carga en el panel) ── */}
      {d.hospedaje && d.hospedaje.length > 0 && (
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="destino-reveal mb-10 text-center">
              <SectionTag className="mb-4">Dónde te alojarás</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Hospedaje
              </h2>
            </div>
            <HospedajeShowcase opciones={d.hospedaje} destino={d.nombre} />
          </div>
        </section>
      )}

      {/* ── EXPERIENCIAS ÚNICAS (todas las cargadas en el panel) ── */}
      {d.highlights && d.highlights.length > 0 && (
        <section className="px-6 py-24" style={{ background: 'var(--bg-alt)' }}>
          <div className="mx-auto max-w-6xl">
            <div className="destino-reveal mb-12 max-w-2xl">
              <SectionTag className="mb-4">Lo que te espera</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Experiencias únicas
              </h2>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {d.highlights.map(h => (
                <li
                  key={h.titulo}
                  className="exp-card destino-reveal flex flex-col overflow-hidden rounded-2xl"
                  style={{ background: '#fff', border: '1px solid var(--border)' }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden" style={{ background: 'var(--blue)' }}>
                    {h.imagen ? (
                      <Image src={h.imagen} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Icono nombre={h.icono} size={52} strokeWidth={1.3} style={{ color: 'rgba(255,255,255,0.6)' }} />
                      </div>
                    )}
                    {h.imagen && h.icono && (
                      <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
                        <Icono nombre={h.icono} size={18} style={{ color: 'var(--navy)' }} />
                      </span>
                    )}
                    {h.precio && (
                      <span className="absolute right-3 top-3 rounded-full px-3 py-1.5 font-plus-jakarta text-xs font-bold" style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
                        Opcional · {h.precio}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-6">
                    <h3 className="font-plus-jakarta text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{h.titulo}</h3>
                    <p className="font-inter text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>{h.descripcion}</p>
                    {h.duracion && (
                      <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-inter text-xs font-semibold" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                        <Clock size={13} style={{ color: 'var(--orange)' }} />
                        {h.duracion}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── INFORMACIÓN CLAVE (4 cards navy) ── */}
      {infoClave.length > 0 && (
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="destino-reveal mb-12 text-center">
              <SectionTag className="mb-4">Información clave</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Lo que necesitas saber
              </h2>
            </div>
            <InfoClaveCarousel items={infoClave} />
          </div>
        </section>
      )}

      {/* ── ITINERARIO DÍA A DÍA ── */}
      {d.itinerario && d.itinerario.length > 0 && (
        <section className="px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <div className="destino-reveal mb-16 text-center">
              <SectionTag className="mb-4">El plan</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Itinerario día a día
              </h2>
            </div>
            <ItinerarioTimeline dias={d.itinerario} />
          </div>
        </section>
      )}

      {/* ── GALERÍA ── */}
      {d.galeria && d.galeria.length > 0 && (
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="destino-reveal mb-10">
              <SectionTag className="mb-4">Galería</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Imágenes del destino
              </h2>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {d.galeria.map((src, i) => (
                <li key={i} className={`destino-reveal exp-card relative overflow-hidden rounded-xl ${i === 0 ? 'col-span-2 row-span-2' : ''}`} style={{ aspectRatio: i === 0 ? '4/3' : '1/1' }}>
                  <Image src={src} alt={`Foto ${i + 1} de ${d.galeria!.length} de ${d.nombre}`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── DOCUMENTOS DEL VIAJE (PDF/Word subidos desde el panel) ── */}
      {d.archivos && d.archivos.length > 0 && (
        <section className="px-6 py-24" style={{ background: 'var(--bg-alt)' }}>
          <div className="mx-auto max-w-4xl">
            <div className="destino-reveal mb-10 text-center">
              <SectionTag className="mb-4">Para descargar</SectionTag>
              <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Documentos del viaje
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {d.archivos.map(f => (
                <li
                  key={f.url}
                  className="destino-reveal exp-card flex flex-wrap items-center gap-4 rounded-2xl p-5"
                  style={{ background: '#fff', border: '1px solid var(--border)' }}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
                  >
                    <FileText size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-plus-jakarta text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {f.titulo}
                    </h3>
                    <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                      {f.tipo === 'pdf' ? 'PDF' : 'Word'}
                      {f.bytes ? ` · ${pesoLegible(f.bytes)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {/* Word no se muestra en el navegador: solo descarga. */}
                    {f.tipo === 'pdf' && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-full px-4 py-2 font-plus-jakarta text-xs font-bold"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      >
                        <Eye size={14} aria-hidden /> Ver<span className="sr-only"> {f.titulo}</span>
                        <NuevaPestana />
                      </a>
                    )}
                    {/* `?download` hace que Supabase responda como adjunto. */}
                    <a
                      href={`${f.url}?download`}
                      className="flex items-center gap-1.5 rounded-full px-4 py-2 font-plus-jakarta text-xs font-bold"
                      style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
                    >
                      <Download size={14} aria-hidden /> Descargar<span className="sr-only"> {f.titulo}</span>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── CTA FINAL ── */}
      <section className="tema-oscuro relative overflow-hidden px-6 py-24" style={{ background: 'linear-gradient(135deg, #16315f 0%, var(--navy) 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ borderTop: '1px solid var(--border-orange)', borderBottom: '1px solid var(--border-orange)' }} />
        <div className="destino-reveal relative mx-auto max-w-3xl text-center">
          <SectionTag className="mb-4">¿Listo para viajar?</SectionTag>
          <h2 className="font-plus-jakarta text-3xl font-extrabold leading-tight sm:text-5xl" style={{ color: 'var(--text-primary)' }}>
            {d.cta_titulo ?? `Viaja a ${d.nombre}`}
          </h2>
          {d.cta_subtitulo && (
            <p className="mx-auto mt-4 max-w-lg font-inter text-sm leading-relaxed sm:text-base" style={{ color: 'var(--text-dim)' }}>
              {d.cta_subtitulo}
            </p>
          )}
          {precioMostrar && (
            <p className="mt-3 font-plus-jakarta text-lg font-bold" style={{ color: 'var(--orange)' }}>{precioMostrar}</p>
          )}
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button variant="whatsapp" href={waReserva}>Quiero reservar</Button>
            <Button variant="outline" href={waDudas}>Tengo algunas dudas</Button>
          </div>
        </div>
      </section>

      {/* ── POR QUÉ NOS PREFIEREN (reseñas de Google — widget de GHL) ── */}
      <section className="px-6 py-24" style={{ background: 'var(--bg-alt)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="destino-reveal mb-10 text-center">
            <SectionTag className="mb-4">Reseñas de Google ⭐</SectionTag>
            <h2 className="font-plus-jakarta text-3xl font-bold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
              ¿Por qué nos prefieren nuestros clientes?
            </h2>
          </div>
          <iframe
            className="lc_reviews_widget"
            src="https://reputationhub.site/reputation/widgets/review_widget/RMFUo0i4KOVl7eZHEn7s?widgetId=6a6c1fb394c29db1b5de6da0"
            frameBorder="0"
            scrolling="no"
            title="Reseñas de Google de Travel World Colombia"
            style={{ minWidth: '100%', width: '100%', minHeight: '420px' }}
          />
          <Script src="https://reputationhub.site/reputation/assets/review-widget.js" strategy="lazyOnload" />
        </div>
      </section>

      {/* ── SOBRE NOSOTROS (cierre con logo) ── */}
      <section className="tema-oscuro relative overflow-hidden px-6 py-24" style={{ background: 'var(--navy)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at bottom, color-mix(in srgb, var(--orange) 8%, transparent), transparent 60%)' }} />
        <div className="destino-reveal relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <Image
            src="/images/travel-world-colombia-logo-blanco.png"
            alt="Travel World Colombia"
            width={260}
            height={104}
            className="h-auto w-52 sm:w-64"
          />
          <SectionTag className="mb-4 mt-10">Agencia de viajes</SectionTag>
          <h2 className="font-plus-jakarta text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
            Travel World Colombia
          </h2>
          <div aria-hidden className="mt-5 h-1 w-16 rounded" style={{ background: 'var(--orange)' }} />
          <p className="mt-5 font-inter text-base italic" style={{ color: 'var(--orange)' }}>
            Más de 14 años cumpliendo sueños
          </p>
          <p className="mt-6 font-inter text-base leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            Somos una agencia con más de 14 años de experiencia en el mercado, cumpliendo los
            sueños de nuestros pasajeros con viajes a nivel nacional e internacional. Hacemos
            realidad cada destino, con la atención cercana que usted merece.
          </p>
        </div>
      </section>
    </div>
  )
}
