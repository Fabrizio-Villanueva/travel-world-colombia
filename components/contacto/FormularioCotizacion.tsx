'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle, AlertCircle, Loader2, Send } from 'lucide-react'
import {
  cotizacionSchema,
  type CotizacionInput,
  type CotizacionFormValues,
  PRESUPUESTO_OPCIONES,
  MESES,
} from '@/lib/validations/cotizacion'
import { submitCotizacion } from '@/app/contacto/actions'
import { fbEvent } from '@/lib/analytics/fbpixel'
import { whatsappUrl } from '@/lib/site'
import type { Destino } from '@/types/destino'

interface Props {
  destinos: Destino[]
}

const currentYear = new Date().getFullYear()
const AÑOS = [currentYear, currentYear + 1, currentYear + 2].map(String)

// Contraste (WCAG AA) sobre el fondo blanco del input: placeholder #5f6b80
// (5,4:1), borde #7a869a (3,7:1, mínimo 3:1 para controles), error #b91c1c (6,5:1).
// El texto de error va sobre el fondo de la página (claro u oscuro): rojo
// mezclado con el color de texto del tema → 7,3:1 en claro y 6,6:1 en oscuro.
const colorError = 'color-mix(in srgb, #ef4444 60%, var(--text-primary))'
const inputBase =
  'w-full rounded-md px-4 py-3 font-inter text-sm outline-none transition-all duration-200 bg-white border text-[#0d1e3c] placeholder:text-[#5f6b80]'
const inputNormal = 'border-[#7a869a] focus:border-[#2957A4] focus:bg-[rgba(41,87,164,0.05)]'
const inputError  = 'border-[#b91c1c] focus:border-[#b91c1c]'
const labelBase   = 'block font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase mb-2'

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 font-inter text-xs" style={{ color: colorError }}>
      <AlertCircle size={12} aria-hidden="true" /> {msg}
    </p>
  )
}

