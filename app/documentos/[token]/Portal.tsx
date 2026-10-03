'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  ScanLine,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  BUCKET_DOCUMENTOS_VIAJEROS,
  TIPO_EMOJI,
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

/**
 * El portal: una tarjeta por viajero y, dentro, una casilla por documento que
 * el viaje pide. Flujo por casilla: foto → sube directo al bucket privado →
 * lectura automática → el cliente confirma o corrige → queda escrito en la
 * tarjeta del viaje. Puede volver con el mismo enlace: todo se recuerda.
 */

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 16 }

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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
  const confirmados = datos.archivos.filter(
    a => a.confirmado_en && a.viajero <= datos.viajeros && tipos.includes(a.tipo)
  ).length
  const completo = requeridos > 0 && confirmados >= requeridos

  function ponerArchivo(a: ArchivoPublico | null, viajero: number, tipo: TipoDocumento) {
    setDatos(d => ({
      ...d,
      archivos: [...d.archivos.filter(x => !(x.viajero === viajero && x.tipo === tipo)), ...(a ? [a] : [])],
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Portada */}
      <section className="p-5" style={card}>
        <p className="font-cinzel text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--orange)' }}>
          Documentos de tu viaje
        </p>
        <h1 className="mt-1 font-plus-jakarta text-xl font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {datos.destino || datos.nombre_viaje || 'Tu viaje'}
        </h1>
        {(datos.fecha_salida || datos.nombre_viaje) && (
          <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            {datos.fecha_salida ? `Salida ${fmtFecha(datos.fecha_salida)}` : ''}
            {datos.fecha_salida && datos.fecha_regreso ? ` · regreso ${fmtFecha(datos.fecha_regreso)}` : ''}
          </p>
        )}
        <p className="mt-3 flex items-start gap-2 font-inter text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          <Lock size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--orange)' }} />
          Tus documentos viajan cifrados, solo los ve tu asesora y se borran 30 días después del regreso.
        </p>

        {/* Progreso */}
        <div className="mt-4">
          <div className="flex items-center justify-between font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            <span>
              {confirmados} de {requeridos} documento{requeridos === 1 ? '' : 's'} listo{confirmados === 1 ? '' : 's'}
            </span>
            {completo && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: '#15803d' }}>
                <CheckCircle2 size={14} /> ¡Todo listo!
              </span>
            )}
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-alt)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${requeridos ? Math.round((confirmados / requeridos) * 100) : 0}%`, background: completo ? '#16a34a' : 'var(--orange)' }}
            />
          </div>
        </div>
      </section>

      {!datos.consentimiento ? (
        <Consentimiento token={token} onAceptado={() => setDatos(d => ({ ...d, consentimiento: true }))} />
      ) : (
        Array.from({ length: datos.viajeros }, (_, i) => i + 1).map(n => (
          <section key={n} className="p-5" style={card}>
            <h2 className="font-plus-jakarta text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Viajero {n}
              {datos.nombres[n - 1] ? (
                <span className="ml-2 font-inter text-sm font-normal" style={{ color: 'var(--text-dim)' }}>
                  {datos.nombres[n - 1]}
                </span>
              ) : null}
            </h2>
            <div className="mt-3 flex flex-col gap-3">
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
        ))
      )}

      {datos.consentimiento && completo && (
        <section className="p-5 text-center" style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <CheckCircle2 size={28} className="mx-auto" style={{ color: '#16a34a' }} />
          <p className="mt-2 font-plus-jakarta text-base font-bold" style={{ color: '#166534' }}>
            Recibimos todos los documentos
          </p>
          <p className="mt-1 font-inter text-sm" style={{ color: '#166534' }}>
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
    <section className="p-5" style={card}>
      <h2 className="font-plus-jakarta text-base font-bold" style={{ color: 'var(--text-primary)' }}>
        Antes de empezar
      </h2>
      <p className="mt-2 font-inter text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        Vas a compartir documentos de identidad, que la ley colombiana considera{' '}
        <strong>datos sensibles</strong>. Travel World Colombia (RNT 27287) los usa únicamente para gestionar
        tu reserva ante aerolíneas, hoteles y operadores, los guarda cifrados con acceso restringido a tu
        asesora y los elimina 30 días después de tu regreso.
      </p>
      <label className="mt-4 flex items-start gap-3 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
        <input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>
          Autorizo el tratamiento de mis datos personales y los de los viajeros que registro, según la{' '}
          <a href="/privacidad" target="_blank" rel="noopener" className="underline" style={{ color: 'var(--orange)' }}>
            política de privacidad
          </a>{' '}
          (Ley 1581 de 2012). Declaro que tengo autorización de los demás viajeros para compartir sus documentos.
        </span>
      </label>
      {error && (
        <p className="mt-3 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fef2f2', color: '#b91c1c' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!marcado || enviando}
        onClick={aceptar}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-inter text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
      >
        {enviando && <Loader2 size={16} className="animate-spin" />}
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

  const campos = CAMPOS_POR_TIPO[tipo]

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setFase('subiendo')
    setProgreso(10)
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

  return (
    <div className="rounded-xl p-4" style={{ border: '1px solid var(--border)', background: fase === 'listo' ? '#f0fdf4' : 'var(--bg-alt)' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <span aria-hidden>{TIPO_EMOJI[tipo]}</span> {TIPO_LABEL[tipo]}
        </span>
        {fase === 'listo' && (
          <span className="flex items-center gap-1 font-inter text-xs font-semibold" style={{ color: '#15803d' }}>
            <Check size={14} /> Listo
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={elegir}
      />

      {fase === 'vacio' && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-inter text-sm font-semibold"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
        >
          <Camera size={16} /> Tomar foto o subir archivo
        </button>
      )}

      {fase === 'subiendo' && (
        <div className="mt-3">
          <p className="flex items-center gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            <Loader2 size={14} className="animate-spin" /> Subiendo de forma segura…
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full transition-all" style={{ width: `${progreso}%`, background: 'var(--orange)' }} />
          </div>
        </div>
      )}

      {fase === 'leyendo' && (
        <p className="mt-3 flex items-center gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
          <ScanLine size={14} className="animate-pulse" /> Leyendo los datos del documento (unos segundos)…
        </p>
      )}

      {(fase === 'confirmar' || fase === 'listo') && (
        <>
          {avisos.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fffbeb', color: '#92400e' }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {a}
                </li>
              ))}
            </ul>
          )}

          {fase === 'confirmar' ? (
            <form onSubmit={guardar} className="mt-3">
              <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                {confianzaBaja
                  ? 'No pudimos leer todo con claridad: revisa y completa los datos.'
                  : 'Esto fue lo que leímos. Revisa que coincida con el documento y confirma.'}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {campos.map(c => (
                  <CampoForm key={c} campo={c} tipo={tipo} valor={form[c] ?? ''} onChange={v => setForm(f => ({ ...f, [c]: v }))} />
                ))}
              </div>
              {error && (
                <p className="mt-2 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                  {error}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-inter text-sm font-semibold disabled:opacity-60"
                  style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
                >
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Confirmar datos
                </button>
                <button
                  type="button"
                  onClick={cambiarFoto}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 font-inter text-xs"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-dim)', background: 'white' }}
                >
                  <RefreshCw size={13} /> Otra foto
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {campos
                  .filter(c => archivo?.datos_confirmados?.[c])
                  .map(c => (
                    <div key={c} className="flex justify-between gap-3 font-inter text-xs">
                      <dt style={{ color: 'var(--text-dim)' }}>{CAMPO_LABEL[c]}</dt>
                      <dd className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                        {CAMPOS_FECHA.includes(c) ? fmtFecha(archivo?.datos_confirmados?.[c]) : archivo?.datos_confirmados?.[c]}
                      </dd>
                    </div>
                  ))}
              </dl>
              <button
                type="button"
                onClick={cambiarFoto}
                className="mt-3 flex items-center gap-1.5 font-inter text-xs underline"
                style={{ color: 'var(--text-dim)' }}
              >
                <RefreshCw size={12} /> Cambiar foto o corregir
              </button>
            </div>
          )}
        </>
      )}

      {error && fase === 'vacio' && (
        <p className="mt-2 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fef2f2', color: '#b91c1c' }}>
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
  const base: React.CSSProperties = { border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'white' }
  const clase = 'w-full rounded-md px-3 py-2 font-inter text-sm outline-none'
  const etiqueta = campo === 'numero' ? `Número de ${tipo === 'cedula' ? 'documento' : tipo}` : CAMPO_LABEL[campo]
  return (
    <label className="block">
      <span className="mb-1 block font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
        {etiqueta}
      </span>
      {campo === 'sexo' ? (
        <select value={valor} onChange={e => onChange(e.target.value)} className={clase} style={base}>
          <option value="">—</option>
          <option value="F">F</option>
          <option value="M">M</option>
        </select>
      ) : campo === 'tipo_documento' && tipo === 'cedula' ? (
        <select value={valor} onChange={e => onChange(e.target.value)} className={clase} style={base}>
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
          style={base}
          autoCapitalize="characters"
        />
      )}
    </label>
  )
}
