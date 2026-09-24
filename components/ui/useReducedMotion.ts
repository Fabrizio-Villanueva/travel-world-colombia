'use client'

import { useSyncExternalStore } from 'react'

// Preferencia de sistema "reducir movimiento". En SSR/hidratación se asume
// false (con animación) y matchMedia corrige al montar.
const MQ_REDUCIR = '(prefers-reduced-motion: reduce)'

function suscribir(cb: () => void) {
  const mq = window.matchMedia(MQ_REDUCIR)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** true si el usuario pidió reducir movimiento (se actualiza en vivo). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(MQ_REDUCIR).matches,
    () => false
  )
}

/** Versión imperativa para handlers: 'auto' si hay que reducir movimiento. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto'
  return window.matchMedia(MQ_REDUCIR).matches ? 'auto' : 'smooth'
}
