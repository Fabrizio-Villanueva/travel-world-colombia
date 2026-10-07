import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE } from '@/lib/site'
import {
  actualizarCamposOportunidad,
  crearNota,
  moverOportunidad,
  obtenerContacto,
  obtenerOportunidad,
} from '@/lib/agente/ghl'
import { hashToken, nuevoToken } from '@/lib/documentos/token'
import { contratoDesdeGhl } from './desde-ghl'
import { firmaImpresion } from './acceso'
import { origenInterno, pdfDeUrl } from './pdf'
import {
  BUCKET_CONTRATOS,
  CAMPOS_CONTRATO,
  DIAS_VIGENCIA_CONTRATO,
  ETAPA_CONTRATO_ENVIADO,
  ETAPA_CONTRATO_FIRMADO,
  MAX_BYTES_FIRMA,
  PIPELINE_RESERVACIONES,
  urlContrato,
  type EstadoContratoGhl,
} from './config'
import type { ContratoDatos } from './tipos'

/**
 * Ciclo de vida de un contrato: se crea desde la oportunidad (foto congelada
 * de su contenido), se envía (GHL manda el enlace), el cliente lo ve y lo
 * firma, y el servidor genera el PDF final con la hoja de evidencia.
 */

export interface EventoContrato {
  tipo: 'creado' | 'codigo_enviado' | 'verificado' | 'visto' | 'firmado' | 'pdf' | 'anulado' | 'descargado'
  en: string
  ip?: string
  ua?: string
  detalle?: string
}

export interface ContratoRow {
  id: string
  opportunity_id: string
  contact_id: string | null
  token_hash: string
  estado: 'enviado' | 'firmado' | 'anulado'
  datos: ContratoDatos
  datos_sha256: string
  reserva: string | null
  titular: string | null
  telefono_ultimos4: string | null
  creado_por: string
  creado_en: string
  vence_en: string
  otp_hash: string | null
  otp_vence: string | null
  otp_intentos: number
  otp_ultimo_envio_en: string | null
  fallos_totales: number
  eventos: EventoContrato[]
  visto_en: string | null
  firmado_en: string | null
  firmante_nombre: string | null
  firmante_documento: string | null
  firma_ip: string | null
  firma_ua: string | null
  firma_ruta: string | null
  pdf_ruta: string | null
  pdf_sha256: string | null
  anulado_en: string | null
  anulado_motivo: string | null
}

const admin = () => createAdminClient()

export const sha256 = (datos: string | Buffer) => createHash('sha256').update(datos).digest('hex')

/** Huella del contenido: JSON con llaves ordenadas (estable entre lecturas). */
export function huellaDatos(datos: ContratoDatos): string {
  const ordenar = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(ordenar)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordenar((v as Record<string, unknown>)[k])]))
        : v
  return sha256(JSON.stringify(ordenar(datos)))
}

/* ------------------------------------------------------------------ */
/* Lecturas                                                            */
/* ------------------------------------------------------------------ */

export async function contratoPorToken(token: string): Promise<ContratoRow | null> {
  const { data } = await admin().from('contratos').select('*').eq('token_hash', hashToken(token)).maybeSingle()
  return (data as ContratoRow | null) ?? null
}

export async function contratoPorId(id: string): Promise<ContratoRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await admin().from('contratos').select('*').eq('id', id).maybeSingle()
  return (data as ContratoRow | null) ?? null
}

/** El contrato más reciente de una oportunidad (cualquier estado). */
export async function contratoDeOportunidad(opportunityId: string): Promise<ContratoRow | null> {
  const { data } = await admin()
    .from('contratos')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as ContratoRow | null) ?? null
}

export type EstadoEnlaceContrato = 'ok' | 'firmado' | 'no-existe' | 'vencido' | 'anulado'

export function estadoEnlaceContrato(c: ContratoRow | null): EstadoEnlaceContrato {
  if (!c) return 'no-existe'
  if (c.estado === 'anulado') return 'anulado'
  if (c.estado === 'firmado') return 'firmado'
  if (new Date(c.vence_en).getTime() < Date.now()) return 'vencido'
  return 'ok'
}

export async function registrarEvento(id: string, evento: Omit<EventoContrato, 'en'>): Promise<void> {
  const { error } = await admin().rpc('ct_evento', { p_id: id, p_evento: { ...evento, en: new Date().toISOString() } })
  if (error) console.error('[contratos] evento no registrado:', error.message)
}

