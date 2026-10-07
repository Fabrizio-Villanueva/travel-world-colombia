'use client'

import { useMemo, useState } from 'react'
import { Loader2, Check, ChevronLeft, ChevronRight, CreditCard, FileText, Eye } from 'lucide-react'
import type { CampoReserva, ValorCampo } from '@/lib/admin/reservas'
import { guardarReserva } from '../actions'
import { DocumentosTab } from './DocumentosTab'
import type { EstadoDocumentos } from './documentos-actions'

/**
 * Wizard de reserva: un paso por carpeta del catálogo. Los campos numerados
 * (P1–P12 pasajeros, T1–T4 trayectos, Pago 1–4) se muestran como grupos
 * repetibles controlados por un contador — el representante nunca ve 48
 * campos planos.
 */

interface Props {
  opportunityId: string
  campos: CampoReserva[]
  valoresIniciales: Record<string, ValorCampo>
  prefill: Record<string, ValorCampo>
  /** Estado del portal de documentos de viajeros (pestaña "Documentos"). */
  documentos: EstadoDocumentos
}

/** Pestaña virtual (no es carpeta del catálogo): el portal seguro de documentos. */
const PASO_DOCUMENTOS = 'Documentos'

/** Prefijo de grupo: "P3 - Nombre" → "P3" · "Pago 2 - Fecha" → "Pago 2". */
function prefijoDe(nombre: string): string | null {
  const m = nombre.match(/^(.+?) - /)
  return m ? m[1] : null
}

/** Número del grupo repetible, si lo es: P3→3, T2→2, Pago 4→4. */
function numeroRepetible(prefijo: string): { serie: 'P' | 'T' | 'Pago'; n: number } | null {
  let m = prefijo.match(/^P(\d{1,2})$/)
  if (m) return { serie: 'P', n: Number(m[1]) }
  m = prefijo.match(/^T(\d)$/)
  if (m) return { serie: 'T', n: Number(m[1]) }
  m = prefijo.match(/^Pago (\d)$/)
  if (m) return { serie: 'Pago', n: Number(m[1]) }
  return null
}

const SERIE_LABEL = { P: 'Pasajero', T: 'Trayecto', Pago: 'Pago' } as const
const SERIE_MAX = { P: 12, T: 4, Pago: 4 } as const

/** Nombre visible de cada paso (la llave interna viene del catálogo). */
const ETIQUETA_PASO: Record<string, string> = {
  Facturacion: 'Datos de Facturación',
  'Generales del Viaje': 'Generales del Viaje',
  Inclusiones: 'Inclusiones y Exclusiones',
  'Plan de Pagos': 'Plan de Pagos',
}
const etiquetaPaso = (p: string) => ETIQUETA_PASO[p] ?? p

/**
 * Pasos que solo se abren con clic en su pestaña: "Guardar y seguir" nunca
 * salta a ellos. Operaciones (envío de documentos) es de quien opera la
 * reserva, no parte del flujo de la asesora, que termina en Enviar Contrato.
 */
const PASOS_APARTE = new Set(['Operaciones', PASO_DOCUMENTOS])

/* ------------------------------------------------------------------ */
/* Autosumas: la aritmética del contrato se calcula sola.              */
/* Regla de convivencia: un valor calculado (auto) se recalcula cuando */
/* cambian sus insumos; si el representante escribe encima, ese campo  */
/* pasa a manual y no se vuelve a tocar.                               */
/* ------------------------------------------------------------------ */

/** Filas de la liquidación terrestre (cada una: Tarifa por pax × Cantidad = Valor Total).
 *  TRM no es fila: es la tasa de cambio (sus cantidad/valores están ocultos). */
const FILAS_LIQUIDACION = ['ADL Sencillo', 'ADL Doble', 'ADL Multiple', 'Valor Niño', 'Valor Infante']
/** Filas que suman al total de pasajeros (TRM no es gente). */
const FILAS_PASAJEROS = ['ADL Sencillo', 'ADL Doble', 'ADL Multiple', 'Valor Niño', 'Valor Infante']

