import { createAdminClient } from '@/lib/supabase/admin'
import { getDestinos } from '@/lib/destinos'
import {
  enviarMensaje,
  obtenerContacto,
  obtenerOportunidad,
  oportunidadesDe,
  rutaDeRespuesta,
  ultimosMensajes,
  type MensajeGhl,
  type OportunidadDetalleGhl,
} from '@/lib/agente/ghl'
import { idsDeSol, registrarEnviado, salientesReales } from '@/lib/agente/conversacion'
import { nombreDe } from '@/lib/agente/anuncios'
import { registrarEvento } from '@/lib/agente/eventos'
import { esFestivo } from '@/lib/agente/festivos'
import { extraerTarjetas } from '@/lib/agente/v2/ficha'
import {
  CAMPO_IA_NOMBRE,
  CAMPOS_CALIFICACION_OPP,
  CAMPOS_SOL_OPP,
  HORARIO,
  PIPELINE,
  PIPELINES_POSTVENTA,
  REACTIVACION,
  TAGS,
  solEnPausa,
} from '@/lib/agente/config'
import { redactarConIa } from '@/lib/agente/reactivacion/ia'
import {
  capaDe,
  clasificarConversacion,
  componerMensaje,
  esWhatsappQr,
  exclusionPorTags,
  listaCorta,
  nombreDePila,
  plantilla,
  temporadaDe,
  validarSalida,
  variantePorHash,
  type Capa,
  type DecisionReactivacion,
  type FichaElegida,
  type Interes,
  type ProductoCorto,
  type Segmento,
  type Variante,
} from '@/lib/agente/reactivacion/reglas'
import type { Destino } from '@/types/destino'

/**
 * Reactivación de leads no calificados por WhatsApp (A/B: IA vs. plantilla).
 *
 * Una corrida al día (cron L-S 10:00 Bogotá):
 *  1. Candidatos baratos desde `agente_seguimientos` (Sol ya cerró sus
 *     seguimientos: `dormido`, o `cerrado` por un motivo que no descarta).
 *  2. Cada candidato pasa las compuertas contra GHL (tags, tarjeta de Leads,
 *     conversación) hasta llenar el cupo de cada variante (50/50).
 *  3. Lista corta de productos (código) → mensaje (plantilla o IA) →
 *     validación (código) → envío (texto + tarjetas #btn) → registro.
 *
 * En dry-run hace todo menos enviar: registra `dry_run` (o, con
 * `registrar: false`, ni siquiera escribe en la base) y devuelve los mensajes.
 */

const DIA_MS = 86_400_000
const ESPERA_ENTRE_MENSAJES_MS = 2000

/**
 * Motivos de cierre de `agente_seguimientos` que descartan al contacto sin
 * mirar GHL (los escribe crm.ts / seguimiento.ts). El "no le interesa" con
 * texto libre del modelo no se puede reconocer por la nota: lo atrapa la
 * temperatura de la oportunidad más adelante.
 */
const NOTAS_DESCARTE =
  /^(escalado|calificado|no es un cliente|Sol decidió no insistir|el contacto tiene stop_bot|proveedor|ya pasó|ya se escaló|la oportunidad ya está|un humano|el contacto ya no existe|Instagram|Facebook|pidió no recibir)/i

export interface ResultadoContacto {
  contactId: string
  conversationId: string
  segmento: Segmento
  capa: Capa
  variante: Variante
  decision: DecisionReactivacion
  /** En dry-run: lo que habría pasado (enviado / callar / error_validacion). */
  decisionSimulada?: DecisionReactivacion
  motivo: string
  /** Mensaje completo tal como saldría (texto + línea de baja + marcadores de ficha). */
  mensaje: string | null
  fichas: FichaElegida[]
  lista: { slug: string; nombre: string; precio: string; puntos: number }[]
  modelo: string | null
  costoUsd: number | null
}