/** Atributos ARIA de un campo según su error: lo marca inválido y enlaza el mensaje. */
function aria(name: string, error?: object) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${name}-error` : undefined,
  } as const
}

function Opcional() {
  return (
    <span className="ml-2 normal-case font-inter font-normal tracking-normal" style={{ color: 'var(--text-dim)' }}>
      (opcional)
    </span>
  )
}

export function FormularioCotizacion({ destinos }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const exitoRef = useRef<HTMLHeadingElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CotizacionFormValues, unknown, CotizacionInput>({
    resolver: zodResolver(cotizacionSchema),
  })

  // Al enviar, el formulario desaparece: el foco pasa al mensaje de éxito para
  // que el lector de pantalla lo anuncie y el teclado no quede en el vacío.
  useEffect(() => {
    if (status === 'success') exitoRef.current?.focus()
  }, [status])

  const onSubmit = async (data: CotizacionInput) => {
    setStatus('loading')
    const result = await submitCotizacion(data)
    if (result.ok) {
      fbEvent('Lead', { content_name: 'formulario-cotizacion' })
      setStatus('success')
    } else {
      setErrorMsg(result.message)
      setStatus('error')
    }
  }

  /* ── Estado éxito ── */
  if (status === 'success') {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-6 rounded-xl py-16 px-8 text-center"
        style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
      >
        <CheckCircle size={52} style={{ color: '#22c55e' }} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h3
            ref={exitoRef}
            tabIndex={-1}
            className="font-plus-jakarta text-2xl font-bold outline-none"
            style={{ color: 'var(--text-primary)' }}
          >
            ¡Recibimos tu solicitud!
          </h3>
          <p className="mt-3 font-inter text-sm leading-relaxed max-w-md" style={{ color: 'var(--text-dim)' }}>
            En menos de 24 horas un asesor se pondrá en contacto contigo.
            Si prefieres respuesta inmediata, escríbenos por WhatsApp.
          </p>
        </div>
        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md px-6 py-3 font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: '#25D366', color: '#0d1e3c', boxShadow: '0 4px 20px rgba(37,211,102,0.35)' }}
        >
          Escribir por WhatsApp
          <span className="sr-only"> (abre en una pestaña nueva)</span>
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
        Los campos marcados con <span aria-hidden="true">*</span>
        <span className="sr-only">asterisco</span> son obligatorios.
      </p>

      {/* Honeypot */}
      <input {...register('website')} type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      {/* Fila 1: Nombre + WhatsApp */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className={labelBase} style={{ color: 'var(--text-dim)' }}>
            Nombre completo <span aria-hidden="true">*</span>
          </label>
          <input
            id="nombre"
            type="text"
            placeholder="Ej. María García"
            autoComplete="name"
            aria-required="true"
            {...aria('nombre', errors.nombre)}
            className={`${inputBase} ${errors.nombre ? inputError : inputNormal}`}
            {...register('nombre')}
          />
          <FieldError id="nombre-error" msg={errors.nombre?.message} />
        </div>

        <div>
          <label htmlFor="whatsapp" className={labelBase} style={{ color: 'var(--text-dim)' }}>
            WhatsApp <span aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 font-inter text-sm select-none"
              style={{ color: '#5f6b80' }}
            >
              +57
            </span>
            <input
              id="whatsapp"
              type="tel"
              inputMode="numeric"
              placeholder="3001234567"
              autoComplete="tel-national"
              maxLength={10}
              aria-required="true"
              {...aria('whatsapp', errors.whatsapp)}
              className={`${inputBase} pl-12 ${errors.whatsapp ? inputError : inputNormal}`}
              {...register('whatsapp')}
            />
          </div>
          <FieldError id="whatsapp-error" msg={errors.whatsapp?.message} />
        </div>
      </div>

      {/* Fila 2: Destino + Viajeros */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="destino_interes" className={labelBase} style={{ color: 'var(--text-dim)' }}>
            Destino de interés <span aria-hidden="true">*</span>
          </label>
          <select
            id="destino_interes"
            aria-required="true"
            {...aria('destino_interes', errors.destino_interes)}
            className={`${inputBase} ${errors.destino_interes ? inputError : inputNormal} cursor-pointer`}
            style={{ appearance: 'none' }}
            {...register('destino_interes')}
          >
            <option value="" style={{ background: '#ffffff' }}>Selecciona un destino</option>
            {destinos.map(d => (
              <option key={d.id} value={d.nombre} style={{ background: '#ffffff' }}>
                {d.nombre} — {d.pais}
              </option>
            ))}
            <option value="Otro destino" style={{ background: '#ffffff' }}>Otro destino</option>
          </select>
          <FieldError id="destino_interes-error" msg={errors.destino_interes?.message} />
        </div>

        <div>
          <label htmlFor="num_viajeros" className={labelBase} style={{ color: 'var(--text-dim)' }}>
            Número de viajeros <Opcional />
          </label>
          <select
            id="num_viajeros"
            {...aria('num_viajeros', errors.num_viajeros)}
            className={`${inputBase} ${errors.num_viajeros ? inputError : inputNormal} cursor-pointer`}
            style={{ appearance: 'none' }}
            {...register('num_viajeros')}
          >
            <option value="" style={{ background: '#ffffff' }}>Aún no lo sé</option>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n} style={{ background: '#ffffff' }}>
                {n} {n === 1 ? 'viajero' : 'viajeros'}
              </option>
            ))}
          </select>
          <FieldError id="num_viajeros-error" msg={errors.num_viajeros?.message} />
        </div>
      </div>

      {/* Fila 3: Fechas tentativas */}
      <fieldset>
        <legend className={labelBase} style={{ color: 'var(--text-dim)' }}>
          Fechas tentativas <Opcional />
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <select
              id="fecha_mes"
              aria-label="Mes de viaje"
              {...aria('fecha_mes', errors.fecha_mes)}
              className={`${inputBase} ${errors.fecha_mes ? inputError : inputNormal} cursor-pointer`}
              style={{ appearance: 'none' }}
              {...register('fecha_mes')}
            >
              <option value="" style={{ background: '#ffffff' }}>Mes</option>
              {MESES.map(m => (
                <option key={m} value={m} style={{ background: '#ffffff' }}>{m}</option>
              ))}
            </select>
            <FieldError id="fecha_mes-error" msg={errors.fecha_mes?.message} />
          </div>
          <div>
            <select
              id="fecha_año"
              aria-label="Año de viaje"
              {...aria('fecha_año', errors.fecha_año)}
              className={`${inputBase} ${errors.fecha_año ? inputError : inputNormal} cursor-pointer`}
              style={{ appearance: 'none' }}
              {...register('fecha_año')}
            >
              <option value="" style={{ background: '#ffffff' }}>Año</option>
              {AÑOS.map(a => (
                <option key={a} value={a} style={{ background: '#ffffff' }}>{a}</option>
              ))}
            </select>
            <FieldError id="fecha_año-error" msg={errors.fecha_año?.message} />
          </div>
        </div>
      </fieldset>

      {/* Fila 4: Presupuesto */}
      <fieldset {...aria('presupuesto', errors.presupuesto)}>
        <legend className={`${labelBase} mb-3`} style={{ color: 'var(--text-dim)' }}>
          Presupuesto aproximado <Opcional />
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRESUPUESTO_OPCIONES.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-md px-4 py-3 transition-all duration-200"
              style={{
                border: '1px solid color-mix(in srgb, var(--text-primary) 45%, transparent)',
                background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
              }}
            >
              <input
                type="radio"
                value={value}
                className="accent-orange-500 h-4 w-4 shrink-0 cursor-pointer"
                {...register('presupuesto')}
              />
              <span className="font-inter text-xs leading-snug" style={{ color: 'var(--text-dim)' }}>
                {label}
              </span>
            </label>
          ))}
        </div>
        <FieldError id="presupuesto-error" msg={errors.presupuesto?.message} />
      </fieldset>

      {/* Fila 5: Mensaje */}
      <div>
        <label htmlFor="mensaje" className={labelBase} style={{ color: 'var(--text-dim)' }}>
          Mensaje adicional <Opcional />
        </label>
        <textarea
          id="mensaje"
          rows={4}
          placeholder="Cuéntanos sobre tu viaje ideal, fechas específicas, preferencias especiales..."
          {...aria('mensaje', errors.mensaje)}
          className={`${inputBase} resize-none ${errors.mensaje ? inputError : inputNormal}`}
          {...register('mensaje')}
        />
        <FieldError id="mensaje-error" msg={errors.mensaje?.message} />
      </div>

      {/* Error global: role="alert" para que se anuncie al aparecer */}
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md px-4 py-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)' }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: colorError }} aria-hidden="true" />
          <p className="font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{errorMsg}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="flex items-center justify-center gap-2 rounded-md px-8 py-4 font-plus-jakarta text-[11px] font-bold tracking-[0.15em] uppercase text-white transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-dark))', color: 'var(--orange-contrast)', boxShadow: '0 8px 24px color-mix(in srgb, var(--orange) 40%, transparent)' }}
      >
        {status === 'loading' ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Enviando…
          </>
        ) : (
          <>
            <Send size={15} aria-hidden="true" />
            Solicitar cotización gratis
          </>
        )}
      </button>

      <p className="text-center font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
        Tus datos están seguros. Respuesta en menos de 24 horas.
      </p>
    </form>
  )
}
