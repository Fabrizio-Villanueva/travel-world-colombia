import { Star } from 'lucide-react'
import { SITE } from '@/lib/site'

interface TrustBadgesProps {
  className?: string
}

/** Barra de confianza — "{SITE.reseñas} reseñas ⭐⭐⭐⭐⭐ · RNT 27287 · +14 años". */
export function TrustBadges({ className = '' }: TrustBadgesProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-inter text-[13px] ${className}`}
      style={{ color: 'var(--text-dim)' }}
    >
      <span className="flex items-center gap-1.5">
        <span style={{ color: 'var(--text-primary)' }}>
          {SITE.reseñas} reseñas
        </span>
        <span className="flex" role="img" aria-label="5 de 5 estrellas">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} className="fill-gold text-gold" aria-hidden />
          ))}
        </span>
      </span>

      <span aria-hidden style={{ color: 'var(--text-muted)' }}>·</span>

      <span>
        RNT <span style={{ color: 'var(--text-primary)' }}>{SITE.rnt}</span>
      </span>

      <span aria-hidden style={{ color: 'var(--text-muted)' }}>·</span>

      <span>
        <span style={{ color: 'var(--text-primary)' }}>+14 años</span> de experiencia
      </span>
    </div>
  )
}
