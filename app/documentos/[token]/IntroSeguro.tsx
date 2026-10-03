'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

/**
 * Intro del portal: splash con el logo sobre azul marino (≈2,4 s) → candado
 * que se cierra con un anillo de verificación y el texto "Conexión segura"
 * (≈2,2 s) → cortina hacia arriba que descubre la página. Se muestra una vez
 * por dispositivo y enlace (localStorage); un toque la salta; con
 * `prefers-reduced-motion` se reduce a un fundido corto.
 *
 * La página real se renderiza debajo desde el principio: cuando la cortina
 * sube no hay nada que cargar.
 */

type Fase = 'splash' | 'candado' | 'salida' | 'oculto'

function marcarVista(clave: string) {
  try {
    localStorage.setItem(`twc_doc_intro_${clave}`, '1')
  } catch {}
}

export function IntroSeguro({ clave, children }: { clave: string; children: React.ReactNode }) {
  const [fase, setFase] = useState<Fase>('splash')
  const timers = useRef<number[]>([])

  useEffect(() => {
    const lista = timers.current
    const programar = (ms: number, f: Fase) => lista.push(window.setTimeout(() => setFase(f), ms))
    let visto = false
    try {
      visto = localStorage.getItem(`twc_doc_intro_${clave}`) === '1'
    } catch {}
    if (visto) {
      programar(0, 'oculto')
      return () => lista.forEach(clearTimeout)
    }
    // Se marca como vista cuando EMPIEZA a salir (no al montar): en desarrollo
    // React monta dos veces y, si se marcara al montar, la segunda pasada la
    // ocultaría antes de verse.
    const salir = () => {
      marcarVista(clave)
      setFase('salida')
    }
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reducido) {
      lista.push(window.setTimeout(salir, 900))
      programar(1500, 'oculto')
    } else {
      programar(2400, 'candado')
      lista.push(window.setTimeout(salir, 4700))
      programar(5400, 'oculto')
    }
    return () => lista.forEach(clearTimeout)
  }, [clave])

  function saltar() {
    if (fase === 'oculto' || fase === 'salida') return
    timers.current.forEach(clearTimeout)
    marcarVista(clave)
    setFase('salida')
    timers.current.push(window.setTimeout(() => setFase('oculto'), 700))
  }

  return (
    <>
      {children}
      {fase !== 'oculto' && (
        <div
          role="presentation"
          aria-hidden
          onClick={saltar}
          className={`intro-twc ${fase === 'candado' ? 'intro-candado' : ''} ${fase === 'salida' ? 'intro-salida' : ''}`}
        >
          <div className="intro-glow" />

          {/* Logo */}
          <div className="intro-logo">
            <span className="intro-logo-caja">
              <Image src="/images/travel-world-colombia-logo.png" alt="Travel World Colombia" width={200} height={50} priority className="h-10 w-auto" />
            </span>
            <span className="intro-eyebrow">Portal seguro de documentos</span>
          </div>

          {/* Candado */}
          <div className="intro-lock">
            <svg viewBox="0 0 160 160" width="160" height="160" fill="none" aria-hidden>
              <circle cx="80" cy="80" r="66" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle className="intro-anillo" cx="80" cy="80" r="66" stroke="#FFCC29" strokeWidth="3" strokeLinecap="round" strokeDasharray="415" strokeDashoffset="415" transform="rotate(-90 80 80)" />
              <circle className="intro-pulso" cx="80" cy="80" r="66" stroke="#FFCC29" strokeWidth="2" />
              <path className="intro-arco" d="M58 76v-14a22 22 0 0 1 44 0v14" stroke="white" strokeWidth="7" strokeLinecap="round" />
              <rect x="46" y="74" width="68" height="52" rx="12" fill="white" />
              <path className="intro-check" d="M64 100l11 11 22-24" stroke="#0D1E3C" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" />
            </svg>
            <p className="intro-titulo">Conexión segura</p>
            <p className="intro-sub">Cifrado de extremo a extremo · Solo lo ve tu asesora</p>
          </div>

          <span className="intro-saltar">Toca para continuar</span>
        </div>
      )}
      <style>{CSS}</style>
    </>
  )
}

const CSS = `
.intro-twc{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;overflow:hidden;
  background:radial-gradient(120% 80% at 50% 0%,#15305d 0%,#0d1e3c 55%,#081226 100%);color:#fff;cursor:pointer;
  transition:transform .7s cubic-bezier(.65,0,.35,1),opacity .7s ease;will-change:transform}
.intro-salida{transform:translateY(-100%);opacity:.98}
.intro-glow{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,204,41,.22) 0%,rgba(255,204,41,0) 65%);
  filter:blur(10px);animation:intro-respira 3.2s ease-in-out infinite}
.intro-logo{position:absolute;display:flex;flex-direction:column;align-items:center;gap:18px;
  transition:transform .8s cubic-bezier(.65,0,.35,1),opacity .6s ease}
.intro-logo-caja{display:inline-flex;background:#fff;border-radius:16px;padding:14px 22px;box-shadow:0 20px 60px rgba(0,0,0,.35);animation:intro-aparece .8s cubic-bezier(.2,.8,.2,1) both}
.intro-eyebrow{font-family:var(--font-cinzel),serif;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#FFCC29;opacity:.9;animation:intro-aparece .8s cubic-bezier(.2,.8,.2,1) .25s both}
.intro-candado .intro-logo{transform:translateY(-150px) scale(.62);opacity:.85}
.intro-lock{position:absolute;display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transform:translateY(16px) scale(.96);
  transition:opacity .5s ease .15s,transform .6s cubic-bezier(.2,.8,.2,1) .15s;padding-top:70px}
.intro-candado .intro-lock{opacity:1;transform:translateY(0) scale(1)}
.intro-arco{transform:translateY(-12px);transition:transform .55s cubic-bezier(.3,1.4,.5,1) .55s}
.intro-candado .intro-arco{transform:translateY(0)}
.intro-anillo{transition:stroke-dashoffset 1.25s cubic-bezier(.4,0,.2,1) .7s}
.intro-candado .intro-anillo{stroke-dashoffset:0}
.intro-check{transition:stroke-dashoffset .45s ease 1.75s}
.intro-candado .intro-check{stroke-dashoffset:0}
.intro-pulso{opacity:0;transform-origin:80px 80px}
.intro-candado .intro-pulso{animation:intro-pulso 1.1s ease-out 1.9s 1}
.intro-titulo{font-family:var(--font-plus-jakarta),sans-serif;font-weight:800;font-size:22px;letter-spacing:-.01em;margin-top:6px;opacity:0;transform:translateY(6px);transition:all .5s ease 1.2s}
.intro-sub{font-family:var(--font-inter),sans-serif;font-size:12px;color:rgba(255,255,255,.7);opacity:0;transform:translateY(6px);transition:all .5s ease 1.5s;text-align:center;padding:0 24px}
.intro-candado .intro-titulo,.intro-candado .intro-sub{opacity:1;transform:translateY(0)}
.intro-saltar{position:absolute;bottom:28px;font-family:var(--font-inter),sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);
  animation:intro-aparece .6s ease 1.4s both}
@keyframes intro-aparece{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes intro-respira{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.12);opacity:1}}
@keyframes intro-pulso{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}
@media (prefers-reduced-motion: reduce){.intro-twc,.intro-logo,.intro-lock,.intro-arco,.intro-anillo,.intro-check,.intro-titulo,.intro-sub{transition-duration:.2s!important;animation:none!important}.intro-glow{animation:none}}
`