async function estadoGhl(opportunityId: string, estado: EstadoContratoGhl): Promise<void> {
  await actualizarCamposOportunidad(opportunityId, [{ id: CAMPOS_CONTRATO.estado, field_value: estado }]).catch(e =>
    console.error('[contratos] estado en GHL:', e)
  )
}

/* ------------------------------------------------------------------ */
/* Crear, enviar, anular                                               */
/* ------------------------------------------------------------------ */

/** Problemas que impiden mandar el contrato (se le muestran a la asesora). */
export function problemasParaEnviar(d: ContratoDatos): string[] {
  const p: string[] = []
  if (!d.reserva) p.push('Falta el número de reserva (campo TWC).')
  if (!d.titular.nombre) p.push('Falta el titular de la reserva.')
  if (d.pasajeros.length === 0) p.push('No hay pasajeros (P1 – Nombre y Apellido).')
  if (!d.viaje.fechaIda) p.push('Falta la fecha confirmada de salida.')
  if (!d.liquidacion.total.valorTotal) p.push('La liquidación está en cero.')
  return p
}

/** Dispara el workflow de GHL que manda el enlace: vacía y escribe la acción. */
async function dispararEnvio(opportunityId: string, accion: 'Enviar' | 'Reenviar'): Promise<void> {
  await actualizarCamposOportunidad(opportunityId, [{ id: CAMPOS_CONTRATO.enviar, field_value: '' }])
  await actualizarCamposOportunidad(opportunityId, [{ id: CAMPOS_CONTRATO.enviar, field_value: accion }])
}

export interface ContratoEnviado {
  contrato: ContratoRow
  url: string
}

/**
 * Crea la foto congelada del contrato y la envía. Si la oportunidad ya tenía
 * un contrato sin firmar, ese queda ANULADO (el enlace viejo deja de servir):
 * el cliente siempre firma la última versión.
 */
