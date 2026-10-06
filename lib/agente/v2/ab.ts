import { createAdminClient } from '@/lib/supabase/admin'
import { agregarTags, enviarMensaje, type RutaMensaje } from '@/lib/agente/ghl'
import { registrarEnviado, registrarEnvio } from '@/lib/agente/conversacion'
import { extraerTarjetas } from '@/lib/agente/v2/ficha'
import type { Decision, EstadoComercial } from '@/lib/agente/claude'

/**
 * Prueba A/B de Sol v2 (docs/plan-sol-vendedora.md §16, migración 033).
 *
 * - Un lead NUEVO se asigna al azar a v1 o v2 en su primer mensaje y queda
 *   marcado con el tag `sol_v1` / `sol_v2` para siempre: ningún cliente salta
 *   de una Sol a otra a mitad de conversación.
 * - Las conversaciones que ya venían (sin tag) siguen con v1 y no cuentan.
 * - `sol_ab_config.activa = false` devuelve a TODOS a v1 al instante.
 * - Cada mensaje lo responde UNA sola Sol: el costo es el mismo de hoy.
 */

export const TAG_V1 = 'sol_v1'
export const TAG_V2 = 'sol_v2'

export interface ConfigAB { porcentaje: number; activa: boolean }

/** Si la tabla falla, se apaga el A/B (fail-safe: v1 es la Sol probada). */
export async function configAB(): Promise<ConfigAB> {
  const { data, error } = await createAdminClient().from('sol_ab_config').select('porcentaje, activa').eq('id', 1).maybeSingle()
  if (error || !data) return { porcentaje: 0, activa: false }
  return { porcentaje: Number(data.porcentaje), activa: Boolean(data.activa) }
}

/**
 * ¿Qué Sol atiende este contacto? Asigna el grupo si es un lead nuevo.
 * Devuelve 'v2' solo si el contacto es del grupo v2 Y el A/B está activo.
 */
export async function versionPara(contactId: string, tags: string[], primerContacto: boolean, conversationId?: string): Promise<'v1' | 'v2'> {
  const cfg = await configAB()
  if (tags.includes(TAG_V2)) return cfg.activa ? 'v2' : 'v1'
  if (tags.includes(TAG_V1)) return 'v1'
  if (!primerContacto || !cfg.activa || cfg.porcentaje <= 0) return 'v1'

  const grupo = Math.random() * 100 < cfg.porcentaje ? 'v2' : 'v1'
  try {
    await agregarTags(contactId, [grupo === 'v2' ? TAG_V2 : TAG_V1])
  } catch (err) {
    // Sin tag no hay forma de mantenerlo en su grupo: mejor v1 que mezclar.
    console.error('asignación A/B falló:', (err as Error).message)
    return 'v1'
  }
  const { error } = await createAdminClient()
    .from('sol_ab_asignaciones')
    .upsert({ contact_id: contactId, grupo, conversation_id: conversationId ?? null }, { onConflict: 'contact_id', ignoreDuplicates: true })
  if (error) console.error('sol_ab_asignaciones:', error.message)
  return grupo
}

/** Estado comercial con que quedó el contacto en su último turno v2. */
export async function estadoPrevioV2(contactId: string): Promise<EstadoComercial | undefined> {
  const { data } = await createAdminClient()
    .from('sol_ab_turnos')
    .select('decision')
    .eq('contact_id', contactId)
    .eq('version', 'v2')
    .order('en', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.decision as Decision | undefined)?.venta?.estado
}

/**
 * Envía la respuesta de Sol v2: primero el texto y luego cada tarjeta con botón
 * (#btn) como mensaje aparte. Todo queda registrado como envío de Sol.
 */
export async function enviarRespuestaV2(
  decision: Decision,
  ctx: { contactId: string; conversationId: string; ruta: RutaMensaje }
): Promise<{ texto: string; tarjetas: { titulo: string; boton: string }[] }> {
  const { texto, tarjetas } = await extraerTarjetas(decision.mensaje.trim())
  if (texto) {
    const envio = await enviarMensaje(ctx.contactId, texto, ctx.ruta)
    await registrarEnvio(envio, ctx.conversationId, ctx.contactId, texto, false)
  }
  // Las tarjetas #btn solo existen en WhatsApp (proveedor GoGHL = ruta SMS/Custom).
  // En Instagram, Facebook o el chat web llegaría el código crudo: ahí va el
  // link como texto normal.
  const esWhatsapp = (ctx.ruta.tipo === 'SMS' || ctx.ruta.tipo === 'Custom') && Boolean(ctx.ruta.conversationProviderId)
  for (const t of tarjetas) {
    try {
      const cuerpo = esWhatsapp
        ? t.codigo
        : t.vista.boton === 'Llamar'
          ? `📞 Si prefieres, llámanos: ${t.vista.enlace.replace('tel:', '')}`
          : `🔗 ${t.vista.titulo}: ${t.vista.enlace}`
      const envio = await enviarMensaje(ctx.contactId, cuerpo, ctx.ruta)
      if (envio.messageId) await registrarEnviado(envio.messageId, ctx.conversationId, ctx.contactId)
    } catch (err) {
      // Una tarjeta que no sale no le quita la respuesta al cliente (el texto ya salió).
      console.error('tarjeta #btn falló:', (err as Error).message)
    }
  }
  return { texto, tarjetas: tarjetas.map(t => ({ titulo: t.vista.titulo, boton: t.vista.boton })) }
}

/** Bitácora del A/B (nunca lanza: no puede tumbar el turno). */
export async function registrarTurnoAB(fila: {
  contactId: string
  conversationId?: string
  version: 'v1' | 'v2'
  origen: 'mensaje' | 'seguimiento'
  mensaje?: string
  tarjetas?: unknown
  decision: Decision
  costoUsd?: number
}): Promise<void> {
  const { error } = await createAdminClient().from('sol_ab_turnos').insert({
    contact_id: fila.contactId,
    conversation_id: fila.conversationId ?? null,
    version: fila.version,
    origen: fila.origen,
    mensaje: fila.mensaje ?? null,
    tarjetas: fila.tarjetas ?? null,
    decision: fila.decision,
    costo_usd: fila.costoUsd ?? null,
  })
  if (error) console.error('registrarTurnoAB:', error.message)
}

