'use client'

import { usePathname } from 'next/navigation'
import type { Role } from '@/lib/admin/allowlist'
import { menuPara, opcionActiva } from './nav'

/** Ruta arriba de cada página: "Sitio web › Contenido del sitio › Reseñas". */
export function Migas({ rol, superadmin }: { rol: Role; superadmin: boolean }) {
  const pathname = usePathname()
  const a = opcionActiva(menuPara(rol, superadmin), pathname)
  if (!a || a.item.id === 'inicio') return null
  const partes = [a.grupo.titulo, a.item.label, a.hijo.label !== a.item.label ? a.hijo.label : null].filter(Boolean)
  return (
    <p className="mb-4 font-inter text-xs" style={{ color: 'var(--text-muted)' }} aria-label="Estás en">
      {partes.join(' › ')}
    </p>
  )
}
