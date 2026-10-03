'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react'
import {
  TIPO_EMOJI,
  TIPO_LABEL,
  TIPOS_DOCUMENTO,
  tiposRequeridos,
  type Requisitos,
  type TipoDocumento,
} from '@/lib/documentos/config'
import { CAMPO_LABEL, CAMPOS_FECHA, CAMPOS_POR_TIPO } from '@/lib/documentos/tipos'
import {
  actualizarRequisitosDocumentos,
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
 */

const fmt = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
const fmtDia = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '')

type Res<T> = { ok: true; datos: T } | { ok: false; error: string }

export function DocumentosTab({ opportunityId, inicial }: { opportunityId: string; inicial: EstadoDocumentos }) {
  const [estado, setEstado] = useState<EstadoDocumentos>(inicial)
  const [viajeros, setViajeros] = useState(inicial.solicitud?.viajeros ?? inicial.viajerosSugeridos)
  const [requisitos, setRequisitos] = useState<Requisitos>(inicial.solicitud?.requisitos ?? inicial.sugerencia.requisitos)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const s = estado.solicitud
  const tipos = tiposRequeridos(requisitos)
  const cambios =
    s !== null &&
    (s.viajeros !== viajeros || TIPOS_DOCUMENTO.some(t => Boolean(s.requisitos[t]) !== requisitos[t]))

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
    const reenvio = Boolean(s)
    if (reenvio && !confirm('Se genera un enlace NUEVO (el anterior deja de servir) y C-05 vuelve a avisarle al cliente. ¿Seguir?')) return
    correr('enviar', () => enviarEnlaceDocumentos(opportunityId, { viajeros, requisitos }), d => {
      setEstado(d.estado)
      setAviso({ ok: true, texto: `Enlace ${d.accion === 'Enviar' ? 'creado' : 'regenerado'} y guardado en la tarjeta. El workflow C-05 se lo manda al cliente.` })
    })
  }

  function guardarCambios() {
    correr('guardar', () => actualizarRequisitosDocumentos(opportunityId, { viajeros, requisitos }), d => {
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
    correr(`ver-${a.id}`, () => verDocumento(opportunityId, a.id), url => {
      window.open(url, '_blank', 'noopener')
    })
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

  const chip = (texto: string, color: string, bg: string) => (
    <span className="rounded-full px-2 py-0.5 font-inter text-[11px] font-semibold" style={{ color, background: bg }}>
      {texto}
    </span>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Qué pide el viaje */}
      <div>
        <h3 className="font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          ¿Qué documentos pide este viaje?
        </h3>
        <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
          {estado.destino ? <>Destino: <strong>{estado.destino}</strong>. </> : null}
          {estado.sugerencia.motivo}
          {estado.sugerencia.nota ? ` ${estado.sugerencia.nota}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {TIPOS_DOCUMENTO.map(t => (
            <label key={t} className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={requisitos[t]}
                onChange={e => setRequisitos(r => ({ ...r, [t]: e.target.checked }))}
                disabled={s?.estado === 'revocada'}
              />
              <span aria-hidden>{TIPO_EMOJI[t]}</span> {TIPO_LABEL[t]}
            </label>
          ))}
          <label className="flex items-center gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            Viajeros
            <select
              value={viajeros}
              onChange={e => setViajeros(Number(e.target.value))}
              disabled={s?.estado === 'revocada'}
              className="rounded-md px-2 py-1 font-inter text-xs"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {Array.from({ length: 8 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
          El cliente entra con los últimos 4 dígitos de su celular
          {estado.telefonoMascara ? <> (<strong>{estado.telefonoMascara}</strong>)</> : <> — <strong style={{ color: '#b91c1c' }}>el contacto no tiene celular: agrégalo en el paso Contacto</strong></>}.
          Máximo 8 viajeros (campos P1–P8).
        </p>
      </div>

      {/* Acciones del enlace */}
      <div className="flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {!s || s.estado === 'revocada' ? (
          <button
            type="button"
            disabled={ocupado !== null || tipos.length === 0 || !estado.telefonoMascara}
            onClick={enviar}
            className="flex items-center gap-2 rounded-md px-4 py-2 font-inter text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
          >
            {ocupado === 'enviar' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar enlace de documentos
          </button>
        ) : (
          <>
            {cambios && (
              <button
                type="button"
                disabled={ocupado !== null || tipos.length === 0}
                onClick={guardarCambios}
                className="flex items-center gap-2 rounded-md px-4 py-2 font-inter text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
              >
                {ocupado === 'guardar' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Guardar requisitos
              </button>
            )}
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={enviar}
              className="flex items-center gap-2 rounded-md px-3 py-2 font-inter text-sm disabled:opacity-50"
              style={{ border: '1px solid var(--border-orange)', color: 'var(--orange)' }}
            >
              {ocupado === 'enviar' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Reenviar (enlace nuevo)
            </button>
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={revocar}
              className="flex items-center gap-2 rounded-md px-3 py-2 font-inter text-sm disabled:opacity-50"
              style={{ border: '1px solid var(--border)', color: '#b91c1c' }}
            >
              <Ban size={15} /> Desactivar
            </button>
          </>
        )}
        {aviso && (
          <span className="font-inter text-sm" style={{ color: aviso.ok ? '#15803d' : '#b91c1c' }}>
            {aviso.texto}
          </span>
        )}
      </div>

      {/* Estado del enlace */}
      {s && (
        <div className="rounded-lg p-4" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
          <div className="flex flex-wrap items-center gap-2">
            {s.estado === 'activa' && chip('Enlace activo', '#1d4ed8', '#dbeafe')}
            {s.estado === 'completa' && chip('Documentos completos', '#15803d', '#dcfce7')}
            {s.estado === 'revocada' && chip('Enlace desactivado', '#991b1b', '#fee2e2')}
            {estado.progreso && chip(`${estado.progreso.confirmados}/${estado.progreso.requeridos} confirmados`, 'var(--text-primary)', 'white')}
            {s.consentimiento_en ? chip('Consentimiento ✓', '#15803d', '#dcfce7') : chip('Sin consentimiento aún', '#92400e', '#fef3c7')}
            <span className="font-inter text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Vence {fmtDia(s.vence_en.slice(0, 10))}
              {s.ultimo_acceso_en ? ` · último acceso ${fmt.format(new Date(s.ultimo_acceso_en))}` : ' · el cliente aún no ha entrado'}
            </span>
          </div>
          {estado.link && s.estado !== 'revocada' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link2 size={14} style={{ color: 'var(--text-dim)' }} />
              <code className="max-w-full truncate rounded bg-white px-2 py-1 font-mono text-[11px]" style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {estado.link}
              </code>
              <button type="button" onClick={copiar} className="flex items-center gap-1 rounded-md px-2 py-1 font-inter text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <a href={estado.link} target="_blank" rel="noopener" className="flex items-center gap-1 font-inter text-xs underline" style={{ color: 'var(--orange)' }}>
                <ExternalLink size={12} /> Abrir
              </a>
            </div>
          )}
          <p className="mt-2 font-inter text-[11px]" style={{ color: 'var(--text-muted)' }}>
            El enlace también queda en la tarjeta de GHL (campo &quot;Link de documentos&quot;); el workflow C-05 lo envía por WhatsApp y correo.
            Si C-05 aún no está armado, cópialo y mándalo tú.
          </p>
        </div>
      )}

      {/* Documentos por viajero */}
      {s && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: s.viajeros }, (_, i) => i + 1).map(n => (
            <fieldset key={n} className="rounded-lg p-4" style={{ border: '1px solid var(--border)' }}>
              <legend className="px-2 font-inter text-xs font-semibold" style={{ color: 'var(--orange)' }}>
                Viajero {n}{estado.nombres[n - 1] ? ` · ${estado.nombres[n - 1]}` : ''}
              </legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {tiposRequeridos(s.requisitos).map(t => (
                  <Celda
                    key={t}
                    tipo={t}
                    archivo={estado.archivos.find(a => a.viajero === n && a.tipo === t) ?? null}
                    ocupado={ocupado}
                    onVer={ver}
                    onReintentar={reintentar}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  )
}

function Celda({
  tipo,
  archivo: a,
  ocupado,
  onVer,
  onReintentar,
}: {
  tipo: TipoDocumento
  archivo: ArchivoPanel | null
  ocupado: string | null
  onVer: (a: ArchivoPanel) => void
  onReintentar: (a: ArchivoPanel) => void
}) {
  const estado = !a ? 'pendiente' : a.confirmado_en ? 'confirmado' : a.datos_extraidos ? 'leido' : 'subido'
  const colores: Record<string, { c: string; bg: string; t: string }> = {
    pendiente: { c: 'var(--text-dim)', bg: 'white', t: 'Pendiente' },
    subido: { c: '#92400e', bg: '#fef3c7', t: 'Subido, sin confirmar' },
    leido: { c: '#92400e', bg: '#fef3c7', t: 'Leído, sin confirmar' },
    confirmado: { c: '#15803d', bg: '#dcfce7', t: 'Confirmado' },
  }
  const k = colores[estado]
  const datos = a?.datos_confirmados ?? a?.datos_extraidos ?? null
  return (
    <div className="rounded-md p-3" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-inter text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          <span aria-hidden>{TIPO_EMOJI[tipo]}</span> {TIPO_LABEL[tipo]}
        </span>
        <span className="rounded-full px-2 py-0.5 font-inter text-[10px] font-semibold" style={{ color: k.c, background: k.bg }}>
          {k.t}
        </span>
      </div>
      {a && (
        <>
          <p className="mt-1 font-inter text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {fmt.format(new Date(a.subido_en))}
            {a.metodo ? ` · lectura ${a.metodo === 'mrz' ? 'MRZ (verificada)' : a.metodo === 'vision' ? 'por visión' : 'manual'}` : ''}
            {a.confianza ? ` · confianza ${a.confianza}` : ''}
          </p>
          {datos && (
            <dl className="mt-2 flex flex-col gap-0.5">
              {CAMPOS_POR_TIPO[tipo]
                .filter(c => datos[c])
                .map(c => (
                  <div key={c} className="flex justify-between gap-2 font-inter text-[11px]">
                    <dt style={{ color: 'var(--text-dim)' }}>{CAMPO_LABEL[c]}</dt>
                    <dd className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                      {CAMPOS_FECHA.includes(c) ? fmtDia(datos[c]) : datos[c]}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
          {(a.revision_requerida || a.avisos.length > 0) && (
            <ul className="mt-2 flex flex-col gap-1">
              {a.revision_requerida && (
                <li className="flex items-start gap-1 font-inter text-[11px]" style={{ color: '#92400e' }}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Revisar: la lectura no fue segura.
                </li>
              )}
              {a.avisos.map((v, i) => (
                <li key={i} className="flex items-start gap-1 font-inter text-[11px]" style={{ color: '#92400e' }}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {v}
                </li>
              ))}
            </ul>
          )}
          {a.confirmado_en && (
            <p className="mt-1 font-inter text-[11px]" style={{ color: a.escrito_ghl_en ? '#15803d' : '#b91c1c' }}>
              {a.escrito_ghl_en ? `Escrito en P${a.viajero} de la tarjeta ✓` : `No se escribió en GHL: ${a.error_ghl ?? 'error'}`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() => onVer(a)}
              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 font-inter text-[11px] disabled:opacity-50"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {ocupado === `ver-${a.id}` ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Ver (5 min)
            </button>
            {a.confirmado_en && !a.escrito_ghl_en && (
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => onReintentar(a)}
                className="flex items-center gap-1 rounded-md bg-white px-2 py-1 font-inter text-[11px] disabled:opacity-50"
                style={{ border: '1px solid var(--border-orange)', color: 'var(--orange)' }}
              >
                <RefreshCw size={12} /> Escribir en GHL
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
