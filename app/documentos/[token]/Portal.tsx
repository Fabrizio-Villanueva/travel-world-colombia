'use client'

import { useMemo, useRef, useState } from 'react'
import {
  BookOpenText,
  Camera,
  Check,
  CircleCheck,
  FileBadge,
  IdCard,
  Loader2,
  PencilLine,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  BUCKET_DOCUMENTOS_VIAJEROS,
  TIPO_LABEL,
  tiposRequeridos,
  type TipoDocumento,
} from '@/lib/documentos/config'
import {
  CAMPO_LABEL,
  CAMPOS_FECHA,
  CAMPOS_POR_TIPO,
  type ArchivoPublico,
  type CampoDocumento,
  type DatosDocumento,
  type PortalDatos,
} from '@/lib/documentos/tipos'
import { aceptarConsentimiento, confirmar, prepararSubida, procesar, repetir } from './actions'
import { Garantias } from './Verificacion'
import { Gracias } from './Gracias'

/**
 * El portal: una tarjeta por viajero y, dentro, una casilla por documento que
 * el viaje pide. Flujo por casilla: foto → sube directo al bucket privado →
 * lectura automática → el cliente confirma o corrige → queda escrito en la
 * tarjeta del viaje. Puede volver con el mismo enlace: todo se recuerda.
 *
 * Diseño: móvil primero, lenguaje sobrio (tarjetas blancas de radio 24,
 * bordes finos, estado con punto de color, campos tipo iOS).
 */

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.08)'
const PAGE = '#F4F7FB'
const ACCENT = '#2957A4'
const VERDE = '#047857'
const tarjeta: React.CSSProperties = { background: 'white', border: `1px solid ${BORDER}`, borderRadius: 24, boxShadow: '0 2px 12px rgba(13,30,60,0.04)' }

const ICONO: Record<TipoDocumento, LucideIcon> = { pasaporte: BookOpenText, cedula: IdCard, visa: FileBadge }

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function iniciales(nombre: string | null | undefined, n: number): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return `${n}`
  return partes.slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
}

