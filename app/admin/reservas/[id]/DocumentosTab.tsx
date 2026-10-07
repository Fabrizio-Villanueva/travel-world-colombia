'use client'

import { useState } from 'react'
import {
  Ban,
  BookOpenText,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileBadge,
  IdCard,
  Link2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import {
  CARA_LABEL,
  TIPO_LABEL,
  TIPO_VIAJERO_EDADES,
  TIPO_VIAJERO_LABEL,
  TIPOS_DOCUMENTO,
  TIPOS_VIAJERO,
  MAX_VIAJEROS,
  documentosDe,
  esCaraPrincipal,
  etiquetaDocumento,
  tipoViajeroDe,
  tiposRequeridos,
  type DocumentoRequerido,
  type Requisito,
  type Requisitos,
  type TipoDocumento,
  type TipoViajero,
} from '@/lib/documentos/config'
import { CAMPO_LABEL, CAMPOS_FECHA, CAMPOS_POR_TIPO } from '@/lib/documentos/tipos'
import {
  actualizarRequisitosDocumentos,
  enviarAvisoDocumentos,
  enviarEnlaceDocumentos,
  reintentarEscrituraGhl,
  revocarEnlaceDocumentos,
  verDocumento,
  type ArchivoPanel,
  type EstadoDocumentos,
} from './documentos-actions'

/**
 * Pestaña "Documentos" del Generador de Contratos: la asesora marca qué pide el
 * viaje, envía el enlace (C-05 manda el WhatsApp/correo) y ve lo que el
 * cliente subió — con URLs firmadas de 5 minutos y registro en la bitácora.
 *
 * Diseño (2026-10-03): lenguaje visual sobrio tipo Apple HIG — tarjetas
 * blancas de radio 18, bordes finos, sombras suaves, estado con punto de
 * color, tipografía en tres tamaños. Paleta de marca sin acento amarillo.
 */

const NAVY = '#0D1E3C'
const MUTED = '#6B7A90'
const BORDER = 'rgba(13, 30, 60, 0.08)'
const PAGE = '#F4F7FB'
const ACCENT = '#2957A4'
const ACCENT_LIGHT = '#EDF3FC'
const SHADOW = '0 2px 12px rgba(13, 30, 60, 0.04)'

const tarjeta: React.CSSProperties = { background: 'white', border: `1px solid ${BORDER}`, borderRadius: 18, boxShadow: SHADOW }

const ICONO: Record<TipoDocumento, LucideIcon> = {
  pasaporte: BookOpenText,
  cedula: IdCard,
  visa: FileBadge,
  registro_civil: ScrollText,
}
const SUBTITULO: Record<Requisito, string> = {
  pasaporte: 'Internacional · menores e infantes + registro civil',
  cedula: 'Nacional · cédula o TI por los dos lados; infantes, registro civil',
  visa: 'Según el país de destino',
}

/** "Cédula de ciudadanía (frente y reverso)". */
function resumenDocumento(d: DocumentoRequerido, t: TipoViajero): string {
  return `${etiquetaDocumento(d.tipo, t)}${d.caras.length > 1 ? ' (frente y reverso)' : ''}`
}

const fmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
const fmtCorta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
const fmtDia = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '')

type Res<T> = { ok: true; datos: T } | { ok: false; error: string }

