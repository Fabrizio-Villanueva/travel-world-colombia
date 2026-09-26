import Image from '@/components/ui/Foto'
import Link from 'next/link'
import { Clock, ChevronRight, Star, MapPin } from 'lucide-react'
import type { Destino } from '@/types/destino'
import { destinoCardImg } from '@/lib/hero'
import { precioDesde } from '@/lib/precio'

/**
 * Tarjeta de un programa — única implementación, compartida por el grid del
 * home, /destinos y /cruceros. `i` solo escalona la animación de entrada.
 * `entrada`: 'stagger' (listados, por defecto) · 'fade' (cargar más del home)
 * · 'none' (cards iniciales del home, sin animación).
 * `nivel`: nivel del encabezado del nombre (h3 por defecto; h4 cuando la
 * grilla vive bajo un subgrupo h3, para no romper el esquema de títulos).
 */
export function DestinoCard({
  d, i = 0, entrada = 'stagger', nivel = 3,
}: { d: Destino; i?: number; entrada?: 'stagger' | 'fade' | 'none'; nivel?: 3 | 4 }) {
  const Titulo = nivel === 4 ? 'h4' : 'h3'
  const anim =
    entrada === 'stagger'
      ? { className: 'animate-fade-up', style: { animationDelay: `${Math.min(i, 8) * 60}ms`, animationFillMode: 'both' as const } }
      : entrada === 'fade'
        ? { className: 'destino-fade-in', style: undefined }
        : { className: undefined, style: undefined }
  return (
    <li className={anim.className} style={anim.style}>
      <Link href={`/destinos/${d.slug}`} className="destino-card u-lift tema-oscuro group flex h-full flex-col overflow-hidden rounded-lg">
        <div className="relative h-56 overflow-hidden">
          <Image
            src={destinoCardImg(d)}
            // Decorativa: el enlace ya se nombra con el título de la tarjeta.
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(8, 18, 38,0.85) 0%, transparent 55%)' }}
          />

          {/* Marcadores (arriba): favorito y/o salida fin de año */}
          {(d.destacado || d.salida_fin_ano) && (
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {d.destacado && (
                <span
                  className="flex items-center gap-1 rounded-sm px-2 py-1 font-plus-jakarta text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
                >
                  <Star size={10} /> Favorito
                </span>
              )}
              {d.salida_fin_ano && (
                <span
                  className="rounded-sm px-2 py-1 font-plus-jakarta text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm"
                  style={{ background: 'rgba(8, 18, 38,0.8)', color: '#fff' }}
                >
                  <span aria-hidden="true">🎄</span> Fin de año
                </span>
              )}
            </div>
          )}

          {precioDesde(d) && (
            <span
              className="absolute bottom-3 left-3 font-plus-jakarta text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-sm"
              style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
            >
              {precioDesde(d)}
            </span>
          )}
          {d.duracion && (
            <span
              className="absolute bottom-3 right-3 flex items-center gap-1 font-inter text-[11px] backdrop-blur-sm px-2 py-1 rounded"
              style={{ background: 'rgba(8, 18, 38,0.75)', color: 'rgba(255,255,255,0.9)' }}
            >
              <Clock size={10} />
              {d.duracion}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <span className="flex items-center gap-1 font-inter text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={11} /> {d.pais}
          </span>
          <Titulo className="font-plus-jakarta text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {d.nombre}
          </Titulo>
          {/* Categorías del viaje (editables en el panel): máx. 2 + "+N". */}
          {d.etiquetas && d.etiquetas.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Categorías">
              {d.etiquetas.slice(0, 2).map(e => (
                <li
                  key={e}
                  className="rounded-full px-2.5 py-0.5 font-inter text-[11px] font-medium"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--text-dim)' }}
                >
                  {e}
                </li>
              ))}
              {d.etiquetas.length > 2 && (
                <li className="px-1 font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  +{d.etiquetas.length - 2}
                </li>
              )}
            </ul>
          )}
          {d.descripcion && (
            <p className="line-clamp-2 font-inter text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {d.descripcion}
            </p>
          )}
          <span
            className="mt-auto flex items-center gap-1 font-plus-jakarta text-[10px] font-bold tracking-[0.12em] uppercase pt-2"
            style={{ color: 'var(--orange)' }}
          >
            Ver destino <ChevronRight size={12} />
          </span>
        </div>
      </Link>
    </li>
  )
}
