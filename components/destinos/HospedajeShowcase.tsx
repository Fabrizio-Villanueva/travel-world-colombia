'use client'

import { useState } from 'react'
import Image from '@/components/ui/Foto'
import { Star, MapPin, BedDouble, Check, MessageCircle } from 'lucide-react'
import type { OpcionHospedaje } from '@/types/destino'
import { whatsappHospedajeUrl } from '@/lib/site'
import { NuevaPestana } from '@/components/ui/NuevaPestana'

/**
 * Sección "Hospedaje" del producto (pedido del cliente, sep-2026): una tarjeta
 * grande con pestañas por categoría (2★ hostal, 3★ turista…) y, dentro, los
 * hoteles por ciudad, amenidades y pestañas por tipo de habitación con su
 * tarifa. El CTA abre WhatsApp con la opción y habitación elegidas.
 */
export function HospedajeShowcase({ opciones, destino }: { opciones: OpcionHospedaje[]; destino: string }) {
  const [sel, setSel] = useState(0)
  const [habSel, setHabSel] = useState(0)

  const o = opciones[sel]
  if (!o) return null
  const habitaciones = o.habitaciones ?? []
  const hab = habitaciones[Math.min(habSel, Math.max(habitaciones.length - 1, 0))]

  const elegir = (i: number) => {
    setSel(i)
    setHabSel(0)
  }

  const etiqueta = (op: OpcionHospedaje) => (op.estrellas ? `${op.estrellas}★ ${op.titulo}` : op.titulo)

  return (
    <div className="destino-reveal">
      {/* Pestañas de categoría (solo si hay más de una opción) */}
      {opciones.length > 1 && (
        <div
          className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl p-1.5"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
        >
          {opciones.map((op, i) => {
            const activo = i === sel
            return (
              <button
                key={i}
                type="button"
                aria-pressed={activo}
                onClick={() => elegir(i)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-plus-jakarta text-xs font-bold transition-all duration-200"
                style={
                  activo
                    ? { background: 'var(--navy)', color: '#fff', boxShadow: '0 2px 8px rgba(8,18,38,0.25)' }
                    : { color: 'var(--text-dim)' }
                }
              >
                <Star size={13} fill={activo ? 'var(--gold)' : 'none'} style={{ color: activo ? 'var(--gold)' : 'var(--text-muted)' }} />
                {etiqueta(op)}
              </button>
            )
          })}
        </div>
      )}

      {/* Tarjeta grande de la opción seleccionada */}
      <div
        className="grid overflow-hidden rounded-2xl lg:grid-cols-12"
        style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
      >
        {/* Foto */}
        <div className="relative min-h-[240px] sm:min-h-[320px] lg:col-span-7 lg:min-h-[480px]" style={{ background: 'var(--navy)' }}>
          {o.imagen ? (
            <Image
              src={o.imagen}
              alt={`Hospedaje ${o.titulo} — ${destino}`}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BedDouble size={56} strokeWidth={1.2} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
          )}
          <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,18,38,0.55) 0%, transparent 45%)' }} />
          {o.estrellas ? (
            <span
              className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-plus-jakarta text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--navy)', backdropFilter: 'blur(4px)' }}
            >
              <Star size={13} fill="var(--gold)" style={{ color: 'var(--gold)' }} />
              Categoría {o.estrellas} estrella{o.estrellas !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>

        {/* Detalle */}
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:col-span-5">
          <div className="pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-plus-jakarta text-xl font-extrabold leading-tight sm:text-2xl" style={{ color: 'var(--text-primary)' }}>
                {o.titulo}
              </h3>
              {o.estrellas ? (
                <span className="flex shrink-0 gap-0.5 pt-1" role="img" aria-label={`${o.estrellas} estrellas`}>
                  {Array.from({ length: o.estrellas }).map((_, i) => (
                    <Star key={i} size={15} fill="var(--gold)" style={{ color: 'var(--gold)' }} aria-hidden />
                  ))}
                </span>
              ) : null}
            </div>
            {o.descripcion && (
              <p className="mt-1.5 font-inter text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {o.descripcion}
              </p>
            )}
          </div>

          {/* Hoteles por ciudad */}
          {o.ciudades && o.ciudades.length > 0 && (
            <div
              className="grid gap-4 rounded-xl p-4 sm:grid-cols-2"
              style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
            >
              {o.ciudades.map(c => (
                <div key={c.nombre}>
                  <span className="mb-2 flex items-center gap-1.5 font-plus-jakarta text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-primary)' }}>
                    <MapPin size={14} style={{ color: 'var(--orange)' }} />
                    {c.nombre}
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {c.hoteles.map(h => (
                      <li key={h} className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--orange)' }} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Amenidades */}
          {o.amenidades && o.amenidades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.amenidades.map(a => (
                <span
                  key={a}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-inter text-xs font-medium"
                  style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <Check size={13} style={{ color: 'var(--orange)' }} />
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* Tipos de habitación + tarifa */}
          {habitaciones.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
              <div className="grid gap-1 rounded-lg p-1" style={{ gridTemplateColumns: `repeat(${Math.min(habitaciones.length, 4)}, 1fr)`, background: 'var(--bg)' }}>
                {habitaciones.map((h, i) => {
                  const activo = i === habSel
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setHabSel(i)}
                      className="rounded-md py-1.5 font-plus-jakarta text-[11px] font-bold uppercase tracking-wide transition-all duration-200"
                      style={
                        activo
                          ? { background: '#fff', color: 'var(--navy)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                          : { color: 'var(--text-muted)' }
                      }
                    >
                      {h.tipo}
                    </button>
                  )
                })}
              </div>
              {hab?.precio && (
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="font-plus-jakarta text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                    Tarifa · {hab.tipo}
                  </span>
                  <span className="font-plus-jakarta text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    {hab.precio}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <a
            href={whatsappHospedajeUrl(destino, etiqueta(o), habitaciones.length > 0 ? hab?.tipo : undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-plus-jakarta text-sm font-bold transition-transform duration-150 active:scale-[0.99]"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
          >
            <MessageCircle size={17} aria-hidden />
            Consultar esta opción
            <NuevaPestana />
          </a>
        </div>
      </div>
    </div>
  )
}