export function DocumentosTab({ opportunityId, inicial }: { opportunityId: string; inicial: EstadoDocumentos }) {
  const [estado, setEstado] = useState<EstadoDocumentos>(inicial)
  // Tres contadores (adultos, menores, infantes): el total son los viajeros y el
  // orden en P1–P12 es fijo: primero adultos, luego menores, al final infantes.
  const [conteo, setConteo] = useState<Conteo>(() =>
    contar(inicial.tiposViajero.slice(0, inicial.solicitud?.viajeros ?? inicial.viajerosSugeridos))
  )
  const viajeros = conteo.adulto + conteo.menor + conteo.infante
  const tiposViajero = expandir(conteo)
  const [requisitos, setRequisitos] = useState<Requisitos>(inicial.solicitud?.requisitos ?? inicial.sugerencia.requisitos)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const s = estado.solicitud
  const vigente = s !== null && s.estado !== 'revocada'
  const tipos = tiposRequeridos(requisitos)
  const cambios =
    vigente &&
    (s.viajeros !== viajeros ||
      TIPOS_DOCUMENTO.some(t => Boolean(s.requisitos[t]) !== requisitos[t]) ||
      Array.from({ length: viajeros }, (_, i) => i + 1).some(n => tipoViajeroDe(s.viajeros_tipo, n) !== tiposViajero[n - 1]))

  async function correr<T>(clave: string, fn: () => Promise<Res<T>>, luego: (d: T) => void) {
    setOcupado(clave)
    setAviso(null)
    try {
      const r = await fn()
      if (!r.ok) return setAviso({ ok: false, texto: r.error })
      luego(r.datos)
    } catch (e) {
      const m = (e as Error).message ?? ''
      setAviso({
        ok: false,
        texto: /Server (Components|Action|Functions)|Failed to find/i.test(m)
          ? 'El panel se actualizó mientras tenías esta página abierta. Recarga (F5) y vuelve a intentar.'
          : m,
      })
    } finally {
      setOcupado(null)
    }
  }

  function enviar() {
    if (vigente && !confirm('Se genera un enlace NUEVO: el anterior deja de servir (los documentos ya subidos se conservan) y C-05 vuelve a avisarle al cliente. Si solo quieres recordárselo, usa "Enviar al cliente". ¿Seguir?')) return
    correr('enviar', () => enviarEnlaceDocumentos(opportunityId, { viajeros, requisitos, viajerosTipo: tiposViajero }), d => {
      setEstado(d.estado)
      setAviso({ ok: true, texto: `Enlace ${d.accion === 'Enviar' ? 'creado' : 'regenerado'} y guardado en la tarjeta. El workflow C-05 se lo manda al cliente.` })
    })
  }

  function avisar() {
    correr('avisar', () => enviarAvisoDocumentos(opportunityId), d => {
      setEstado(d)
      setAviso({
        ok: true,
        texto: 'Aviso enviado: el cliente recibe el enlace por WhatsApp y correo en unos segundos.',
      })
    })
  }

  function guardarCambios() {
    correr('guardar', () => actualizarRequisitosDocumentos(opportunityId, { viajeros, requisitos, viajerosTipo: tiposViajero }), d => {
      setEstado(d)
      setAviso({ ok: true, texto: 'Requisitos actualizados. El cliente los ve al recargar su enlace.' })
    })
  }

  function revocar() {
    if (!confirm('El enlace dejará de abrir. Los documentos ya subidos se conservan. ¿Desactivar?')) return
    correr('revocar', () => revocarEnlaceDocumentos(opportunityId), d => {
      setEstado(d)
      setAviso({ ok: true, texto: 'Enlace desactivado.' })
    })
  }

  function ver(a: ArchivoPanel) {
    correr(`ver-${a.id}`, () => verDocumento(opportunityId, a.id), url => window.open(url, '_blank', 'noopener'))
  }

  function reintentar(a: ArchivoPanel) {
    correr(`ghl-${a.id}`, () => reintentarEscrituraGhl(opportunityId, a.id), d => {
      setEstado(d)
      setAviso({ ok: true, texto: 'Datos escritos en la tarjeta.' })
    })
  }

  async function copiar() {
    if (!estado.link) return
    try {
      await navigator.clipboard.writeText(estado.link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      setAviso({ ok: false, texto: 'No se pudo copiar; selecciona el enlace a mano.' })
    }
  }

  const puedeEnviar = tipos.length > 0 && Boolean(estado.telefonoMascara) && ocupado === null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Título + resumen de estado ── */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-plus-jakarta text-2xl font-bold tracking-tight" style={{ color: NAVY }}>
            Documentos de los viajeros
          </h2>
          <p className="mt-1.5 font-inter text-[13px] leading-relaxed" style={{ color: MUTED }}>
            El cliente sube pasaportes, cédulas o tarjetas de identidad (por los dos lados), registros civiles o visas
            desde un enlace seguro; el sistema lee los datos, él los confirma y quedan escritos en P1–P12. Las fotos
            no pasan por WhatsApp ni se copian a GHL: en la tarjeta queda el enlace «P{'{n}'} - Documentos (panel)».
          </p>
        </div>
        <ResumenEstado estado={estado} />
      </section>

      {aviso && (
        <p
          className="rounded-xl px-4 py-2.5 font-inter text-[13px]"
          style={{
            background: aviso.ok ? '#ECFDF5' : '#FFF1F2',
            color: aviso.ok ? '#047857' : '#BE123C',
            border: `1px solid ${aviso.ok ? '#A7F3D0' : '#FECDD3'}`,
          }}
        >
          {aviso.texto}
        </p>
      )}

      {/* ── Requisitos ── */}
      <section className="p-5 sm:p-6" style={tarjeta}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-plus-jakarta text-[15px] font-bold" style={{ color: NAVY }}>
              ¿Qué documentos pide este viaje?
            </h3>
            <p className="mt-0.5 font-inter text-xs" style={{ color: MUTED }}>
              {estado.destino ? (
                <>
                  <span className="font-semibold" style={{ color: NAVY }}>Destino: {estado.destino}</span> ·{' '}
                </>
              ) : null}
              {estado.sugerencia.motivo}
              {estado.sugerencia.nota ? ` ${estado.sugerencia.nota}` : ''}
            </p>
          </div>
          <Contadores conteo={conteo} onChange={setConteo} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {TIPOS_DOCUMENTO.map(t => (
            <Seleccionable
              key={t}
              tipo={t}
              activo={requisitos[t]}
              onToggle={() => setRequisitos(r => ({ ...r, [t]: !r[t] }))}
            />
          ))}
        </div>

        <ResumenPorTipo conteo={conteo} requisitos={requisitos} sugeridos={estado.tiposSugeridos} />

        <p className="mt-4 font-inter text-[11px]" style={{ color: MUTED }}>
          El cliente entra con un código de 6 dígitos que le llega por WhatsApp (o por correo) al celular
          {estado.telefonoMascara ? (
            <>
              {' '}(<span className="font-mono font-medium" style={{ color: NAVY }}>{estado.telefonoMascara}</span>)
            </>
          ) : (
            <>
              {' '}· <span className="font-semibold" style={{ color: '#BE123C' }}>el contacto no tiene celular: agrégalo en el paso Contacto</span>
            </>
          )}
          . Máximo 12 viajeros (campos P1–P12).
        </p>

        {(!vigente || cambios) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
            {!vigente ? (
              <BotonPrimario onClick={enviar} disabled={!puedeEnviar} cargando={ocupado === 'enviar'} Icono={Send}>
                Enviar enlace de documentos
              </BotonPrimario>
            ) : (
              <BotonPrimario onClick={guardarCambios} disabled={ocupado !== null || tipos.length === 0} cargando={ocupado === 'guardar'} Icono={Check}>
                Guardar requisitos
              </BotonPrimario>
            )}
            <span className="font-inter text-[11px]" style={{ color: MUTED }}>
              {!vigente
                ? s?.estado === 'revocada'
                  ? 'El enlace anterior está desactivado: se creará uno nuevo.'
                  : 'Crea el enlace, lo guarda en la tarjeta y C-05 se lo manda al cliente.'
                : 'El cliente ve los cambios al recargar su enlace.'}
            </span>
          </div>
        )}
      </section>

      {/* ── Enlace ── */}
      {vigente && (
        <section className="p-5" style={tarjeta}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-3 py-2"
              style={{ background: PAGE, border: `1px solid ${BORDER}` }}
            >
              <Link2 size={16} className="shrink-0" style={{ color: MUTED }} />
              <span className="truncate font-mono text-xs" style={{ color: NAVY }}>
                {estado.link ?? 'El enlace se guarda en la tarjeta de GHL.'}
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <BotonPrimario onClick={avisar} disabled={ocupado !== null} cargando={ocupado === 'avisar'} Icono={Send}>
                Enviar al cliente
              </BotonPrimario>
              <button
                type="button"
                onClick={copiar}
                disabled={!estado.link}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-white px-4 font-inter text-xs font-semibold transition-colors hover:bg-slate-50 disabled:opacity-50"
                style={{ border: `1px solid ${BORDER}`, color: NAVY }}
              >
                {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={estado.link ?? '#'}
                target="_blank"
                rel="noopener"
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-white px-4 font-inter text-xs font-semibold transition-colors hover:bg-slate-50"
                style={{ border: `1px solid ${BORDER}`, color: NAVY }}
              >
                <ExternalLink size={14} /> Abrir
              </a>
            </div>
          </div>
          <div
            className="mt-4 flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <p className="max-w-2xl font-inter text-[11px] leading-normal" style={{ color: MUTED }}>
              &quot;Enviar al cliente&quot; dispara el workflow C-05 (WhatsApp y correo con este mismo enlace, que
              también queda en la tarjeta de GHL). También puedes copiarlo y mandarlo tú.
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={enviar}
                className="inline-flex items-center gap-1.5 font-inter text-xs font-medium transition-colors hover:opacity-70 disabled:opacity-40"
                style={{ color: NAVY }}
              >
                {ocupado === 'enviar' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Generar enlace nuevo
              </button>
              <span style={{ color: BORDER }}>|</span>
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={revocar}
                className="inline-flex items-center gap-1 font-inter text-xs font-semibold transition-colors hover:opacity-70 disabled:opacity-40"
                style={{ color: '#E11D48' }}
              >
                <Ban size={14} /> Desactivar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Viajeros ── */}
      {s &&
        Array.from({ length: s.viajeros }, (_, i) => i + 1).map(n => {
          const tipoViajero = tipoViajeroDe(s.viajeros_tipo, n)
          const docs = documentosDe(tipoViajero, s.requisitos)
          const nombre = estado.nombres[n - 1]
          const propios = estado.archivos.filter(a => a.viajero === n)
          const listos = docs.filter(d =>
            propios.some(a => a.tipo === d.tipo && esCaraPrincipal(a.cara) && a.confirmado_en)
          ).length
          return (
            <section key={n} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full font-plus-jakarta text-xs font-bold tracking-wider text-white"
                    style={{ background: NAVY }}
                  >
                    {iniciales(nombre, n)}
                  </div>
                  <div>
                    <h3 className="font-plus-jakarta text-base font-bold" style={{ color: NAVY }}>
                      Viajero {n}
                      {nombre ? ` · ${nombre}` : ''}
                    </h3>
                    <p className="font-inter text-xs" style={{ color: MUTED }}>
                      {TIPO_VIAJERO_LABEL[tipoViajero]} · {n === 1 ? 'titular de la reserva' : 'acompañante'} ·{' '}
                      <a
                        href={`/admin/reservas/${opportunityId}/documentos/${n}`}
                        target="_blank"
                        rel="noopener"
                        className="font-semibold underline-offset-2 hover:underline"
                        style={{ color: ACCENT }}
                      >
                        abrir página del viajero
                      </a>
                    </p>
                  </div>
                </div>
                <span
                  className="rounded-full bg-white px-2.5 py-1 font-inter text-xs font-medium tabular-nums"
                  style={{ color: MUTED, border: `1px solid ${BORDER}` }}
                >
                  {listos} de {docs.length} confirmados
                </span>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {docs.map(d => (
                  <TarjetaDocumento
                    key={d.tipo}
                    doc={d}
                    etiqueta={resumenDocumento(d, tipoViajero)}
                    archivos={propios.filter(a => a.tipo === d.tipo)}
                    ocupado={ocupado}
                    onVer={ver}
                    onReintentar={reintentar}
                  />
                ))}
              </div>
            </section>
          )
        })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */

function iniciales(nombre: string | null | undefined, n: number): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return `V${n}`
  return partes
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('')
}

function BotonPrimario({
  children,
  onClick,
  disabled,
  cargando,
  Icono,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  cargando?: boolean
  Icono: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 font-inter text-xs font-semibold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
      style={{ background: ACCENT }}
    >
      {cargando ? <Loader2 size={14} className="animate-spin" /> : <Icono size={14} />}
      {children}
    </button>
  )
}

function ResumenEstado({ estado }: { estado: EstadoDocumentos }) {
  const s = estado.solicitud
  const p = estado.progreso
  const pct = p && p.requeridos > 0 ? Math.round((p.confirmados / p.requeridos) * 100) : 0
  const chip =
    !s
      ? { t: 'Sin enlace', c: MUTED, bg: PAGE, b: BORDER, dot: '#94A3B8' }
      : s.estado === 'completa'
        ? { t: 'Documentos completos', c: '#047857', bg: '#ECFDF5', b: '#A7F3D0', dot: '#10B981' }
        : s.estado === 'revocada'
          ? { t: 'Enlace desactivado', c: '#BE123C', bg: '#FFF1F2', b: '#FECDD3', dot: '#F43F5E' }
          : { t: 'Enlace activo', c: ACCENT, bg: ACCENT_LIGHT, b: '#C7D7F0', dot: ACCENT }

  return (
    <aside className="flex w-full items-center gap-4 px-4 py-3.5 sm:w-auto" style={tarjeta} aria-label="Resumen de estado">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <svg className="h-11 w-11 -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="#E2E8F0" strokeWidth="3" />
          <path
            d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
            fill="none"
            stroke={pct === 100 ? '#10B981' : ACCENT}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${pct}, 100`}
          />
        </svg>
        <span className="absolute font-plus-jakarta text-[11px] font-bold tabular-nums" style={{ color: NAVY }}>
          {p ? `${p.confirmados}/${p.requeridos}` : '—'}
        </span>
      </div>
      <div className="flex min-w-0 flex-col justify-center">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 font-inter text-xs font-semibold"
          style={{ color: chip.c, background: chip.bg, border: `1px solid ${chip.b}` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.dot }} />
          {chip.t}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 font-inter text-[11px] tabular-nums" style={{ color: MUTED }}>
          {s ? (
            <>
              <span className="inline-flex items-center gap-1 font-medium" style={{ color: s.consentimiento_en ? '#334155' : '#B45309' }}>
                {s.consentimiento_en ? <Check size={13} style={{ color: '#059669' }} /> : <TriangleAlert size={13} />}
                {s.consentimiento_en ? `Consentimiento · ${fmtCorta.format(new Date(s.consentimiento_en))}` : 'Sin consentimiento aún'}
              </span>
              <span style={{ color: BORDER }}>|</span>
              <span>Vence {fmtCorta.format(new Date(s.vence_en))}</span>
              <span style={{ color: BORDER }}>•</span>
              <span>{s.ultimo_acceso_en ? `Último acceso ${fmt.format(new Date(s.ultimo_acceso_en))}` : 'El cliente aún no ha entrado'}</span>
            </>
          ) : (
            <span>Marca los requisitos y envía el enlace para empezar.</span>
          )}
        </div>
      </div>
    </aside>
  )
}

function Seleccionable({ tipo, activo, onToggle }: { tipo: Requisito; activo: boolean; onToggle: () => void }) {
  const Icono = ICONO[tipo]
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onToggle}
      className="flex items-start justify-between gap-3 rounded-xl p-3.5 text-left transition-all"
      style={{
        border: `2px solid ${activo ? ACCENT : BORDER}`,
        background: activo ? 'rgba(237, 243, 252, 0.4)' : 'white',
      }}
    >
      <span className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white"
          style={{ border: `1px solid ${BORDER}`, color: activo ? ACCENT : MUTED }}
        >
          <Icono size={20} strokeWidth={1.75} />
        </span>
        <span>
          <span className="block font-inter text-[13px] font-semibold" style={{ color: NAVY }}>{TIPO_LABEL[tipo]}</span>
          <span className="block font-inter text-[11px]" style={{ color: MUTED }}>{SUBTITULO[tipo]}</span>
        </span>
      </span>
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: activo ? ACCENT : 'transparent', border: activo ? 'none' : `1.5px solid ${BORDER}` }}
      >
        {activo && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  )
}

type Conteo = Record<TipoViajero, number>

function contar(tipos: TipoViajero[]): Conteo {
  const c: Conteo = { adulto: 0, menor: 0, infante: 0 }
  for (const t of tipos) c[t]++
  if (c.adulto + c.menor + c.infante === 0) c.adulto = 1
  return c
}

/** Conteo → tipo por viajero (índice 0 = P1): adultos, luego menores, luego infantes. */
function expandir(c: Conteo): TipoViajero[] {
  const lista: TipoViajero[] = [
    ...Array<TipoViajero>(c.adulto).fill('adulto'),
    ...Array<TipoViajero>(c.menor).fill('menor'),
    ...Array<TipoViajero>(c.infante).fill('infante'),
  ]
  while (lista.length < MAX_VIAJEROS) lista.push('adulto')
  return lista.slice(0, MAX_VIAJEROS)
}

const CONTADOR_LABEL: Record<TipoViajero, string> = { adulto: 'Adultos', menor: 'Menores', infante: 'Infantes' }

/** Tres recuadros con − / +: adultos, menores e infantes. Total entre 1 y 12 (P1–P12). */
function Contadores({ conteo, onChange }: { conteo: Conteo; onChange: (c: Conteo) => void }) {
  const total = conteo.adulto + conteo.menor + conteo.infante
  const btn =
    'flex h-7 w-7 items-center justify-center rounded-md bg-white transition-colors hover:bg-slate-50 disabled:opacity-40'
  return (
    <div className="flex shrink-0 flex-wrap items-stretch gap-2 self-start sm:flex-nowrap lg:self-auto">
      {TIPOS_VIAJERO.map(t => (
        <div
          key={t}
          className="flex flex-col items-center gap-1 rounded-xl px-2.5 py-2"
          style={{ background: PAGE, border: `1px solid ${BORDER}` }}
          role="group"
          aria-label={`Cantidad de ${CONTADOR_LABEL[t].toLowerCase()}`}
        >
          <span className="font-inter text-[11px] font-semibold leading-none" style={{ color: NAVY }}>
            {CONTADOR_LABEL[t]}
          </span>
          <span className="font-inter text-[10px] leading-none" style={{ color: MUTED }}>
            {TIPO_VIAJERO_EDADES[t]}
          </span>
          <div className="mt-0.5 inline-flex items-center">
            <button
              type="button"
              aria-label={`Quitar ${CONTADOR_LABEL[t].toLowerCase()}`}
              className={btn}
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}
              disabled={conteo[t] <= 0 || total <= 1}
              onClick={() => onChange({ ...conteo, [t]: conteo[t] - 1 })}
            >
              <Minus size={12} strokeWidth={2.5} />
            </button>
            <span className="w-7 text-center font-inter text-sm font-bold tabular-nums" style={{ color: NAVY }}>
              {conteo[t]}
            </span>
            <button
              type="button"
              aria-label={`Agregar ${CONTADOR_LABEL[t].toLowerCase()}`}
              className={btn}
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}
              disabled={total >= MAX_VIAJEROS}
              onClick={() => onChange({ ...conteo, [t]: conteo[t] + 1 })}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ))}
      <div
        className="flex flex-col items-center justify-center rounded-xl px-3 py-2"
        style={{ background: ACCENT_LIGHT, border: '1px solid #C7D7F0' }}
      >
        <span className="font-inter text-[11px] font-semibold leading-none" style={{ color: ACCENT }}>
          Total
        </span>
        <span className="mt-1 font-plus-jakarta text-lg font-extrabold tabular-nums leading-none" style={{ color: NAVY }}>
          {total}
        </span>
      </div>
    </div>
  )
}

/** Qué documentos le toca a cada grupo según lo que pide el viaje. */
function ResumenPorTipo({ conteo, requisitos, sugeridos }: { conteo: Conteo; requisitos: Requisitos; sugeridos: boolean }) {
  const grupos = TIPOS_VIAJERO.filter(t => conteo[t] > 0)
  // Primer P{n} de cada grupo (adultos → menores → infantes).
  const inicio: Conteo = { adulto: 1, menor: 1 + conteo.adulto, infante: 1 + conteo.adulto + conteo.menor }
  return (
    <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-plus-jakarta text-[13px] font-bold" style={{ color: NAVY }}>
          Qué sube cada viajero
        </h4>
        <span className="font-inter text-[11px]" style={{ color: MUTED }}>
          {sugeridos ? 'Cantidades sugeridas por la liquidación: revísalas. ' : ''}
          Orden en la tarjeta: adultos, luego menores, luego infantes.
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        {grupos.map(t => {
          const docs = documentosDe(t, requisitos)
          const n = conteo[t]
          const desde = inicio[t]
          const rango = n === 1 ? `P${desde}` : `P${desde}–P${desde + n - 1}`
          return (
            <li key={t} className="rounded-xl px-3 py-2.5" style={{ background: PAGE, border: `1px solid ${BORDER}` }}>
              <p className="font-inter text-xs font-semibold" style={{ color: NAVY }}>
                {n} {n === 1 ? TIPO_VIAJERO_LABEL[t].toLowerCase() : CONTADOR_LABEL[t].toLowerCase()}{' '}
                <span className="font-normal" style={{ color: MUTED }}>· {rango}</span>
              </p>
              <p className="mt-0.5 font-inter text-[11px]" style={{ color: MUTED }}>
                {docs.length ? docs.map(d => resumenDocumento(d, t)).join(' · ') : 'Sin documentos marcados'}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TarjetaDocumento({
  doc,
  etiqueta,
  archivos,
  ocupado,
  onVer,
  onReintentar,
}: {
  doc: DocumentoRequerido
  etiqueta: string
  archivos: ArchivoPanel[]
  ocupado: string | null
  onVer: (a: ArchivoPanel) => void
  onReintentar: (a: ArchivoPanel) => void
}) {
  const Icono = ICONO[doc.tipo]
  const a = archivos.find(x => esCaraPrincipal(x.cara)) ?? null
  const legado = archivos.some(x => x.cara === 'unica')
  const faltan = legado ? [] : doc.caras.filter(c => !archivos.some(x => x.cara === c))

  if (archivos.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-[18px] p-6 text-center"
        style={{ border: `2px dashed ${BORDER}`, background: 'rgba(255,255,255,0.5)', minHeight: 180 }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: PAGE, border: `1px solid ${BORDER}`, color: MUTED }}>
          <Icono size={20} strokeWidth={1.5} />
        </span>
        <span className="font-plus-jakarta text-sm font-semibold" style={{ color: NAVY }}>{etiqueta}</span>
        <span className="font-inter text-xs" style={{ color: MUTED }}>Pendiente · el cliente aún no lo sube</span>
      </div>
    )
  }

  const estado = a?.confirmado_en ? 'confirmado' : faltan.length ? 'incompleto' : a?.datos_extraidos ? 'leido' : 'subido'
  const dot =
    estado === 'confirmado'
      ? { c: '#047857', bg: '#10B981', t: 'Confirmado' }
      : estado === 'incompleto'
        ? { c: '#B45309', bg: '#F59E0B', t: `Falta el ${CARA_LABEL[faltan[0]].toLowerCase()}` }
        : estado === 'leido'
          ? { c: '#B45309', bg: '#F59E0B', t: 'Leído, sin confirmar' }
          : { c: '#B45309', bg: '#F59E0B', t: 'Subido, sin confirmar' }
  const datos = a?.datos_confirmados ?? a?.datos_extraidos ?? null
  const lectura = !a
    ? 'falta el frente'
    : a.metodo === 'mrz'
      ? 'lectura MRZ (verificada)'
      : a.metodo === 'vision'
        ? 'lectura por visión'
        : a.metodo === 'manual'
          ? 'datos escritos a mano'
          : 'sin lectura aún'
  const notas = [...(a?.revision_requerida ? ['Revisar: la lectura no fue segura.'] : []), ...(a?.avisos ?? [])]
  const ordenadas = [...archivos].sort((x, y) => Number(esCaraPrincipal(y.cara)) - Number(esCaraPrincipal(x.cara)))

  return (
    <article className="flex flex-col justify-between overflow-hidden transition-shadow hover:shadow-[0_6px_20px_rgba(13,30,60,0.07)]" style={tarjeta}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: PAGE, border: `1px solid ${BORDER}`, color: NAVY }}>
            <Icono size={16} strokeWidth={1.8} />
          </span>
          <div>
            <h4 className="font-plus-jakarta text-sm font-bold" style={{ color: NAVY }}>{etiqueta}</h4>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot.bg }} />
              <span className="font-inter text-[11px] font-semibold" style={{ color: dot.c }}>{dot.t}</span>
            </div>
          </div>
        </div>

        <div className="rounded-md p-2 font-inter text-[11px] leading-snug" style={{ background: 'rgba(244,247,251,0.7)', border: `1px solid ${BORDER}`, color: MUTED }}>
          {fmt.format(new Date((a ?? ordenadas[0]).subido_en))} · {lectura}
          {a?.confianza ? ` · confianza ${a.confianza}` : ''}
        </div>

        {datos && (
          <dl className="flex flex-col gap-2 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
            {CAMPOS_POR_TIPO[doc.tipo]
              .filter(c => datos[c])
              .map(c => (
                <div key={c} className="flex items-baseline justify-between gap-3 font-inter text-xs">
                  <dt className="text-[11px]" style={{ color: MUTED }}>{CAMPO_LABEL[c]}</dt>
                  <dd
                    className={`text-right font-semibold tabular-nums ${c === 'numero' || c === 'documento_identidad' ? 'font-mono font-medium' : ''}`}
                    style={{ color: NAVY }}
                  >
                    {CAMPOS_FECHA.includes(c) ? fmtDia(datos[c]) : datos[c]}
                  </dd>
                </div>
              ))}
          </dl>
        )}

        {notas.map((n, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg p-2.5 font-inter text-[11px] leading-tight" style={{ background: 'rgba(255,251,235,0.7)', border: '1px solid rgba(253,230,138,0.8)', color: '#78350F' }}>
            <TriangleAlert size={16} className="mt-0.5 shrink-0" style={{ color: '#D97706' }} />
            <span>{n}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 p-4" style={{ background: 'rgba(244,247,251,0.4)', borderTop: `1px solid ${BORDER}` }}>
        {a?.confirmado_en ? (
          a.escrito_ghl_en ? (
            <span className="inline-flex items-center gap-1 font-inter text-[11px] font-medium" style={{ color: '#047857' }}>
              Escrito en P{a.viajero} de la tarjeta <Check size={12} strokeWidth={2.5} />
            </span>
          ) : (
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() => onReintentar(a)}
              title={a.error_ghl ?? undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 font-inter text-xs font-medium disabled:opacity-50"
              style={{ border: `1px solid #FECDD3`, color: '#BE123C' }}
            >
              {ocupado === `ghl-${a.id}` ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Escribir en GHL
            </button>
          )
        ) : (
          <span className="font-inter text-[11px]" style={{ color: MUTED }}>Aún no se escribe en la tarjeta</span>
        )}
        <div className="flex flex-wrap gap-1.5">
          {ordenadas.map(x => (
            <button
              key={x.id}
              type="button"
              disabled={ocupado !== null}
              onClick={() => onVer(x)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 font-inter text-xs font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
              style={{ border: `1px solid ${BORDER}`, color: NAVY }}
            >
              {ocupado === `ver-${x.id}` ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} style={{ color: MUTED }} />}
              {x.cara === 'unica' ? 'Ver' : `Ver ${CARA_LABEL[x.cara].toLowerCase()}`}
            </button>
          ))}
        </div>
      </div>
    </article>
  )
}