function recalcular(
  vals: Record<string, ValorCampo>,
  autosPrevios: Set<string>,
  idDe: (nombre: string) => string | undefined
): { valores: Record<string, ValorCampo>; autos: Set<string> } {
  const v = { ...vals }
  const autos = new Set(autosPrevios)

  const leer = (nombre: string): number | null => {
    const id = idDe(nombre)
    const x = id ? v[id] : undefined
    if (typeof x !== 'string' || x.trim() === '') return null
    const n = Number(x)
    return Number.isFinite(n) ? n : null
  }

  const poner = (nombre: string, valor: number | null) => {
    const id = idDe(nombre)
    if (!id) return
    const esManual = v[id] !== undefined && v[id] !== '' && !autos.has(id)
    if (esManual) return // el humano ya lo escribió: se respeta
    if (valor === null) {
      // Sin insumos: si lo habíamos calculado nosotros, se limpia (nada de totales huérfanos).
      if (autos.has(id)) {
        delete v[id]
        autos.delete(id)
      }
      return
    }
    v[id] = String(Math.round(valor * 100) / 100)
    autos.add(id)
  }

  const mul = (a: number | null, b: number | null) => (a !== null && b !== null ? a * b : null)
  const suma = (terminos: (number | null)[]) => {
    const presentes = terminos.filter((t): t is number => t !== null)
    return presentes.length ? presentes.reduce((a, b) => a + b, 0) : null
  }

  // 1. Vuelos: valor × cantidad.
  poner('Valor total Adultos Vuelos', mul(leer('Valor Adulto Vuelos'), leer('Cantidad Adultos Vuelos')))
  poner('Valor total Niños Vuelos', mul(leer('Valor Niño Vuelos'), leer('Cantidad Niños Vuelos')))

  // 2. Filas de liquidación: tarifa (o valor plan) × cantidad.
  for (const f of FILAS_LIQUIDACION) {
    const base = leer(`${f} - Tarifa por pax`) ?? leer(`${f} - Valor Plan`)
    poner(`${f} - Valor Total`, mul(base, leer(`${f} - Cantidad`)))
  }

  // 3. Totales por columna + vuelos.
  poner('Total Pasajeros - Cantidad', suma(FILAS_PASAJEROS.map(f => leer(`${f} - Cantidad`))))
  poner('Total Pasajeros - Valor Plan', suma(FILAS_PASAJEROS.map(f => leer(`${f} - Valor Plan`))))
  poner(
    'Total Pasajeros - Valor Total',
    suma([
      ...FILAS_PASAJEROS.map(f => leer(`${f} - Valor Total`)),
      leer('Valor total Adultos Vuelos'),
      leer('Valor total Niños Vuelos'),
    ])
  )

  // 4. Plan de pagos: el total del plan baja a cada pago y el saldo descuenta
  //    los abonos acumulados hasta ese pago.
  const totalPlan = leer('Total Pasajeros - Valor Total')
  let abonado = 0
  for (let n = 1; n <= 4; n++) {
    poner(`Pago ${n} - Total Plan`, totalPlan)
    const abono = leer(`Pago ${n} - Abono`)
    if (abono !== null) abonado += abono
    const total = leer(`Pago ${n} - Total Plan`)
    poner(`Pago ${n} - Saldo en Pesos`, total !== null && abono !== null ? total - abonado : null)
  }

  return { valores: v, autos }
}

const card: React.CSSProperties = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: 12,
}

