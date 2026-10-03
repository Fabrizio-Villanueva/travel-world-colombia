'use client'

import Image from 'next/image'
import { Plane } from 'lucide-react'

/**
 * Pantalla final: aparece una sola vez, en el momento en que el cliente
 * confirma el último documento. Un avión recorre una ruta (con estela dorada)
 * y aterriza donde aparece el logo; luego "¡Gracias!" y un botón para volver
 * al resumen. Mismo lenguaje visual que la intro y la pantalla de análisis.
 */

/** Ruta del avión en el escenario de 320×220 px; termina en el centro del logo. */
const RUTA = 'M 18 196 C 40 70, 150 10, 250 52 C 312 80, 250 150, 160 112'

export function Gracias({ nombre, onCerrar }: { nombre: string | null; onCerrar: () => void }) {
  const primerNombre = (nombre ?? '').trim().split(/\s+/)[0]
  const saludo = primerNombre
    ? `¡Gracias, ${primerNombre.charAt(0).toUpperCase()}${primerNombre.slice(1).toLowerCase()}!`
    : '¡Gracias!'

  return (
    <div className="gracias-twc" role="dialog" aria-modal="true" aria-label="Documentos enviados">
      <div className="gracias-glow" />

      <div className="gracias-escena" aria-hidden>
        <svg viewBox="0 0 320 220" width="320" height="220" fill="none">
          <path d={RUTA} stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
          <path className="gracias-estela" d={RUTA} pathLength={100} stroke="#FFCC29" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="gracias-avion">
          <Plane size={30} strokeWidth={1.8} fill="#ffffff" color="#ffffff" />
        </span>
        <span className="gracias-onda" />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="gracias-chispa" style={{ ['--ang' as string]: `${i * 45}deg` }} />
        ))}
        <span className="gracias-logo">
          <Image src="/images/travel-world-colombia-logo.png" alt="" width={180} height={45} className="h-9 w-auto" />
        </span>
      </div>

      <h2 className="gracias-titulo">{saludo}</h2>
      <p className="gracias-sub">
        Tus documentos fueron enviados de forma segura a tu asesora. Ella los revisa y te confirma por WhatsApp.
      </p>
      <p className="gracias-buen">¡Buen viaje! ✈️</p>
      <button type="button" onClick={onCerrar} className="gracias-boton">
        Ver mis documentos
      </button>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.gracias-twc{position:fixed;inset:0;z-index:58;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff;
  background:radial-gradient(120% 80% at 50% 0%,#15305d 0%,#0d1e3c 55%,#081226 100%);animation:gr-fade .4s ease both}
.gracias-glow{position:absolute;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(255,204,41,.20) 0%,rgba(255,204,41,0) 65%);filter:blur(10px);animation:gr-respira 3.2s ease-in-out infinite}
.gracias-escena{position:relative;width:320px;height:220px}
.gracias-escena svg{position:absolute;inset:0;animation:gr-tenue .8s ease 3s forwards}
.gracias-estela{stroke-dasharray:100;stroke-dashoffset:100;animation:gr-estela 2.2s cubic-bezier(.45,0,.25,1) .3s forwards;opacity:.9}
.gracias-avion{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;
  offset-path:path('${RUTA}');offset-rotate:auto 45deg;offset-distance:0%;
  filter:drop-shadow(0 4px 10px rgba(0,0,0,.45));
  animation:gr-vuelo 2.2s cubic-bezier(.45,0,.25,1) .3s forwards, gr-aterriza .35s ease 2.45s forwards}
.gracias-logo{position:absolute;left:50%;top:112px;transform:translate(-50%,-50%) scale(.6);opacity:0;display:inline-flex;background:#fff;border-radius:16px;padding:12px 20px;
  box-shadow:0 20px 60px rgba(0,0,0,.4);animation:gr-logo .6s cubic-bezier(.2,1.4,.4,1) 2.45s forwards}
.gracias-onda{position:absolute;left:160px;top:112px;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid #FFCC29;opacity:0;animation:gr-onda 1s ease-out 2.5s forwards}
.gracias-chispa{position:absolute;left:160px;top:112px;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#FFCC29;opacity:0;
  animation:gr-chispa .9s ease-out 2.55s forwards}
.gracias-titulo{margin-top:22px;font-family:var(--font-plus-jakarta),sans-serif;font-weight:800;font-size:28px;letter-spacing:-.01em;opacity:0;transform:translateY(8px);animation:gr-sube .5s ease 2.9s forwards}
.gracias-sub{margin-top:8px;max-width:320px;font-family:var(--font-inter),sans-serif;font-size:14px;line-height:1.55;color:rgba(255,255,255,.75);opacity:0;transform:translateY(8px);animation:gr-sube .5s ease 3.1s forwards}
.gracias-buen{margin-top:10px;font-family:var(--font-cinzel),serif;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#FFCC29;opacity:0;animation:gr-sube .5s ease 3.3s forwards}
.gracias-boton{margin-top:28px;height:48px;padding:0 28px;border-radius:16px;background:#fff;color:#0D1E3C;font-family:var(--font-inter),sans-serif;font-weight:600;font-size:15px;
  opacity:0;transform:translateY(8px);animation:gr-sube .5s ease 3.6s forwards;transition:transform .15s}
.gracias-boton:active{transform:scale(.98)}
@keyframes gr-fade{from{opacity:0}to{opacity:1}}
@keyframes gr-tenue{to{opacity:.3}}
@keyframes gr-respira{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.12);opacity:1}}
@keyframes gr-estela{to{stroke-dashoffset:0}}
@keyframes gr-vuelo{to{offset-distance:100%}}
@keyframes gr-aterriza{to{opacity:0;transform:scale(.3)}}
@keyframes gr-logo{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes gr-onda{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(26)}}
@keyframes gr-chispa{0%{opacity:1;transform:rotate(var(--ang)) translateX(0)}100%{opacity:0;transform:rotate(var(--ang)) translateX(120px)}}
@keyframes gr-sube{to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){
  .gracias-avion,.gracias-estela,.gracias-onda,.gracias-chispa,.gracias-glow{animation:none!important;opacity:0}
  .gracias-logo,.gracias-titulo,.gracias-sub,.gracias-buen,.gracias-boton{animation-delay:0s!important;animation-duration:.2s!important}
}
`
