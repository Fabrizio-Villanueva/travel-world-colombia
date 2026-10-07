'use client'

import { useEffect, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'

/**
 * Pantalla completa mientras se registra la firma y se genera el PDF
 * (≈5–10 s). Mismo lenguaje que la "pantalla de análisis" del portal de
 * documentos: un contrato donde se traza la firma, un sello dorado que cae y
 * tres pasos que avanzan solos (la acción del servidor es una sola llamada,
 * así que el avance es por tiempo y el último paso espera la respuesta).
 */

const PASOS = ['Firma cifrada', 'Sellando el contrato', 'Generando tu PDF con evidencia']

export function PantallaFirmando() {
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    const t1 = window.setTimeout(() => setPaso(1), 1300)
    const t2 = window.setTimeout(() => setPaso(2), 3200)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  return (
    <div className="firmando-twc" role="status" aria-live="polite">
      <div className="firmando-glow" />
      <div className="firmando-doc" aria-hidden>
        <span className="firmando-linea" />
        <span className="firmando-linea" style={{ width: '45%' }} />
        <span className="firmando-linea" style={{ width: '72%' }} />
        <span className="firmando-linea" style={{ width: '58%' }} />
        <svg className="firmando-trazo" viewBox="0 0 130 44" fill="none">
          <path
            d="M4 30 C 14 8, 24 8, 28 26 S 40 40, 48 20 S 62 4, 70 24 S 84 38, 92 18 S 112 10, 126 22"
            pathLength={100}
            stroke="#0D1E3C"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
        <span className="firmando-base" />
        <span className="firmando-sello">
          <ShieldCheck size={22} strokeWidth={2.2} />
        </span>
      </div>
      <p className="firmando-titulo">{paso < 2 ? 'Firmando tu contrato…' : 'Preparando tu copia…'}</p>
      <p className="firmando-sub">
        Estamos sellando el documento con la fecha, la hora y tu verificación. Toma unos segundos.
      </p>
      <ul className="firmando-pasos">
        {PASOS.map((t, i) => (
          <li key={t} className={i < paso ? 'listo' : i === paso ? 'activo' : ''}>
            <span className="punto">{i < paso ? <Check size={11} strokeWidth={3} /> : null}</span>
            {t}
          </li>
        ))}
      </ul>
      <p className="firmando-pie">No cierres esta pantalla</p>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.firmando-twc{position:fixed;inset:0;z-index:55;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff;
  background:radial-gradient(120% 80% at 50% 0%,#15305d 0%,#0d1e3c 55%,#081226 100%);animation:firmando-aparece .35s ease both}
.firmando-glow{position:absolute;width:440px;height:440px;border-radius:50%;background:radial-gradient(circle,rgba(255,204,41,.18) 0%,rgba(255,204,41,0) 65%);filter:blur(10px);animation:firmando-respira 3.2s ease-in-out infinite}
.firmando-doc{position:relative;width:176px;height:228px;border-radius:18px;background:#fff;box-shadow:0 24px 60px rgba(0,0,0,.4);padding:26px 20px;display:flex;flex-direction:column;gap:12px}
.firmando-linea{display:block;height:9px;width:85%;border-radius:6px;background:#E2E8F0}
.firmando-trazo{position:absolute;left:22px;right:22px;bottom:44px;width:132px;height:44px}
.firmando-trazo path{stroke-dasharray:100;stroke-dashoffset:100;animation:firmando-traza 1.3s cubic-bezier(.45,0,.25,1) .35s forwards}
.firmando-base{position:absolute;left:20px;right:20px;bottom:40px;height:1.5px;background:#CBD5E1}
.firmando-sello{position:absolute;right:-12px;bottom:-12px;width:54px;height:54px;border-radius:50%;background:#FFCC29;color:#0D1E3C;display:flex;align-items:center;justify-content:center;
  border:3px solid #0d1e3c;box-shadow:0 8px 24px rgba(255,204,41,.45);opacity:0;transform:scale(2.2) rotate(-25deg);animation:firmando-sella .5s cubic-bezier(.2,1.5,.4,1) 1.9s forwards}
.firmando-titulo{margin-top:34px;font-family:var(--font-plus-jakarta),sans-serif;font-weight:800;font-size:21px;letter-spacing:-.01em}
.firmando-sub{margin-top:6px;max-width:300px;font-family:var(--font-inter),sans-serif;font-size:13px;line-height:1.5;color:rgba(255,255,255,.72)}
.firmando-pasos{margin-top:22px;display:flex;flex-direction:column;gap:9px;list-style:none;padding:0;font-family:var(--font-inter),sans-serif;font-size:13px;color:rgba(255,255,255,.55);text-align:left}
.firmando-pasos li{display:flex;align-items:center;gap:10px;transition:color .3s}
.firmando-pasos li.listo{color:#fff}
.firmando-pasos li.activo{color:#FFCC29}
.firmando-pasos .punto{width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.firmando-pasos li.listo .punto{background:#10B981;border-color:#10B981;color:#fff}
.firmando-pasos li.activo .punto{border-color:#FFCC29;animation:firmando-pulso 1.1s ease-in-out infinite}
.firmando-pie{position:absolute;bottom:28px;font-family:var(--font-inter),sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.4)}
@keyframes firmando-aparece{from{opacity:0}to{opacity:1}}
@keyframes firmando-respira{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.12);opacity:1}}
@keyframes firmando-traza{to{stroke-dashoffset:0}}
@keyframes firmando-sella{to{opacity:1;transform:scale(1) rotate(0)}}
@keyframes firmando-pulso{0%,100%{box-shadow:0 0 0 0 rgba(255,204,41,.5)}50%{box-shadow:0 0 0 6px rgba(255,204,41,0)}}
@media (prefers-reduced-motion: reduce){.firmando-glow,.firmando-pasos li.activo .punto{animation:none}.firmando-trazo path{animation-duration:.01s}.firmando-sello{animation-delay:0s;animation-duration:.2s}}
`
