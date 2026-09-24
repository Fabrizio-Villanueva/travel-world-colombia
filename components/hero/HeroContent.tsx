import { ArrowRight } from 'lucide-react'
import type { Destino } from '@/types/destino'
import { Button } from '@/components/ui/Button'
import { whatsappUrl } from '@/lib/site'
import { initials } from '@/lib/hero'

interface HeroContentProps {
  destino: Destino
  /** Hover sobre el texto: pausa el carrusel del hero. */
  onHover?: (dentro: boolean) => void
}

/** Contenido textual del hero — kana, título, frase, autor y CTAs. */
export function HeroContent({ destino, onHover }: HeroContentProps) {
  return (
    <div
      // key remount en el padre dispara este fadeUp en cada cambio de destino
      style={{ animation: 'fadeUp 0.35s ease both' }}
      className="relative z-10 flex max-w-[580px] flex-1 flex-col justify-center px-6 sm:px-10"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {destino.nombre_local && (
        <p
          className="mb-1.5 font-inter text-[12px] font-light tracking-[0.4em] text-gold opacity-85"
        >
          {destino.nombre_local}
        </p>
      )}

      {/* No es <h1>: rota con el carrusel. El h1 fijo está en HeroSection. */}
      <p
        className="text-4xl sm:text-6xl"
        style={{
          fontFamily: 'var(--font-plus-jakarta)',
          fontWeight: 800,
          lineHeight: 0.9,
          letterSpacing: '-0.02em',
          color: 'var(--white)',
          textShadow: '0 2px 24px rgba(8, 18, 38,0.55)',
        }}
      >
        {destino.nombre}
      </p>

      <div
        className="my-[18px] h-0.5 w-11 rounded-sm"
        style={{ background: 'linear-gradient(to right, var(--orange), var(--gold))' }}
      />

      {destino.frase_hero && (
        <p
          className="max-w-[330px] rounded-md font-inter font-light"
          // Panel translúcido detrás de la frase: garantiza contraste sobre fotos claras.
          style={{ fontSize: 'clamp(12px, 2.8vw, 13px)', lineHeight: 1.8, color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 12px rgba(8, 18, 38,0.6)', background: 'rgba(13, 30, 60,0.55)', padding: '6px 10px', marginLeft: '-10px' }}
        >
          {destino.frase_hero}
        </p>
      )}

      {(destino.autor_frase || destino.cargo_autor) && (
        <div className="mt-4 flex items-center gap-2.5">
          <div
            aria-hidden
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--orange), var(--gold))',
              border: '2px solid color-mix(in srgb, var(--orange) 40%, transparent)',
            }}
          >
            {initials(destino.autor_frase)}
          </div>
          <div>
            {destino.autor_frase && (
              <div className="font-cinzel text-[11px] tracking-[0.2em] text-white" style={{ textShadow: '0 1px 8px rgba(8, 18, 38,0.8)' }}>
                {destino.autor_frase}
              </div>
            )}
            {destino.cargo_autor && (
              <div className="text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 8px rgba(8, 18, 38,0.8)' }}>
                {destino.cargo_autor}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Button href={`/destinos/${destino.slug}`} size="sm">
          Ver destino <ArrowRight size={13} />
        </Button>
        <Button
          href={whatsappUrl(destino.nombre)}
          variant="outline"
          size="sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cotizar por WhatsApp
        </Button>
      </div>
    </div>
  )
}
