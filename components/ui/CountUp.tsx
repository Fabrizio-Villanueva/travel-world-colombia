'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Cuenta de 0 al valor cuando entra en pantalla. Respeta prefers-reduced-motion
 * (muestra el valor final sin animar).
 */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1400,
}: {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [val, setVal] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      // Con movimiento reducido, saltar directo al valor final (sin animar).
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return }
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(to * eased))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [to, duration])

  // El lector de pantalla oye siempre el valor final (sr-only); el número
  // animado es solo visual (antes se anunciaba "0").
  return (
    <span ref={ref}>
      <span aria-hidden="true">{prefix}{val.toLocaleString('es-CO')}{suffix}</span>
      <span className="sr-only">{prefix}{to.toLocaleString('es-CO')}{suffix}</span>
    </span>
  )
}