export async function crearYEnviarContrato(opportunityId: string, creadoPor: string): Promise<ContratoEnviado> {
  const datos = await contratoDesdeGhl(opportunityId)
  const problemas = problemasParaEnviar(datos)
  if (problemas.length) throw new Error(problemas.join(' '))

  const oportunidad = await obtenerOportunidad(opportunityId)
  const extra = oportunidad as { contactId?: string; contact?: { id?: string } } | null
  const contactId = extra?.contactId ?? extra?.contact?.id ?? null
  const contacto = contactId ? await obtenerContacto(contactId) : null
  const digitos = (contacto?.phone ?? '').replace(/\D/g, '')
  if (digitos.length < 7 && !contacto?.email) {
    throw new Error('El contacto no tiene celular ni correo en GHL: el cliente no podría recibir su código de acceso.')
  }

  const anterior = await contratoDeOportunidad(opportunityId)
  if (anterior?.estado === 'firmado') {
    throw new Error('Esta reserva ya tiene un contrato firmado. Anúlalo primero si de verdad necesitas una versión nueva.')
  }
  if (anterior?.estado === 'enviado') await anularContrato(anterior.id, 'Reemplazado por una versión nueva', creadoPor, false)

  const token = nuevoToken()
  const { data, error } = await admin()
    .from('contratos')
    .insert({
      opportunity_id: opportunityId,
      contact_id: contactId,
      token_hash: hashToken(token),
      datos,
      datos_sha256: huellaDatos(datos),
      reserva: datos.reserva,
      titular: datos.titular.nombre,
      telefono_ultimos4: digitos.length >= 4 ? digitos.slice(-4) : null,
      creado_por: creadoPor,
      vence_en: new Date(Date.now() + DIAS_VIGENCIA_CONTRATO * 86_400_000).toISOString(),
      eventos: [{ tipo: 'creado', en: new Date().toISOString(), detalle: `Emitido por ${creadoPor}` }],
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  const contrato = data as ContratoRow

  const url = urlContrato(SITE.url, token)
  await actualizarCamposOportunidad(opportunityId, [
    { id: CAMPOS_CONTRATO.link, field_value: url },
    { id: CAMPOS_CONTRATO.estado, field_value: 'Enviado' },
    { id: CAMPOS_CONTRATO.pdf, field_value: '' },
  ])
  await dispararEnvio(opportunityId, anterior ? 'Reenviar' : 'Enviar')
  if (oportunidad?.pipelineId === PIPELINE_RESERVACIONES && oportunidad.pipelineStageId !== ETAPA_CONTRATO_ENVIADO) {
    await moverOportunidad(opportunityId, PIPELINE_RESERVACIONES, ETAPA_CONTRATO_ENVIADO).catch(e =>
      console.error('[contratos] mover a Contrato Enviado:', e)
    )
  }
  return { contrato, url }
}

/** Vuelve a mandar el aviso (mismo enlace) por el workflow de GHL. */
export async function reenviarAvisoContrato(opportunityId: string): Promise<void> {
  const c = await contratoDeOportunidad(opportunityId)
  if (!c || estadoEnlaceContrato(c) !== 'ok') throw new Error('No hay un contrato vigente sin firmar: envía uno nuevo.')
  await dispararEnvio(opportunityId, 'Reenviar')
}

export async function anularContrato(id: string, motivo: string, por: string, limpiarGhl = true): Promise<void> {
  const c = await contratoPorId(id)
  if (!c || c.estado === 'anulado') return
  await admin()
    .from('contratos')
    .update({ estado: 'anulado', anulado_en: new Date().toISOString(), anulado_motivo: motivo })
    .eq('id', id)
  await registrarEvento(id, { tipo: 'anulado', detalle: `${motivo} (${por})` })
  if (limpiarGhl) {
    await actualizarCamposOportunidad(c.opportunity_id, [
      { id: CAMPOS_CONTRATO.link, field_value: '' },
      { id: CAMPOS_CONTRATO.estado, field_value: 'Anulado' },
    ]).catch(e => console.error('[contratos] limpiar GHL al anular:', e))
  }
}

/** Primera vez que el cliente abre el contrato ya verificado. */
export async function marcarVisto(c: ContratoRow, ip: string, ua: string): Promise<void> {
  if (c.visto_en || c.estado !== 'enviado') return
  const { data } = await admin()
    .from('contratos')
    .update({ visto_en: new Date().toISOString() })
    .eq('id', c.id)
    .is('visto_en', null)
    .select('id')
  if (!data?.length) return
  await registrarEvento(c.id, { tipo: 'visto', ip, ua })
  await estadoGhl(c.opportunity_id, 'Visto')
}

/* ------------------------------------------------------------------ */
/* Firma y PDF                                                         */
/* ------------------------------------------------------------------ */

export interface DatosFirma {
  /** data:image/png;base64,… del trazo dibujado en el navegador. */
  firmaPng: string
  nombre: string
  documento: string
  ip: string
  ua: string
}

function pngDeDataUrl(dataUrl: string): Buffer {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) throw new Error('La firma no llegó bien. Vuelve a dibujarla.')
  const png = Buffer.from(m[1], 'base64')
  if (png.length < 200) throw new Error('La firma está vacía. Dibújala en el recuadro.')
  if (png.length > MAX_BYTES_FIRMA) throw new Error('La firma es demasiado grande. Bórrala y vuelve a dibujarla.')
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('La firma no es una imagen válida.')
  return png
}

/**
 * Registra la firma (una sola vez: la actualización exige estado `enviado`),
 * genera el PDF final y avisa a GHL. Si el PDF falla, la firma ya quedó
 * guardada y el PDF se puede regenerar (asegurarPdf).
 */
export async function firmarContrato(c: ContratoRow, f: DatosFirma, host?: string | null): Promise<ContratoRow> {
  if (estadoEnlaceContrato(c) !== 'ok') throw new Error('Este contrato ya no se puede firmar.')
  const nombre = f.nombre.trim().replace(/\s+/g, ' ')
  const documento = f.documento.trim().replace(/\s+/g, ' ')
  if (nombre.length < 5) throw new Error('Escribe tu nombre completo.')
  if (documento.replace(/\D/g, '').length < 5) throw new Error('Escribe tu número de documento.')
  const png = pngDeDataUrl(f.firmaPng)

  const firmaRuta = `${c.opportunity_id}/${c.id}/firma.png`
  const { error: errSubida } = await admin()
    .storage.from(BUCKET_CONTRATOS)
    .upload(firmaRuta, png, { contentType: 'image/png', upsert: true })
  if (errSubida) throw new Error('No pudimos guardar tu firma. Intenta de nuevo.')

  const ahora = new Date().toISOString()
  const { data, error } = await admin()
    .from('contratos')
    .update({
      estado: 'firmado',
      firmado_en: ahora,
      firmante_nombre: nombre,
      firmante_documento: documento,
      firma_ip: f.ip,
      firma_ua: f.ua.slice(0, 400),
      firma_ruta: firmaRuta,
    })
    .eq('id', c.id)
    .eq('estado', 'enviado')
    .select('*')
  if (error) throw new Error('No pudimos registrar la firma. Intenta de nuevo.')
  if (!data?.length) throw new Error('Este contrato ya fue firmado.')
  await registrarEvento(c.id, { tipo: 'firmado', ip: f.ip, ua: f.ua.slice(0, 400), detalle: `${nombre} · ${documento}` })

  let firmado = data[0] as ContratoRow
  try {
    firmado = await asegurarPdf(firmado, host)
  } catch (e) {
    console.error('[contratos] PDF tras la firma falló (se reintenta al descargar):', e)
  }

  await estadoGhl(c.opportunity_id, 'Firmado')
  await actualizarCamposOportunidad(c.opportunity_id, [
    { id: CAMPOS_CONTRATO.pdf, field_value: `${SITE.url.replace(/\/$/, '')}/admin/contratos/${c.id}/pdf` },
  ]).catch(e => console.error('[contratos] enlace del PDF en GHL:', e))
  const oportunidad = await obtenerOportunidad(c.opportunity_id).catch(() => null)
  if (oportunidad?.pipelineId === PIPELINE_RESERVACIONES) {
    await moverOportunidad(c.opportunity_id, PIPELINE_RESERVACIONES, ETAPA_CONTRATO_FIRMADO).catch(e =>
      console.error('[contratos] mover a Contrato Firmado:', e)
    )
  }
  if (c.contact_id) {
    crearNota(
      c.contact_id,
      `✍️ Contrato TW-${c.reserva} FIRMADO por ${nombre} (${documento}) el ${new Date(ahora).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}, ` +
        `desde la IP ${f.ip}.${firmado.pdf_sha256 ? ` Huella del PDF (SHA-256): ${firmado.pdf_sha256}.` : ''}`
    ).catch(e => console.error('[contratos] nota de firma:', e))
  }
  return firmado
}

/** Genera (o regenera) el PDF firmado y lo guarda con su huella. */
export async function asegurarPdf(c: ContratoRow, host?: string | null, forzar = false): Promise<ContratoRow> {
  if (c.estado !== 'firmado') throw new Error('El contrato aún no está firmado.')
  if (c.pdf_ruta && !forzar) return c
  const { e, k } = firmaImpresion(c.id)
  const url = `${origenInterno(host)}/contrato/imprimir/${c.id}?e=${e}&k=${k}`
  const pdf = await pdfDeUrl(url, c.reserva ?? '')
  const ruta = `${c.opportunity_id}/${c.id}/contrato-TW-${(c.reserva ?? 'sin-numero').replace(/[^\w-]/g, '')}.pdf`
  const { error } = await admin()
    .storage.from(BUCKET_CONTRATOS)
    .upload(ruta, pdf, { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`No se pudo guardar el PDF: ${error.message}`)
  const huella = sha256(pdf)
  const { data } = await admin()
    .from('contratos')
    .update({ pdf_ruta: ruta, pdf_sha256: huella })
    .eq('id', c.id)
    .select('*')
    .single()
  await registrarEvento(c.id, { tipo: 'pdf', detalle: `SHA-256 ${huella}` })
  return (data as ContratoRow) ?? { ...c, pdf_ruta: ruta, pdf_sha256: huella }
}

/** URL firmada (2 minutos) de un archivo del bucket de contratos. */
export async function urlFirmadaContrato(ruta: string, descarga?: string): Promise<string> {
  const { data, error } = await admin()
    .storage.from(BUCKET_CONTRATOS)
    .createSignedUrl(ruta, 120, descarga ? { download: descarga } : undefined)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo firmar la URL.')
  return data.signedUrl
}

/** El trazo de la firma como data URL (para incrustarlo en la impresión). */
export async function firmaComoDataUrl(c: ContratoRow): Promise<string | null> {
  if (!c.firma_ruta) return null
  const { data } = await admin().storage.from(BUCKET_CONTRATOS).download(c.firma_ruta)
  if (!data) return null
  return `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`
}