export function Wizard({ opportunityId, campos, valoresIniciales, prefill, documentos }: Props) {
  const pasos = useMemo(() => {
    const vistos: string[] = []
    for (const c of campos) if (!vistos.includes(c.folder)) vistos.push(c.folder)
    // La pestaña Documentos va al final, aparte (como Operaciones): es el
    // portal seguro de documentos de viajeros, no campos del contrato.
    vistos.push(PASO_DOCUMENTOS)
    return vistos
  }, [campos])

  const porNombre = useMemo(() => new Map(campos.map(c => [c.name, c.ghlId])), [campos])
  const idDe = (nombre: string) => porNombre.get(nombre)

  // Estado inicial: valores guardados + prefill, con las autosumas ya corridas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inicial = useMemo(() => recalcular({ ...prefill, ...valoresIniciales }, new Set(), idDe), [])

  const [paso, setPaso] = useState(0)
  const [valores, setValores] = useState<Record<string, ValorCampo>>(inicial.valores)
  // Campos calculados por las autosumas: se recalculan al cambiar sus insumos
  // y se pintan azules; si el representante escribe encima, pasan a manuales.
  const [autos, setAutos] = useState<Set<string>>(inicial.autos)
  // Ids cuyo valor vino sugerido del contacto y aún no se guarda: se pintan
  // distinto para que el representante los revise en vez de confiar a ciegas.
  const [sugeridos, setSugeridos] = useState<Set<string>>(
    () => new Set(Object.keys(prefill).filter(id => valoresIniciales[id] === undefined))
  )
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  // Los contadores de pasajeros y trayectos NO son controles sueltos: son los
  // campos reales del contrato ("Contrato - Numero de Pasajeros/Trayectos").
  // Cambiarlos aquí o en el paso Contrato es lo mismo, y se guardan con
  // cualquier paso. Pagos no tiene campo equivalente → contador local.
  const idNumPasajeros = useMemo(
    () => campos.find(c => c.name === 'Contrato - Numero de Pasajeros')?.ghlId,
    [campos]
  )
  const idNumTrayectos = useMemo(
    () => campos.find(c => c.name === 'Contrato - Numero de Trayectos')?.ghlId,
    [campos]
  )

  // Mayor grupo con datos: el piso de cada contador cuando el campo está vacío.
  const conDatos = useMemo(() => {
    const con = { P: 1, T: 1, Pago: 1 }
    for (const c of campos) {
      const rep = prefijoDe(c.name) ? numeroRepetible(prefijoDe(c.name)!) : null
      if (rep && (valoresIniciales[c.ghlId] !== undefined || prefill[c.ghlId] !== undefined)) {
        con[rep.serie] = Math.max(con[rep.serie], rep.n)
      }
    }
    return con
  }, [campos, valoresIniciales, prefill])

  const [cuentaPago, setCuentaPago] = useState(() => conDatos.Pago)

  function leerCuenta(id: string | undefined, tope: number, piso: number): number {
    const v = id ? valores[id] : undefined
    const n = typeof v === 'string' ? Number(v) : NaN
    const base = Number.isInteger(n) && n >= 1 ? n : piso
    return Math.min(Math.max(base, 1), tope)
  }

  const cuenta: Record<'P' | 'T' | 'Pago', number> = {
    P: leerCuenta(idNumPasajeros, SERIE_MAX.P, conDatos.P),
    T: leerCuenta(idNumTrayectos, SERIE_MAX.T, conDatos.T),
    Pago: cuentaPago,
  }

  function ponerCuenta(serie: 'P' | 'T' | 'Pago', n: number) {
    if (serie === 'Pago') return setCuentaPago(n)
    const id = serie === 'P' ? idNumPasajeros : idNumTrayectos
    if (id) poner(id, String(n))
  }

  const carpetaActual = pasos[paso]
  const camposDelPaso = campos.filter(c => c.folder === carpetaActual)

  // ¿Está marcada la opción "Preview Documento" en este paso? Se busca por la
  // opción (no por el id del campo) para no depender del catálogo de GHL: si
  // el campo "¿Enviar contrato?" cambia de id o de carpeta, la guía lo sigue.
  const previewMarcado = camposDelPaso.some(c => {
    if (c.dataType !== 'MULTIPLE_OPTIONS' || !(c.options ?? []).some(o => /preview/i.test(o))) return false
    const v = valores[c.ghlId]
    return Array.isArray(v) && v.some(x => /preview/i.test(x))
  })

  // Grupos del paso: los repetibles visibles según el contador + los sueltos.
  const { grupos, sueltos, series } = useMemo(() => {
    const grupos = new Map<string, CampoReserva[]>()
    const sueltos: CampoReserva[] = []
    const series = new Set<'P' | 'T' | 'Pago'>()
    for (const c of camposDelPaso) {
      const pref = prefijoDe(c.name)
      const rep = pref ? numeroRepetible(pref) : null
      if (rep) {
        series.add(rep.serie)
        if (rep.n > cuenta[rep.serie]) continue // fuera del contador: oculto
      }
      if (pref && camposDelPaso.filter(x => prefijoDe(x.name) === pref).length >= 2) {
        if (!grupos.has(pref)) grupos.set(pref, [])
        grupos.get(pref)!.push(c)
      } else {
        sueltos.push(c)
      }
    }
    return { grupos, sueltos, series }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camposDelPaso, cuenta.P, cuenta.T, cuenta.Pago])

  function poner(id: string, v: ValorCampo) {
    // Editar a mano un campo calculado lo vuelve manual: las autosumas dejan
    // de tocarlo. Después del cambio, la aritmética se recorre completa.
    const autosSinEste = new Set(autos)
    autosSinEste.delete(id)
    const r = recalcular({ ...valores, [id]: v }, autosSinEste, idDe)
    setValores(r.valores)
    setAutos(r.autos)
    setSugeridos(prev => {
      if (!prev.has(id)) return prev
      const s = new Set(prev)
      s.delete(id)
      return s
    })
  }

  async function guardarPaso(avanzar: boolean) {
    setGuardando(true)
    setAviso(null)
    try {
      // Se guarda TODO lo visible del paso con valor (PUT idempotente, GHL
      // hace merge): así los sugeridos revisados también quedan escritos.
      const visibles = [...grupos.values()].flat().concat(sueltos)
      const lote: Record<string, ValorCampo> = {}
      for (const c of visibles) {
        const v = valores[c.ghlId]
        if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) lote[c.ghlId] = v
      }
      // Los contadores (campos reales del contrato) viajan con cualquier paso:
      // el representante pudo ajustarlos desde el encabezado.
      for (const id of [idNumPasajeros, idNumTrayectos]) {
        const v = id ? valores[id] : undefined
        if (id && typeof v === 'string' && v !== '') lote[id] = v
      }
      const r = await guardarReserva(opportunityId, lote)
      if (!r.ok) {
        setAviso({ ok: false, texto: `No se pudo guardar: ${r.error}` })
        return
      }
      setSugeridos(prev => {
        const s = new Set(prev)
        for (const id of Object.keys(lote)) s.delete(id)
        return s
      })
      setAviso({ ok: true, texto: r.guardados ? `${r.guardados} campos guardados en GHL.` : 'Nada nuevo que guardar.' })
      if (avanzar && paso < pasos.length - 1 && !PASOS_APARTE.has(pasos[paso + 1])) setPaso(paso + 1)
    } catch (e) {
      // Un throw aquí ya no viene de la lógica de guardado (eso vuelve como
      // dato): casi siempre es que el navegador tiene una versión vieja del
      // panel tras un despliegue y la acción del servidor ya no existe.
      const m = (e as Error).message ?? ''
      setAviso({
        ok: false,
        texto: /Server (Components|Action|Functions)|Failed to find/i.test(m)
          ? 'El panel se actualizó mientras tenías esta página abierta. Recarga la página (F5) y vuelve a guardar — no se perdió nada de lo ya guardado.'
          : `No se pudo guardar: ${m}`,
      })
    } finally {
      setGuardando(false)
    }
  }

  // Los contadores de avance miran solo los campos que el contrato imprime:
  // el objetivo del wizard es un contrato completo, no llenar el catálogo TMS.
  function llenosEn(carpeta: string): number {
    return campos.filter(
      c =>
        c.folder === carpeta &&
        c.enContrato &&
        valores[c.ghlId] !== undefined &&
        valores[c.ghlId] !== '' &&
        !sugeridos.has(c.ghlId)
    ).length
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pasos */}
      <div className="flex flex-wrap gap-1.5">
        {pasos.map((p, i) => {
          const activo = i === paso
          const llenos = llenosEn(p)
          const total = campos.filter(c => c.folder === p && c.enContrato).length
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPaso(i)}
              className={`rounded-full px-3 py-1.5 font-inter text-xs transition-colors${PASOS_APARTE.has(p) ? ' ml-3' : ''}`}
              style={{
                background: activo ? 'var(--orange)' : 'white',
                color: activo ? 'var(--orange-contrast)' : 'var(--text-dim)',
                border: '1px solid ' + (activo ? 'var(--orange)' : 'var(--border)'),
                borderStyle: PASOS_APARTE.has(p) ? 'dashed' : 'solid',
                fontWeight: activo ? 600 : 400,
              }}
            >
              {i + 1}. {etiquetaPaso(p)}
              {llenos > 0 && <span className="ml-1 opacity-70">({llenos}/{total})</span>}
            </button>
          )
        })}
      </div>

      {carpetaActual === PASO_DOCUMENTOS ? (
        // La pestaña trae su propio layout (título, resumen y tarjetas).
        <DocumentosTab opportunityId={opportunityId} inicial={documentos} />
      ) : (
      <div className="p-5" style={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-inter text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {etiquetaPaso(carpetaActual)}
          </h2>

          {/* Contadores de grupos repetibles del paso */}
          <div className="flex gap-3">
            {[...series].map(s => (
              <label key={s} className="flex items-center gap-2 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
                {s === 'P' ? '¿Cuántos pasajeros?' : s === 'T' ? '¿Cuántos trayectos?' : '¿Cuántos pagos?'}
                <select
                  value={cuenta[s]}
                  onChange={e => ponerCuenta(s, Number(e.target.value))}
                  className="rounded-md px-2 py-1 font-inter text-xs"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {Array.from({ length: SERIE_MAX[s] }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        {carpetaActual === 'Contacto' && (
          <p className="mb-4 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            Verifica el teléfono y el correo: el contrato se envía a estos datos y sin ellos
            correctos no llega. El teléfono va con indicativo (ej. +57 320 000 0000).
          </p>
        )}

        {sugeridos.size > 0 && (
          <p className="mb-4 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#fffbeb', color: '#92400e' }}>
            Los campos en amarillo vienen sugeridos del CRM (calificación de Sol / datos previos).
            Revísalos: al guardar el paso quedan escritos en la oportunidad.
          </p>
        )}

        {autos.size > 0 && camposDelPaso.some(c => autos.has(c.ghlId)) && (
          <p className="mb-4 rounded-md px-3 py-2 font-inter text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            Los campos en azul se calculan solos (tarifa × cantidad, totales y saldos).
            Si escribes encima, tu valor manda y no se recalcula.
          </p>
        )}

        {/* Campos sueltos que el contrato imprime: la cara principal del paso. */}
        {sueltos.filter(c => c.enContrato).length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sueltos.filter(c => c.enContrato).map(c => (
              <Campo key={c.ghlId} campo={c} valor={valores[c.ghlId]} sugerido={sugeridos.has(c.ghlId)} auto={autos.has(c.ghlId)} onChange={poner} />
            ))}
          </div>
        )}

        {/* Grupos (pasajeros, trayectos, pagos, filas de liquidación) */}
        {[...grupos.entries()].map(([pref, items]) => {
          const rep = numeroRepetible(pref)
          // TRM es la tasa de cambio, no una fila de pasajeros: título claro.
          const titulo = rep ? `${SERIE_LABEL[rep.serie]} ${rep.n}` : pref === 'TRM' ? 'Tasa de cambio (TRM)' : pref
          return (
            <fieldset
              key={pref}
              className="mt-4 rounded-lg p-4"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-alt)' }}
            >
              <legend className="px-2 font-inter text-xs font-semibold" style={{ color: 'var(--orange)' }}>
                {titulo}
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(c => (
                  <Campo key={c.ghlId} campo={c} valor={valores[c.ghlId]} sugerido={sugeridos.has(c.ghlId)} auto={autos.has(c.ghlId)} onChange={poner} />
                ))}
              </div>
            </fieldset>
          )
        })}

        {/* Campos operativos (catálogo TMS): no salen en el contrato, van plegados
            para que el formulario calque el documento. */}
        {sueltos.some(c => !c.enContrato) && (
          <details className="mt-4 rounded-lg" style={{ border: '1px dashed var(--border)' }}>
            <summary
              className="cursor-pointer px-4 py-3 font-inter text-xs font-semibold"
              style={{ color: 'var(--text-dim)' }}
            >
              Campos de operación ({sueltos.filter(c => !c.enContrato).length}) — no salen en el
              contrato
            </summary>
            <div className="grid grid-cols-1 gap-4 p-4 pt-1 sm:grid-cols-2">
              {sueltos.filter(c => !c.enContrato).map(c => (
                <Campo key={c.ghlId} campo={c} valor={valores[c.ghlId]} sugerido={sugeridos.has(c.ghlId)} auto={autos.has(c.ghlId)} onChange={poner} />
              ))}
            </div>
          </details>
        )}

        {/* Acciones */}
        <div className="mt-6 flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button
            type="button"
            disabled={paso === 0 || guardando}
            onClick={() => setPaso(paso - 1)}
            className="flex items-center gap-1 rounded-md px-3 py-2 font-inter text-sm disabled:opacity-40"
            style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            <ChevronLeft size={15} /> Anterior
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={() => guardarPaso(false)}
            className="flex items-center gap-2 rounded-md px-4 py-2 font-inter text-sm font-semibold disabled:opacity-60"
            style={{ border: '1px solid var(--border-orange)', color: 'var(--orange)' }}
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Guardar paso
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={() => guardarPaso(true)}
            className="flex items-center gap-1 rounded-md px-4 py-2 font-inter text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
          >
            Guardar y seguir <ChevronRight size={15} />
          </button>

          {aviso && (
            <span className="font-inter text-sm" style={{ color: aviso.ok ? '#15803d' : '#b91c1c' }}>
              {aviso.texto}
            </span>
          )}
        </div>
      </div>
      )}

      {/* Guía de 3 pasos al marcar "Preview Documento": dónde ver el borrador en GHL. */}
      {previewMarcado && <GuiaPreviewContrato />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Guía "Preview Documento": el borrador NO se abre aquí — queda en    */
/* GHL, y estas tarjetas muestran el camino para encontrarlo.          */
/* ------------------------------------------------------------------ */

function GuiaPreviewContrato() {
  const pasos = [
    {
      titulo: 'Abre la sección Pagos',
      texto: 'En el menú izquierdo de la plataforma, entra a la sección Pagos.',
      mock: (
        // Mini menú lateral con "Pagos" resaltado.
        <div className="flex w-32 flex-col gap-1.5 rounded-lg bg-white p-2" style={{ border: '1px solid var(--border)' }}>
          {['a', 'b'].map(k => (
            <div key={k} className="h-2 w-4/5 rounded-full" style={{ background: 'var(--border)' }} />
          ))}
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5" style={{ background: 'var(--navy, #0d1e3c)' }}>
            <CreditCard size={11} style={{ color: '#fff' }} />
            <span className="font-inter text-[10px] font-bold text-white">Pagos</span>
          </div>
          {['c', 'd'].map(k => (
            <div key={k} className="h-2 w-4/5 rounded-full" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      ),
    },
    {
      titulo: 'Documentos y contratos',
      texto: 'Dentro de Pagos, abre "Documentos y contratos" y luego "Todos los archivos y contratos".',
      mock: (
        // Mini lista con la opción resaltada.
        <div className="flex w-44 flex-col gap-1.5 rounded-lg bg-white p-2" style={{ border: '1px solid var(--border)' }}>
          <div className="h-2 w-2/3 rounded-full" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5" style={{ background: 'color-mix(in srgb, var(--orange) 14%, transparent)', border: '1px solid var(--border-orange)' }}>
            <FileText size={11} style={{ color: 'var(--orange)' }} />
            <span className="font-inter text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>Documentos y contratos</span>
          </div>
          <div className="rounded-md px-2 py-1 font-inter text-[10px]" style={{ color: 'var(--text-dim)' }}>
            → Todos los archivos y contratos
          </div>
        </div>
      ),
    },
    {
      titulo: 'Previsualiza el borrador',
      texto: 'Abre el contrato que aparece como Borrador y haz clic en "Previsualizar".',
      mock: (
        // Mini fila de documento con chip Borrador + botón Previsualizar.
        <div className="flex w-48 flex-col gap-2 rounded-lg bg-white p-2.5" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FileText size={12} style={{ color: 'var(--text-dim)' }} />
              <div className="h-2 w-14 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <span className="rounded-full px-1.5 py-0.5 font-inter text-[9px] font-bold" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }}>
              Borrador
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-md py-1.5" style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}>
            <Eye size={11} />
            <span className="font-inter text-[10px] font-bold">Previsualizar</span>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="p-5" style={card}>
      <h3 className="font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        ¿Dónde veo el documento? — 3 pasos
      </h3>
      <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
        Al marcar &quot;Preview Documento&quot; el contrato queda como borrador dentro de la
        plataforma. Así lo encuentras:
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {pasos.map((p, i) => (
          <div key={p.titulo} className="flex flex-col overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <div aria-hidden className="flex h-36 items-center justify-center p-4" style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--border)' }}>
              {p.mock}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <span className="font-inter text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--orange)' }}>
                Paso {i + 1}
              </span>
              <span className="font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {p.titulo}
              </span>
              <span className="font-inter text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {p.texto}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Un campo del formulario, según su dataType de GHL. */
function Campo({
  campo, valor, sugerido, auto, onChange,
}: {
  campo: CampoReserva
  valor: ValorCampo | undefined
  sugerido: boolean
  auto: boolean
  onChange: (id: string, v: ValorCampo) => void
}) {
  // La etiqueta sin el prefijo del grupo ("P3 - Documento" → "Documento").
  // 'Destino de interés' se muestra como 'Destino' en el paso Contrato (el
  // nombre GHL no se toca: el catálogo TMS lo busca por nombre exacto).
  const etiqueta =
    campo.name === 'Destino de interés' ? 'Destino' : campo.name.replace(/^.+? - /, '')
  const base: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    background: auto ? '#eff6ff' : sugerido ? '#fffbeb' : 'white',
  }
  const clase = 'w-full rounded-md px-3 py-2 font-inter text-sm outline-none'

  return (
    <label className="block">
      <span className="mb-1 block font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
        {etiqueta}
      </span>

      {campo.dataType === 'LARGE_TEXT' ? (
        <textarea
          rows={3}
          value={(valor as string) ?? ''}
          onChange={e => onChange(campo.ghlId, e.target.value)}
          className={clase}
          style={base}
        />
      ) : campo.dataType === 'SINGLE_OPTIONS' ? (
        <select
          value={(valor as string) ?? ''}
          onChange={e => onChange(campo.ghlId, e.target.value)}
          className={clase}
          style={base}
        >
          <option value="">—</option>
          {(campo.options ?? []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : campo.dataType === 'MULTIPLE_OPTIONS' ? (
        <div className="flex flex-col gap-1 rounded-md p-3" style={base}>
          {(campo.options ?? []).map(o => {
            const marcadas = Array.isArray(valor) ? valor : []
            const activa = marcadas.includes(o)
            return (
              <label key={o} className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={activa}
                  onChange={() =>
                    onChange(campo.ghlId, activa ? marcadas.filter(x => x !== o) : [...marcadas, o])
                  }
                />
                {o}
              </label>
            )
          })}
        </div>
      ) : (
        <input
          type={campo.dataType === 'DATE' ? 'date' : campo.dataType === 'NUMERICAL' ? 'number' : campo.dataType === 'PHONE' ? 'tel' : campo.dataType === 'EMAIL' ? 'email' : 'text'}
          step={campo.dataType === 'NUMERICAL' ? 'any' : undefined}
          value={(valor as string) ?? ''}
          onChange={e => onChange(campo.ghlId, e.target.value)}
          className={clase}
          style={base}
        />
      )}
    </label>
  )
}