/** Re-encode a JPEG (lado máx. 2000 px): pesa menos y el lector lo prefiere. PDFs pasan tal cual. */
async function prepararArchivo(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * escala))
    canvas.height = Math.max(1, Math.round(bitmap.height * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9))
    if (!blob || blob.type !== 'image/jpeg') return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function Portal({ token, inicial }: { token: string; inicial: PortalDatos }) {
  const [datos, setDatos] = useState<PortalDatos>(inicial)
  const tipos = useMemo(() => tiposRequeridos(datos.requisitos), [datos.requisitos])

  const requeridos = datos.viajeros * tipos.length
  const confirmados = datos.archivos.filter(a => a.confirmado_en && a.viajero <= datos.viajeros && tipos.includes(a.tipo)).length
  const completo = requeridos > 0 && confirmados >= requeridos
  const pct = requeridos ? Math.round((confirmados / requeridos) * 100) : 0

  // Pantalla final: solo cuando el cliente completa en ESTA visita (no al recargar).
  const [gracias, setGracias] = useState(false)

  function ponerArchivo(a: ArchivoPublico | null, viajero: number, tipo: TipoDocumento) {
    const archivos = [...datos.archivos.filter(x => !(x.viajero === viajero && x.tipo === tipo)), ...(a ? [a] : [])]
    const ahora = archivos.filter(x => x.confirmado_en && x.viajero <= datos.viajeros && tipos.includes(x.tipo)).length
    if (!completo && requeridos > 0 && ahora >= requeridos) setGracias(true)
    setDatos(d => ({ ...d, archivos }))
  }

  return (
    <div className="flex flex-col gap-4">
      {gracias && (
        <Gracias
          nombre={datos.nombres[0] ?? null}
          onCerrar={() => {
            setGracias(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      {/* ── Portada ── */}
      <section className="p-6" style={tarjeta}>
        <p className="font-cinzel text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: ACCENT }}>
          Documentos de tu viaje
        </p>
        <h1 className="mt-1.5 font-plus-jakarta text-2xl font-extrabold leading-tight tracking-tight" style={{ color: NAVY }}>
          {datos.destino || datos.nombre_viaje || 'Tu viaje'}
        </h1>
        {datos.fecha_salida && (
          <p className="mt-1 font-inter text-[13px]" style={{ color: MUTED }}>
            Salida {fmtFecha(datos.fecha_salida)}
            {datos.fecha_regreso ? ` · regreso ${fmtFecha(datos.fecha_regreso)}` : ''}
          </p>
        )}

        <div className="mt-5 flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#E2E8F0" strokeWidth="3" />
              <path
                d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                fill="none"
                stroke={completo ? '#10B981' : ACCENT}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct}, 100`}
                style={{ transition: 'stroke-dasharray .6s ease' }}
              />
            </svg>
            <span className="absolute font-plus-jakarta text-[12px] font-bold tabular-nums" style={{ color: NAVY }}>
              {confirmados}/{requeridos}
            </span>
          </div>
          <div>
            <p className="font-inter text-[15px] font-semibold" style={{ color: NAVY }}>
              {confirmados} de {requeridos} documento{requeridos === 1 ? '' : 's'} listo{confirmados === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 font-inter text-[12px]" style={{ color: completo ? VERDE : MUTED }}>
              {completo ? (
                <>
                  <CircleCheck size={14} /> ¡Todo listo!
                </>
              ) : (
                'Puedes subirlos en varios momentos: todo se guarda.'
              )}
            </p>
          </div>
        </div>
      </section>

      <Garantias />

      {!datos.consentimiento ? (
        <Consentimiento token={token} onAceptado={() => setDatos(d => ({ ...d, consentimiento: true }))} />
      ) : (
        Array.from({ length: datos.viajeros }, (_, i) => i + 1).map(n => {
          const nombre = datos.nombres[n - 1]
          return (
            <section key={n} className="p-5" style={tarjeta}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-plus-jakarta text-xs font-bold tracking-wider text-white"
                  style={{ background: NAVY }}
                >
                  {iniciales(nombre, n)}
                </span>
                <div className="min-w-0">
                  <h2 className="font-plus-jakarta text-[17px] font-bold leading-tight" style={{ color: NAVY }}>
                    Viajero {n}
                  </h2>
                  <p className="truncate font-inter text-[13px]" style={{ color: MUTED }}>
                    {nombre ?? (n === 1 ? 'Titular de la reserva' : 'Acompañante')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {tipos.map(tipo => (
                  <Casilla
                    key={tipo}
                    token={token}
                    viajero={n}
                    tipo={tipo}
                    archivo={datos.archivos.find(a => a.viajero === n && a.tipo === tipo) ?? null}
                    onCambio={a => ponerArchivo(a, n, tipo)}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {datos.consentimiento && completo && (
        <section className="p-6 text-center" style={{ ...tarjeta, background: '#ECFDF5', borderColor: '#A7F3D0' }}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#D1FAE5', color: VERDE }}>
            <CircleCheck size={26} />
          </span>
          <p className="mt-3 font-plus-jakarta text-[17px] font-bold" style={{ color: '#065F46' }}>
            Recibimos todos los documentos
          </p>
          <p className="mt-1 font-inter text-[14px] leading-relaxed" style={{ color: '#047857' }}>
            Tu asesora los revisa y te confirma por WhatsApp. Si necesitas cambiar alguno, puedes volver con este mismo enlace.
          </p>
        </section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Consentimiento (Ley 1581)                                           */
/* ------------------------------------------------------------------ */

function Consentimiento({ token, onAceptado }: { token: string; onAceptado: () => void }) {
  const [marcado, setMarcado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aceptar() {
    setEnviando(true)
    setError(null)
    const r = await aceptarConsentimiento(token).catch(() => ({ ok: false as const, error: 'Sin conexión. Intenta de nuevo.' }))
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    onAceptado()
  }

  return (
    <section className="p-6" style={tarjeta}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#EDF3FC', color: ACCENT }}>
        <ShieldCheck size={24} strokeWidth={1.8} />
      </span>
      <h2 className="mt-4 font-plus-jakarta text-[19px] font-bold" style={{ color: NAVY }}>
        Antes de empezar
      </h2>
      <p className="mt-2 font-inter text-[14px] leading-relaxed" style={{ color: NAVY }}>
        Vas a compartir documentos de identidad, que la ley colombiana considera <strong>datos sensibles</strong>. Travel
        World Colombia (RNT 27287) los usa únicamente para gestionar tu reserva ante aerolíneas, hoteles y operadores,
        los guarda cifrados con acceso restringido a tu asesora y los elimina 30 días después de tu regreso.
      </p>
      <label
        className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl p-4 font-inter text-[13px] leading-relaxed transition-colors"
        style={{ background: PAGE, border: `1px solid ${marcado ? ACCENT : BORDER}`, color: NAVY }}
      >
        <input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#2957A4]" />
        <span>
          Autorizo el tratamiento de mis datos personales y los de los viajeros que registro, según la{' '}
          <a href="/privacidad" target="_blank" rel="noopener" className="underline" style={{ color: ACCENT }}>
            política de privacidad
          </a>{' '}
          (Ley 1581 de 2012). Declaro que tengo autorización de los demás viajeros para compartir sus documentos.
        </span>
      </label>
      {error && (
        <p className="mt-3 rounded-xl px-4 py-3 font-inter text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!marcado || enviando}
        onClick={aceptar}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-40"
        style={{ background: ACCENT }}
      >
        {enviando && <Loader2 size={18} className="animate-spin" />}
        Continuar
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Una casilla = un documento de un viajero                            */
/* ------------------------------------------------------------------ */

type Fase = 'vacio' | 'subiendo' | 'leyendo' | 'confirmar' | 'listo'

function Casilla({
  token,
  viajero,
  tipo,
  archivo,
  onCambio,
}: {
  token: string
  viajero: number
  tipo: TipoDocumento
  archivo: ArchivoPublico | null
  onCambio: (a: ArchivoPublico | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>(() => (archivo ? (archivo.confirmado_en ? 'listo' : 'confirmar') : 'vacio'))
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<DatosDocumento>(() => archivo?.datos_confirmados ?? archivo?.datos_extraidos ?? {})
  const [guardando, setGuardando] = useState(false)
  const [progreso, setProgreso] = useState(0)

  const Icono = ICONO[tipo]
  const campos = CAMPOS_POR_TIPO[tipo]

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setFase('subiendo')
    setProgreso(10)
    const inicio = Date.now()
    try {
      const listo = await prepararArchivo(file)
      setProgreso(30)
      const prep = await prepararSubida(token, viajero, tipo, listo.type, listo.size)
      if (!prep.ok) throw new Error(prep.error)
      const sb = createClient()
      const { error: eSubida } = await sb.storage
        .from(BUCKET_DOCUMENTOS_VIAJEROS)
        .uploadToSignedUrl(prep.datos.ruta, prep.datos.tokenSubida, listo, { contentType: listo.type })
      if (eSubida) throw new Error('No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.')
      setProgreso(100)
      setFase('leyendo')
      const lectura = await procesar(token, prep.datos.archivoId)
      if (!lectura.ok) throw new Error(lectura.error)
      // La pantalla de análisis se queda al menos 2 s: sin parpadeos.
      await new Promise(r => setTimeout(r, Math.max(0, 2000 - (Date.now() - inicio))))
      onCambio(lectura.datos)
      setForm(lectura.datos.datos_extraidos ?? {})
      setFase('confirmar')
    } catch (err) {
      setError((err as Error).message)
      setFase(archivo ? (archivo.confirmado_en ? 'listo' : 'confirmar') : 'vacio')
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) return
    setGuardando(true)
    setError(null)
    try {
      const r = await confirmar(token, archivo.id, form)
      if (!r.ok) throw new Error(r.error)
      onCambio(r.datos.archivo)
      setFase('listo')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarFoto() {
    if (archivo) {
      const r = await repetir(token, archivo.id).catch(() => null)
      if (!r || !r.ok) {
        setError(r?.ok === false ? r.error : 'No se pudo quitar la foto anterior.')
        return
      }
      onCambio(null)
    }
    setForm({})
    setFase('vacio')
    setTimeout(() => inputRef.current?.click(), 0)
  }

  const avisos = archivo?.avisos ?? []
  const confianzaBaja = archivo?.confianza === 'baja' || archivo?.metodo === 'manual'
  const listo = fase === 'listo'

  return (
    <div
      className="rounded-2xl p-4 transition-colors"
      style={{
        border: fase === 'vacio' ? `2px dashed ${BORDER}` : `1px solid ${listo ? '#A7F3D0' : BORDER}`,
        background: listo ? '#F0FDF4' : fase === 'vacio' ? 'white' : PAGE,
      }}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: listo ? '#D1FAE5' : PAGE, border: `1px solid ${listo ? '#A7F3D0' : BORDER}`, color: listo ? VERDE : NAVY }}
          >
            <Icono size={18} strokeWidth={1.8} />
          </span>
          <span className="font-plus-jakarta text-[15px] font-bold" style={{ color: NAVY }}>
            {TIPO_LABEL[tipo]}
          </span>
        </span>
        {listo ? (
          <span className="inline-flex items-center gap-1.5 font-inter text-[12px] font-semibold" style={{ color: VERDE }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10B981' }} /> Listo
          </span>
        ) : fase === 'confirmar' ? (
          <span className="inline-flex items-center gap-1.5 font-inter text-[12px] font-semibold" style={{ color: '#B45309' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#F59E0B' }} /> Por confirmar
          </span>
        ) : null}
      </div>

      <input ref={inputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={elegir} />

      {(fase === 'subiendo' || fase === 'leyendo') && <PantallaAnalisis fase={fase} tipo={tipo} />}

      {fase === 'vacio' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white transition-all active:scale-[0.99]"
            style={{ background: ACCENT }}
          >
            <Camera size={18} /> Tomar foto o subir archivo
          </button>
          <p className="mt-2 text-center font-inter text-[11px]" style={{ color: MUTED }}>
            Con buena luz, sin brillo y el documento completo.
          </p>
        </div>
      )}

      {fase === 'subiendo' && (
        <div className="mt-4">
          <p className="flex items-center gap-2 font-inter text-[13px]" style={{ color: NAVY }}>
            <Loader2 size={15} className="animate-spin" style={{ color: ACCENT }} /> Subiendo de forma segura…
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full transition-all" style={{ width: `${progreso}%`, background: ACCENT }} />
          </div>
        </div>
      )}

      {fase === 'leyendo' && (
        <p className="mt-4 flex items-center gap-2 font-inter text-[13px]" style={{ color: NAVY }}>
          <ScanLine size={16} className="animate-pulse" style={{ color: ACCENT }} /> Leyendo los datos del documento (unos segundos)…
        </p>
      )}

      {(fase === 'confirmar' || listo) && (
        <>
          {avisos.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl px-3 py-2.5 font-inter text-[12px] leading-snug" style={{ background: 'rgba(255,251,235,0.9)', border: '1px solid rgba(253,230,138,0.8)', color: '#78350F' }}>
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" style={{ color: '#D97706' }} /> {a}
                </li>
              ))}
            </ul>
          )}

          {fase === 'confirmar' ? (
            <form onSubmit={guardar} className="mt-3">
              <p className="font-inter text-[13px] leading-relaxed" style={{ color: MUTED }}>
                {confianzaBaja
                  ? 'No pudimos leer todo con claridad: revisa y completa los datos.'
                  : 'Esto fue lo que leímos. Revisa que coincida con el documento y confirma.'}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {campos.map(c => (
                  <CampoForm key={c} campo={c} tipo={tipo} valor={form[c] ?? ''} onChange={v => setForm(f => ({ ...f, [c]: v }))} />
                ))}
              </div>
              {error && (
                <p className="mt-3 rounded-xl px-4 py-3 font-inter text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
                  {error}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-inter text-[15px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-60"
                  style={{ background: ACCENT }}
                >
                  {guardando ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                  Confirmar datos
                </button>
                <button
                  type="button"
                  onClick={cambiarFoto}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white px-4 font-inter text-[13px] font-medium"
                  style={{ border: `1px solid ${BORDER}`, color: NAVY }}
                >
                  <RefreshCw size={14} /> Otra foto
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {campos
                  .filter(c => archivo?.datos_confirmados?.[c])
                  .map(c => (
                    <div key={c} className="min-w-0">
                      <dt className="font-inter text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>{CAMPO_LABEL[c]}</dt>
                      <dd
                        className={`break-words font-inter text-[13px] font-semibold leading-snug tabular-nums ${c === 'numero' || c === 'documento_identidad' ? 'font-mono font-medium' : ''}`}
                        style={{ color: NAVY }}
                      >
                        {CAMPOS_FECHA.includes(c) ? fmtFecha(archivo?.datos_confirmados?.[c]) : archivo?.datos_confirmados?.[c]}
                      </dd>
                    </div>
                  ))}
              </dl>
              <button
                type="button"
                onClick={cambiarFoto}
                className="mt-3 inline-flex items-center gap-1.5 font-inter text-[12px] font-medium"
                style={{ color: ACCENT }}
              >
                <PencilLine size={13} /> Cambiar foto o corregir
              </button>
            </div>
          )}
        </>
      )}

      {error && fase === 'vacio' && (
        <p className="mt-3 rounded-xl px-4 py-3 font-inter text-[13px]" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function CampoForm({
  campo,
  tipo,
  valor,
  onChange,
}: {
  campo: CampoDocumento
  tipo: TipoDocumento
  valor: string
  onChange: (v: string) => void
}) {
  const estilo: React.CSSProperties = { border: `1px solid ${BORDER}`, color: NAVY, background: 'white' }
  const clase = 'h-11 w-full rounded-xl px-3 font-inter text-[15px] outline-none focus:ring-4 focus:ring-[rgba(41,87,164,0.12)]'
  const etiqueta = campo === 'numero' ? `Número de ${tipo === 'cedula' ? 'documento' : tipo}` : CAMPO_LABEL[campo]
  return (
    <label className="block">
      <span className="mb-1 block font-inter text-[11px] font-medium" style={{ color: MUTED }}>
        {etiqueta}
      </span>
      {campo === 'sexo' ? (
        <select value={valor} onChange={e => onChange(e.target.value)} className={clase} style={estilo}>
          <option value="">—</option>
          <option value="F">F</option>
          <option value="M">M</option>
        </select>
      ) : campo === 'tipo_documento' && tipo === 'cedula' ? (
        <select value={valor} onChange={e => onChange(e.target.value)} className={clase} style={estilo}>
          <option value="">—</option>
          <option value="CC">Cédula de ciudadanía (CC)</option>
          <option value="TI">Tarjeta de identidad (TI)</option>
          <option value="CE">Cédula de extranjería (CE)</option>
          <option value="PPT">Permiso de protección temporal (PPT)</option>
          <option value="Pasaporte">Pasaporte</option>
        </select>
      ) : (
        <input
          type={CAMPOS_FECHA.includes(campo) ? 'date' : 'text'}
          value={valor}
          onChange={e => onChange(e.target.value)}
          className={clase}
          style={estilo}
          autoCapitalize="characters"
        />
      )}
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Pantalla completa mientras se sube y se analiza el documento        */
/* ------------------------------------------------------------------ */

function PantallaAnalisis({ fase, tipo }: { fase: 'subiendo' | 'leyendo'; tipo: TipoDocumento }) {
  const pasos = [
    { t: 'Cifrado', listo: true },
    { t: 'Subido al canal seguro', listo: fase === 'leyendo' },
    { t: 'Leyendo los datos', listo: false, activo: fase === 'leyendo' },
  ]
  return (
    <div className="analisis-twc" role="status" aria-live="polite">
      <div className="analisis-glow" />
      <div className="analisis-doc" aria-hidden>
        <span className="analisis-linea" />
        <span className="analisis-linea" style={{ width: '40%' }} />
        <span className="analisis-linea" style={{ width: '70%' }} />
        <span className="analisis-linea" style={{ width: '55%' }} />
        <span className="analisis-mrz" />
        <span className="analisis-scan" />
        <span className="analisis-candado">
          <ShieldCheck size={18} strokeWidth={2} />
        </span>
      </div>
      <p className="analisis-titulo">{fase === 'subiendo' ? 'Subiendo de forma cifrada…' : 'Analizando tu documento…'}</p>
      <p className="analisis-sub">
        {fase === 'subiendo'
          ? `Tu ${TIPO_LABEL[tipo].toLowerCase()} viaja cifrado hasta el servidor de la agencia.`
          : 'El sistema lee los datos automáticamente. En un momento los confirmas.'}
      </p>
      <ul className="analisis-pasos">
        {pasos.map(p => (
          <li key={p.t} className={p.listo ? 'listo' : p.activo ? 'activo' : ''}>
            <span className="punto">{p.listo ? <Check size={11} strokeWidth={3} /> : null}</span>
            {p.t}
          </li>
        ))}
      </ul>
      <p className="analisis-pie">No cierres esta pantalla</p>
      <style>{CSS_ANALISIS}</style>
    </div>
  )
}

const CSS_ANALISIS = `
.analisis-twc{position:fixed;inset:0;z-index:55;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff;
  background:radial-gradient(120% 80% at 50% 0%,#15305d 0%,#0d1e3c 55%,#081226 100%);animation:analisis-aparece .35s ease both}
.analisis-glow{position:absolute;width:440px;height:440px;border-radius:50%;background:radial-gradient(circle,rgba(255,204,41,.18) 0%,rgba(255,204,41,0) 65%);filter:blur(10px)}
.analisis-doc{position:relative;width:168px;height:220px;border-radius:18px;background:#fff;box-shadow:0 24px 60px rgba(0,0,0,.4);padding:26px 20px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.analisis-linea{display:block;height:9px;width:85%;border-radius:6px;background:#E2E8F0}
.analisis-mrz{display:block;margin-top:auto;height:22px;border-radius:6px;background:repeating-linear-gradient(90deg,#CBD5E1 0 6px,transparent 6px 10px)}
.analisis-scan{position:absolute;left:0;right:0;top:0;height:3px;background:#FFCC29;box-shadow:0 0 18px 4px rgba(255,204,41,.55);animation:analisis-scan 1.9s ease-in-out infinite}
.analisis-candado{position:absolute;right:-8px;bottom:-8px;width:44px;height:44px;border-radius:50%;background:#2957A4;color:#fff;display:flex;align-items:center;justify-content:center;border:3px solid #0d1e3c}
.analisis-titulo{margin-top:30px;font-family:var(--font-plus-jakarta),sans-serif;font-weight:800;font-size:21px;letter-spacing:-.01em}
.analisis-sub{margin-top:6px;max-width:300px;font-family:var(--font-inter),sans-serif;font-size:13px;line-height:1.5;color:rgba(255,255,255,.72)}
.analisis-pasos{margin-top:22px;display:flex;flex-direction:column;gap:9px;list-style:none;padding:0;font-family:var(--font-inter),sans-serif;font-size:13px;color:rgba(255,255,255,.55);text-align:left}
.analisis-pasos li{display:flex;align-items:center;gap:10px;transition:color .3s}
.analisis-pasos li.listo{color:#fff}
.analisis-pasos li.activo{color:#FFCC29}
.analisis-pasos .punto{width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.analisis-pasos li.listo .punto{background:#10B981;border-color:#10B981;color:#fff}
.analisis-pasos li.activo .punto{border-color:#FFCC29;animation:analisis-pulso 1.1s ease-in-out infinite}
.analisis-pie{position:absolute;bottom:28px;font-family:var(--font-inter),sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.4)}
@keyframes analisis-scan{0%{top:6px}50%{top:calc(100% - 9px)}100%{top:6px}}
@keyframes analisis-pulso{0%,100%{box-shadow:0 0 0 0 rgba(255,204,41,.5)}50%{box-shadow:0 0 0 6px rgba(255,204,41,0)}}
@keyframes analisis-aparece{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.analisis-scan,.analisis-pasos li.activo .punto{animation:none}}
`
