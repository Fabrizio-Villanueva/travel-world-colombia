import Image from '@/components/ui/Foto'
import { Star, MapPin, BedDouble, Check, MessageCircle } from 'lucide-react'
import type { OpcionHospedaje } from '@/types/destino'
import { whatsappHospedajeUrl } from '@/lib/site'
import { NuevaPestana } from '@/components/ui/NuevaPestana'

/**
 * Sección "Hospedaje" del producto: cada opción (2★ hostal, 4★ hotel, cabina
 * interior…) es una tarjeta independiente, una debajo de otra, al estilo de
 * los listados de Expedia/Viator — foto a la izquierda, hotel en el centro y
 * tarifas por habitación con el botón de cotizar a la derecha — para que el
 * cliente compare todas las opciones sin tener que hacer clic.
 * En el celular la foto va arriba y las tarifas debajo.
 */
export function HospedajeShowcase({ opciones, destino }: { opciones: OpcionHospedaje[]; destino: string }) {
  if (opciones.length === 0) return null
  return (
    <div className="flex flex-col gap-5">
      {opciones.length > 1 && (
        <p className="destino-reveal font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          {opciones.length} opciones de hospedaje · compara y elige la que prefieras
        </p>
      )}
      {opciones.map((o, i) => (
        <TarjetaHospedaje key={i} opcion={o} destino={destino} />
      ))}
    </div>
  )
}

const MAX_AMENIDADES = 6

/**
 * Separa el monto de la coletilla "por persona" (el precio es texto libre del
 * panel, ej. "USD $1.125 por persona") para que el monto no se parta en dos
 * líneas en la columna angosta de tarifas.
 */
function partirPrecio(precio: string): { monto: string; sufijo?: string } {
  const m = precio.match(/^(.*?)\s*((?:por|x)\s+persona|p\/p)\.?$/i)
  return m && m[1] ? { monto: m[1], sufijo: m[2] } : { monto: precio }
}

function Precio({ texto }: { texto: string }) {
  const { monto, sufijo } = partirPrecio(texto)
  return (
    <>
      <span className="whitespace-nowrap">{monto}</span>
      {sufijo && (
        <span className="block font-inter text-[11px] font-normal" style={{ color: 'var(--text-dim)' }}>
          {sufijo}
        </span>
      )}
    </>
  )
}

function TarjetaHospedaje({ opcion: o, destino }: { opcion: OpcionHospedaje; destino: string }) {
  const habitaciones = o.habitaciones ?? []
  const amenidades = o.amenidades ?? []
  const extra = amenidades.length - MAX_AMENIDADES
  const etiqueta = o.estrellas ? `${o.estrellas}★ ${o.titulo}` : o.titulo

  return (
    <article
      className="destino-reveal grid overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(8,18,38,0.12)] md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)_16rem]"
      style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
    >
      {/* Foto */}
      <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[220px]" style={{ background: 'var(--navy)' }}>
        {o.imagen ? (
          <Image
            src={o.imagen}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 18rem"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BedDouble size={44} strokeWidth={1.2} style={{ color: 'rgba(255,255,255,0.5)' }} aria-hidden />
          </div>
        )}
      </div>

      {/* Hotel: nombre, categoría, descripción, ciudades y amenidades */}
      <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-6">
        <div>
          {o.estrellas ? (
            <span className="mb-1.5 flex gap-0.5" role="img" aria-label={`Categoría ${o.estrellas} de 5 estrellas`}>
              {Array.from({ length: o.estrellas }).map((_, i) => (
                <Star key={i} size={14} fill="var(--gold)" style={{ color: 'var(--gold)' }} aria-hidden />
              ))}
            </span>
          ) : null}
          <h3 className="font-plus-jakarta text-lg font-extrabold leading-snug sm:text-xl" style={{ color: 'var(--text-primary)' }}>
            {o.titulo}
          </h3>
          {o.descripcion && (
            <p className="mt-1.5 font-inter text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              {o.descripcion}
            </p>
          )}
        </div>

        {o.ciudades && o.ciudades.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {o.ciudades.map(c => (
              <li key={c.nombre} className="flex items-start gap-1.5 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                <MapPin size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--orange)' }} aria-hidden />
                <span>
                  <strong className="font-semibold">{c.nombre}:</strong> {c.hoteles.join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}

        {amenidades.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {amenidades.slice(0, MAX_AMENIDADES).map(a => (
              <li key={a} className="flex items-center gap-1.5 font-inter text-xs" style={{ color: 'var(--text-primary)' }}>
                <Check size={13} style={{ color: 'var(--orange)' }} aria-hidden />
                {a}
              </li>
            ))}
            {extra > 0 && (
              <li className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                +{extra} más
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Tarifas por habitación + CTA */}
      <div
        className="flex flex-col gap-4 p-5 sm:p-6 md:col-span-2 lg:col-span-1 lg:border-l"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}
      >
        {habitaciones.length > 0 ? (
          <div>
            <p className="mb-2 font-plus-jakarta text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-dim)' }}>
              Tarifas por habitación
            </p>
            <dl className="flex flex-col">
              {habitaciones.map((h, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3 py-2"
                  style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                >
                  <dt className="font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{h.tipo}</dt>
                  <dd className="text-right font-plus-jakarta text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    {h.precio ? (
                      <Precio texto={h.precio} />
                    ) : (
                      <span className="font-inter font-normal" style={{ color: 'var(--text-dim)' }}>A consultar</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Tarifa según fechas y número de viajeros. Escríbenos y te cotizamos.
          </p>
        )}

        <a
          href={whatsappHospedajeUrl(destino, etiqueta)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-plus-jakarta text-sm font-bold transition-transform duration-150 active:scale-[0.99]"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
        >
          <MessageCircle size={16} aria-hidden />
          Cotizar esta opción
          <span className="sr-only"> ({etiqueta})</span>
          <NuevaPestana />
        </a>
      </div>
    </article>
  )
}