export interface ResumenReactivacion {
  corrio: boolean
  nota?: string
  dry: boolean
  enVentana: boolean
  candidatos: number
  revisados: number
  elegibles: { rescate: number; silencioso: number }
  excluidos: Record<string, number>
  resultados: ResultadoContacto[]
}

export interface OpcionesCorrida {
  dry: boolean
  limite?: number
  /** false = no escribe nada en la base (dry-run local contra producción). */
  registrar?: boolean
  /** Revisa TODOS los candidatos (para contar elegibles), aunque el cupo ya se llenó. */
  evaluarTodos?: boolean
  ahora?: Date
}

/**
 * Ventana para escribir: días hábiles (ni domingos ni festivos), dentro del
 * horario de la agencia (para que si el cliente contesta haya quien lo
 * atienda) y dentro de la franja de la Ley 2300 de 2023 (L-V 7-19, sáb 8-15).
 * Hoy el horario de la agencia ya cae dentro de la ley; se cruzan las dos por
 * si alguno cambia.
 */
export function enVentanaDeEnvio(ahora = new Date()): boolean {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(ahora)
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  if (dia === 0 || esFestivo(fecha)) return false
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: HORARIO.zona, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(ahora)
  const h = Number(partes.find(p => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(partes.find(p => p.type === 'minute')?.value ?? 0)
  const minutos = h * 60 + m
  const [agencia, ley] = dia === 6 ? [HORARIO.sabado, { desde: 8, hasta: 15 }] : [HORARIO.semana, { desde: 7, hasta: 19 }]
  return minutos >= Math.max(agencia.desde, ley.desde) * 60 && minutos < Math.min(agencia.hasta, ley.hasta) * 60
}

interface Candidato {
  contact_id: string
  conversation_id: string
  canal: string | null
  estado: string
  nota: string | null
  actualizado_en: string
}

interface FilaPrevia {
  contact_id: string
  variante: Variante
  decision: DecisionReactivacion
  fichas: FichaElegida[] | null
  mensaje: string | null
  creado_en: string
}

interface Elegible {
  contactId: string
  conversationId: string
  segmento: Segmento
  diasSinRespuesta: number
  nombreConfirmado?: string
  nombrePerfil?: string
  nacional: boolean
  interes: Interes | null
  anuncio: { nombre: string; texto?: string; slugs: string[] } | null
  mensajes: MensajeGhl[]
}

type Evaluacion = { ok: true; e: Elegible } | { ok: false; motivo: string }

export async function correrReactivacion(op: OpcionesCorrida): Promise<ResumenReactivacion> {
  const ahora = op.ahora ?? new Date()
  const limite = Math.max(0, Math.min(op.limite ?? REACTIVACION.loteDiario, 100))
  const registrar = op.registrar ?? true
  const resumen: ResumenReactivacion = {
    corrio: false,
    dry: op.dry,
    enVentana: enVentanaDeEnvio(ahora),
    candidatos: 0,
    revisados: 0,
    elegibles: { rescate: 0, silencioso: 0 },
    excluidos: {},
    resultados: [],
  }

  if (!op.dry) {
    if (!REACTIVACION.activo) return { ...resumen, nota: 'reactivación apagada (REACTIVACION.activo = false): solo se acepta ?dry=1' }
    if (solEnPausa(ahora)) return { ...resumen, nota: 'Sol en pausa: no se reactiva a nadie' }
    if (!resumen.enVentana) return { ...resumen, nota: 'fuera de la ventana de envío (días hábiles, horario de la agencia y Ley 2300)' }
  }
  resumen.corrio = true

  const admin = createAdminClient()
  const hace = (dias: number) => new Date(ahora.getTime() - dias * DIA_MS).toISOString()

  // 1. Candidatos: Sol ya no les escribe (sin seguimiento pendiente) y su
  //    última actividad está entre 3 y 90 días atrás.
  const { data: filas, error } = await admin
    .from('agente_seguimientos')
    .select('contact_id, conversation_id, canal, estado, nota, actualizado_en')
    .in('estado', ['dormido', 'cerrado'])
    .lte('actualizado_en', hace(REACTIVACION.diasSinRespuesta))
    .gte('actualizado_en', hace(REACTIVACION.ventanaDias))
    .order('actualizado_en', { ascending: false })
    .limit(2000)
  if (error) throw new Error(`leyendo candidatos: ${error.message}`)

  // 2. Lo ya hecho: quién fue reactivado (o evaluado por la IA) en los últimos
  //    30 días, qué variante tiene cada uno y qué fichas ya se le mandaron.
  const previas = await filasPrevias(admin, op.dry)
  const porContacto = new Map<string, FilaPrevia[]>()
  for (const f of previas) porContacto.set(f.contact_id, [...(porContacto.get(f.contact_id) ?? []), f])
  const limiteReciente = hace(REACTIVACION.diasEntreReactivaciones)
  const recienTocado = (id: string) =>
    (porContacto.get(id) ?? []).some(f => ['enviado', 'callar', 'error_validacion'].includes(f.decision) && f.creado_en >= limiteReciente)

  const excluir = (motivo: string) => {
    const clave = motivo.replace(/\s*\(.*$/, '').replace(/hace [\d.]+ días.*/, 'reciente').slice(0, 80)
    resumen.excluidos[clave] = (resumen.excluidos[clave] ?? 0) + 1
  }

  const vistos = new Set<string>()
  const colas: Record<Variante, Candidato[]> = { ia: [], plantilla: [] }
  for (const c of (filas ?? []) as Candidato[]) {
    if (vistos.has(c.contact_id)) continue
    vistos.add(c.contact_id)
    if (c.canal && c.canal !== 'whatsapp') { excluir('no es WhatsApp'); continue }
    if (c.nota && NOTAS_DESCARTE.test(c.nota)) { excluir(`cierre de Sol: ${c.nota.slice(0, 40)}`); continue }
    if (recienTocado(c.contact_id)) { excluir(`ya reactivado en los últimos ${REACTIVACION.diasEntreReactivaciones} días`); continue }
    colas[varianteDe(c.contact_id, porContacto.get(c.contact_id))].push(c)
  }
  resumen.candidatos = colas.ia.length + colas.plantilla.length

  // Cupo 50/50: con un lote impar, la unidad extra va a la IA.
  const cupo: Record<Variante, number> = { ia: Math.ceil(limite / 2), plantilla: Math.floor(limite / 2) }
  const hechos: Record<Variante, number> = { ia: 0, plantilla: 0 }
  // Tope de revisiones en una corrida real (cada una son ~4 llamadas a GHL).
  const maxRevisados = op.evaluarTodos ? Infinity : Math.max(limite * 8, 20)

  const destinos = await getDestinos()
  const temporada = temporadaDe(ahora)

  // Se alterna entre las colas para que las dos variantes avancen parejo.
  const orden: { c: Candidato; v: Variante }[] = []
  for (let i = 0; i < Math.max(colas.ia.length, colas.plantilla.length); i++) {
    if (colas.ia[i]) orden.push({ c: colas.ia[i], v: 'ia' })
    if (colas.plantilla[i]) orden.push({ c: colas.plantilla[i], v: 'plantilla' })
  }

  for (const { c, v } of orden) {
    const lleno = hechos.ia >= cupo.ia && hechos.plantilla >= cupo.plantilla
    if (lleno && !op.evaluarTodos) break
    if (!op.evaluarTodos && hechos[v] >= cupo[v]) continue
    if (resumen.revisados >= maxRevisados) break

    resumen.revisados++
    let ev: Evaluacion
    try {
      ev = await evaluar(c, ahora)
    } catch (err) {
      excluir(`error revisando: ${(err as Error).message.slice(0, 60)}`)
      continue
    }
    if (!ev.ok) { excluir(ev.motivo); continue }
    resumen.elegibles[ev.e.segmento]++
    if (hechos[v] >= cupo[v]) continue

    // En una corrida real se re-verifica la ventana antes de cada envío (la
    // corrida puede alargarse); lo que no alcance lo recoge la de mañana.
    if (!op.dry && !enVentanaDeEnvio()) {
      resumen.nota = 'se cerró la ventana de envío a mitad de la corrida'
      break
    }

    const r = await atender(ev.e, v, { destinos, temporada, previas: porContacto.get(ev.e.contactId) ?? [], dry: op.dry })
    hechos[v]++
    resumen.resultados.push(r)
    if (registrar) await guardar(admin, r)
  }

  return resumen
}

/** Variante del contacto: la guardada si ya la tiene; si no, el hash. */
function varianteDe(contactId: string, previas?: FilaPrevia[]): Variante {
  const guardada = previas?.find(f => f.variante)?.variante
  return guardada ?? variantePorHash(contactId)
}

async function filasPrevias(admin: ReturnType<typeof createAdminClient>, dry: boolean): Promise<FilaPrevia[]> {
  const { data, error } = await admin
    .from('agente_reactivacion')
    .select('contact_id, variante, decision, fichas, mensaje, creado_en')
    .neq('decision', 'dry_run')
    .order('creado_en', { ascending: false })
    .limit(5000)
  if (error) {
    // Antes de aplicar la migración el dry-run igual funciona (sin historial).
    if (dry && /does not exist|schema cache|42P01/i.test(`${error.code} ${error.message}`)) return []
    throw new Error(`leyendo agente_reactivacion: ${error.message}`)
  }
  return (data ?? []) as FilaPrevia[]
}

/** Valor de un campo de la oportunidad (el GET por id usa varios formatos, ver OportunidadDetalleGhl). */
function campos(o: OportunidadDetalleGhl | null): Map<string, string> {
  const m = new Map<string, string>()
  for (const cf of o?.customFields ?? []) {
    const v = cf.fieldValueString ?? cf.fieldValueNumber ?? cf.fieldValue ?? cf.field_value ?? cf.fieldValueDate
    if (v == null || v === '') continue
    const texto = Array.isArray(v) ? v.join(', ') : String(v)
    if (texto.trim()) m.set(cf.id, texto.trim())
  }
  return m
}

function interesDe(o: OportunidadDetalleGhl | null): Interes | null {
  const m = campos(o)
  const t = (id: string) => m.get(id) || undefined
  const n = (id: string) => {
    const v = Number(m.get(id))
    return Number.isFinite(v) && v > 0 ? v : undefined
  }
  const i: Interes = {
    destino: t(CAMPOS_CALIFICACION_OPP.destino),
    fechas: t(CAMPOS_CALIFICACION_OPP.fechas),
    adultos: n(CAMPOS_CALIFICACION_OPP.adultos),
    ninos: n(CAMPOS_CALIFICACION_OPP.ninos),
    presupuesto: t(CAMPOS_CALIFICACION_OPP.presupuesto),
    duracion: t(CAMPOS_CALIFICACION_OPP.duracion),
    motivoViaje: t(CAMPOS_SOL_OPP.motivoViaje),
    objecion: t(CAMPOS_SOL_OPP.objecionPrincipal),
    detalleObjecion: t(CAMPOS_SOL_OPP.detalleObjecion),
    resumen: t(CAMPOS_SOL_OPP.resumen),
    temperatura: t(CAMPOS_SOL_OPP.temperatura)?.toLowerCase(),
    estadoComercial: t(CAMPOS_SOL_OPP.estadoComercial)?.toLowerCase(),
  }
  return Object.values(i).some(Boolean) ? i : null
}

/** Las compuertas contra GHL, de la más barata a la más cara. Solo lecturas. */
async function evaluar(c: Candidato, ahora: Date): Promise<Evaluacion> {
  const contacto = await obtenerContacto(c.contact_id).catch(err => {
    if (/respondió 40[04]/.test(String((err as Error).message))) return null
    throw err
  })
  if (!contacto) return { ok: false, motivo: 'el contacto ya no existe' }

  const porTags = exclusionPorTags(contacto.tags ?? [], {
    stopBot: TAGS.stopBot,
    calificado: TAGS.calificado,
    transferenciaHumano: TAGS.transferenciaHumano,
    noContactar: TAGS.noContactar,
    noCliente: TAGS.noCliente,
    extra: REACTIVACION.tagsExcluidos,
  })
  if (porTags) return { ok: false, motivo: porTags }

  const opps = await oportunidadesDe(c.contact_id)
  if (opps.some(o => o.status === 'won')) return { ok: false, motivo: 'ya compró (oportunidad ganada)' }
  if (opps.some(o => o.status === 'open' && (PIPELINES_POSTVENTA as readonly string[]).includes(o.pipelineId ?? ''))) {
    return { ok: false, motivo: 'tiene una reserva en post-venta' }
  }
  const abierta = opps.find(o => o.pipelineId === PIPELINE.id && o.status === 'open')
  if (!abierta) return { ok: false, motivo: 'sin tarjeta abierta en Leads (perdida, abandonada o sin tarjeta)' }
  if (
    (PIPELINE.etapasVedadas as readonly string[]).includes(abierta.pipelineStageId ?? '') ||
    abierta.pipelineStageId === PIPELINE.etapas.calificadoPorBot
  ) {
    return { ok: false, motivo: 'la tarjeta ya está con el equipo (Calificado por Bot o más allá)' }
  }

  const mensajes = await ultimosMensajes(c.conversation_id, 40)
  if (!esWhatsappQr(mensajes)) return { ok: false, motivo: 'la conversación no es de WhatsApp (QR)' }
  const idsSol = await idsDeSol(salientesReales(mensajes))
  if (idsSol === null) return { ok: false, motivo: 'no se pudo leer el registro de envíos de Sol' }
  const clasif = clasificarConversacion(mensajes, idsSol, ahora, REACTIVACION.diasSinRespuesta)
  if (!clasif.ok) return { ok: false, motivo: clasif.motivo }

  const interes = interesDe(await obtenerOportunidad(abierta.id))
  if (interes?.temperatura === 'no_interesado' || interes?.estadoComercial === 'no_interesado') {
    return { ok: false, motivo: 'Sol lo marcó como no interesado' }
  }

  const iaNombre = contacto.customFields?.find(f => f.id === CAMPO_IA_NOMBRE)?.value
  return {
    ok: true,
    e: {
      contactId: c.contact_id,
      conversationId: c.conversation_id,
      segmento: clasif.segmento,
      diasSinRespuesta: clasif.diasSinRespuesta,
      nombreConfirmado: typeof iaNombre === 'string' ? iaNombre : undefined,
      nombrePerfil: [contacto.firstName, contacto.lastName].filter(Boolean).join(' ') || undefined,
      // Sin teléfono = WhatsApp por QR (GHL no lo guarda): casi siempre es de Colombia.
      nacional: !contacto.phone || contacto.phone.startsWith('+57'),
      interes,
      anuncio: await anuncioLeido(c.conversation_id),
      mensajes,
    },
  }
}

/**
 * El anuncio por el que llegó la conversación, SOLO lectura (a diferencia de
 * `anuncioParaConversacion`, no re-vincula con el modelo ni escribe en la base:
 * el dry-run no puede escribir y aquí basta el vínculo que ya existe).
 */
async function anuncioLeido(conversationId: string): Promise<Elegible['anuncio']> {
  try {
    const { data } = await createAdminClient()
      .from('agente_conversacion_anuncio')
      .select('anuncio:agente_anuncios(ad_id, nombre, titulo, texto, slugs)')
      .eq('conversation_id', conversationId)
      .maybeSingle()
    type Fila = { ad_id: string; nombre: string | null; titulo: string | null; texto: string | null; slugs: string[] | null }
    const bruto = (data as { anuncio: Fila | Fila[] | null } | null)?.anuncio
    const fila = Array.isArray(bruto) ? bruto[0] : bruto
    if (!fila) return null
    return { nombre: nombreDe(fila), texto: fila.texto ?? undefined, slugs: fila.slugs ?? [] }
  } catch {
    return null
  }
}

/** Genera (plantilla o IA), valida y —si no es dry-run— envía. Nunca lanza. */
async function atender(
  e: Elegible,
  variante: Variante,
  ctx: { destinos: Destino[]; temporada: ReturnType<typeof temporadaDe>; previas: FilaPrevia[]; dry: boolean }
): Promise<ResultadoContacto> {
  const excluirSlugs = new Set(ctx.previas.flatMap(f => (f.fichas ?? []).map(x => x.slug)))
  const yaVistos = new Set(
    e.mensajes
      .filter(m => m.direction === 'outbound')
      .map(m => (m.body ?? '').match(/\/destinos\/([a-z0-9-]+)/i)?.[1]?.toLowerCase())
      .filter((s): s is string => Boolean(s))
  )
  const slugsAnuncio = e.anuncio?.slugs ?? []
  const lista: ProductoCorto[] = listaCorta(ctx.destinos, {
    interes: e.interes,
    slugsAnuncio,
    temporada: ctx.temporada,
    nacional: e.nacional,
    excluir: excluirSlugs,
    yaVistos,
  })
  const capa = capaDe(e.interes, slugsAnuncio.filter(s => lista.some(p => p.slug === s)))
  const base: ResultadoContacto = {
    contactId: e.contactId,
    conversationId: e.conversationId,
    segmento: e.segmento,
    capa,
    variante,
    decision: 'callar',
    motivo: '',
    mensaje: null,
    fichas: [],
    lista: lista.map(p => ({ slug: p.slug, nombre: p.nombre, precio: p.precio, puntos: p.puntos })),
    modelo: null,
    costoUsd: null,
  }
  const cerrar = (decision: DecisionReactivacion, motivo: string, extra: Partial<ResultadoContacto> = {}): ResultadoContacto =>
    ctx.dry
      ? { ...base, ...extra, decision: 'dry_run', decisionSimulada: decision, motivo: `[${decision}] ${motivo}` }
      : { ...base, ...extra, decision, motivo }

  if (lista.length === 0) return cerrar('callar', 'no hay productos vigentes con precio y foto para ofrecerle')

  let salida: { mensaje: string; fichas: FichaElegida[] }
  let motivo: string
  const extra: Partial<ResultadoContacto> = {}
  if (variante === 'plantilla') {
    salida = plantilla({
      segmento: e.segmento,
      capa,
      nombre: nombreDePila(e.nombreConfirmado),
      interes: e.interes,
      lista,
      temporada: ctx.temporada,
      destinos: ctx.destinos,
      slugsAnuncio,
    })
    motivo = `plantilla capa ${capa}`
  } else {
    try {
      const contextoIa = {
        segmento: e.segmento,
        capa,
        nombreConfirmado: e.nombreConfirmado,
        nombrePerfil: e.nombrePerfil,
        interes: e.interes,
        anuncio: e.anuncio ? { nombre: e.anuncio.nombre, texto: e.anuncio.texto } : null,
        lista,
        temporada: ctx.temporada.texto,
        enviadosAntes: ctx.previas.filter(f => f.decision === 'enviado' && f.mensaje).map(f => f.mensaje!),
        diasSinRespuesta: e.diasSinRespuesta,
      }
      let r = await redactarConIa(e.mensajes, contextoIa)
      extra.modelo = r.modelo
      extra.costoUsd = r.costoUsd
      // Un solo reintento con los errores a la vista: un borrador rechazado deja
      // al contacto 30 días sin mensaje (dry-run 09-oct: 5 de 10 rechazados).
      if (r.salida.accion === 'enviar') {
        const primeros = validarSalida({ mensaje: r.salida.mensaje, fichas: r.salida.fichas }, lista, REACTIVACION.promoDelMes, e.segmento)
        if (primeros.length) {
          r = await redactarConIa(e.mensajes, { ...contextoIa, correcciones: primeros })
          extra.costoUsd = (extra.costoUsd ?? 0) + (r.costoUsd ?? 0)
        }
      }
      if (r.salida.accion === 'callar') return cerrar('callar', r.salida.motivo || 'la IA decidió callar', extra)
      salida = { mensaje: r.salida.mensaje, fichas: r.salida.fichas }
      motivo = r.salida.motivo
    } catch (err) {
      // Un fallo del modelo no se reemplaza por la plantilla (contaminaría el A/B).
      return cerrar('error_validacion', `la IA falló: ${(err as Error).message.slice(0, 200)}`, extra)
    }
  }

  const errores = validarSalida(salida, lista, REACTIVACION.promoDelMes, e.segmento)
  const final = componerMensaje(salida.mensaje, salida.fichas, REACTIVACION.lineaBaja)
  extra.mensaje = final
  extra.fichas = salida.fichas
  if (errores.length) return cerrar('error_validacion', errores.join('; '), extra)
  if (ctx.dry) return cerrar('enviado', motivo, extra)

  try {
    await enviar(e, final)
  } catch (err) {
    return cerrar('error_envio', `${motivo} · envío falló: ${(err as Error).message.slice(0, 200)}`, extra)
  }
  await registrarEvento({
    tipo: 'reactivacion',
    conversationId: e.conversationId,
    contactId: e.contactId,
    direccion: 'outbound',
    autor: 'sol',
    canal: 'whatsapp',
    cuerpo: final,
    payload: { reactivacion: { variante, segmento: e.segmento, capa, fichas: salida.fichas } },
    nota: `REACTIVACIÓN (${variante}, ${e.segmento}, capa ${capa}) → enviado: ${motivo}`,
  })
  return cerrar('enviado', motivo, extra)
}

/**
 * Misma mecánica que el ejemplo aprobado (09-oct-2026): el texto primero y
 * luego cada tarjeta #btn como mensaje aparte, 2 s entre mensajes. CADA
 * messageId se registra como de Sol: si no, el siguiente turno lo leería como
 * un humano y le pondría stop_bot.
 */
async function enviar(e: Elegible, final: string): Promise<void> {
  const ruta = rutaDeRespuesta(e.mensajes)
  const { texto, tarjetas } = await extraerTarjetas(final)
  const primero = await enviarMensaje(e.contactId, texto, ruta)
  if (primero.messageId) await registrarEnviado(primero.messageId, e.conversationId, e.contactId)
  for (const t of tarjetas) {
    await new Promise(r => setTimeout(r, ESPERA_ENTRE_MENSAJES_MS))
    try {
      const envio = await enviarMensaje(e.contactId, t.codigo, ruta)
      if (envio.messageId) await registrarEnviado(envio.messageId, e.conversationId, e.contactId)
    } catch (err) {
      // El texto ya salió: una tarjeta caída no convierte el envío en error.
      console.error('reactivación: tarjeta #btn falló:', (err as Error).message)
    }
  }
}

async function guardar(admin: ReturnType<typeof createAdminClient>, r: ResultadoContacto): Promise<void> {
  const { error } = await admin.from('agente_reactivacion').insert({
    contact_id: r.contactId,
    conversation_id: r.conversationId,
    segmento: r.segmento,
    capa: r.capa,
    variante: r.variante,
    decision: r.decision,
    motivo: r.motivo.slice(0, 1000),
    mensaje: r.mensaje,
    fichas: r.fichas,
    modelo: r.modelo,
    costo_usd: r.costoUsd,
    enviado_en: r.decision === 'enviado' ? new Date().toISOString() : null,
  })
  if (error) console.error('agente_reactivacion insert:', error.message)
}
