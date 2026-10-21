import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { todasLasFilas } from '@/lib/supabase/paginar'
import { legibleParaSol } from '@/lib/agente/claude'
import { conversacionDe, obtenerContacto, ultimosMensajes, type MensajeGhl } from '@/lib/agente/ghl'
import { idsDeSol } from '@/lib/agente/conversacion'
import { resolverAudios } from '@/lib/agente/transcribir'
import { HORARIO } from '@/lib/agente/config'

/**
 * Evaluador automático de la calidad de cada lead que atendió Sol (migración
 * 042, panel /admin/sol/resultados).
 *
 * Reemplaza la marca manual "este lead no servía" que las asesoras no hacen:
 * un modelo lee la conversación completa con el criterio de un jefe comercial
 * (mismo método del A/B a ciegas del 13-oct-2026) y deja su veredicto. Solo
 * evalúa conversaciones ya asentadas (último turno de Sol hace más de
 * `ASENTADA_HORAS`), una vez por lead.
 *
 * El veredicto NO mira si Sol pasó o no el lead: eso lo cruza el panel con
 * agente_sla_humano. Así la misma evaluación sirve para "pasó leads malos" y
 * para "se quedó leads buenos".
 */

/** Inicio de la bitácora de turnos (sol_ab_turnos, migración 033). */
export const COHORTE_DESDE = '2026-10-06T00:00:00-05:00'
const ASENTADA_HORAS = 6
const CRITERIO = 'jefe-comercial-v1'
const MODELO = 'claude-sonnet-5'

const SISTEMA = `Eres el jefe comercial de Travel World Colombia, una agencia de viajes de Fusagasugá. Revisas conversaciones de WhatsApp/Instagram/Facebook que atendió Sol (la asistente virtual) para decidir, con criterio de negocio, si cada lead merecía que una asesora le dedicara tiempo YA.

Clasifica:
- tipo:
  - venta_nueva: alguien que pregunta por un viaje (aunque sea poco).
  - cliente_existente: ya tiene reserva, pagos, contrato o viaje en curso con la agencia, o es un reclamo/post-venta.
  - no_cliente: proveedor, mayorista, publicidad, número equivocado, spam, empleo, mensajes sin sentido.
- merecia_pasar (solo venta_nueva; si no, "no_aplica"):
  - si: intención real de viajar Y una asesora puede cotizar sin volver a preguntar lo básico (destino + fecha o ventana aproximada + cuántos viajan), o pidió cotización/reserva/forma de pago con lo mínimo. También "si" un destino a la medida con perfil suficiente.
  - dudoso: hay interés y algún dato, pero falta algo clave o la intención es tibia.
  - no: solo curiosea o pregunta "cuánto vale" sin fechas ni personas, no volvió a contestar tras el primer mensaje, viaje muy lejano sin intención, o pidió algo que la agencia no vende.
  Juzga por lo que dijo el CLIENTE, no por lo que Sol o la asesora hicieron después.
- motivo: una o dos frases en español sencillo para la dueña, citando el dato decisivo (p. ej. "Pidió cotización para 2 adultos a San Andrés del 15 al 20 de diciembre").
- nota_sol: calidad de la atención de Sol de 1 a 5 (5 = como la mejor asesora: cálida, concreta, da referencia de precio, no repregunta lo ya dicho, avanza la venta; 1 = errores graves o datos falsos). Si Sol casi no habló, califica lo poco que hizo.
- error_sol: el error más importante de Sol en una frase, o vacío si no hubo.
- datos: lo que el cliente dio.`

const ESQUEMA = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: ['venta_nueva', 'cliente_existente', 'no_cliente'] },
    merecia_pasar: { type: 'string', enum: ['si', 'dudoso', 'no', 'no_aplica'] },
    motivo: { type: 'string' },
    nota_sol: { type: 'integer', description: 'De 1 a 5.' },
    error_sol: { type: 'string' },
    datos: {
      type: 'object',
      properties: {
        destino: { type: 'boolean' },
        fechas: { type: 'boolean' },
        personas: { type: 'boolean' },
        pidio_cotizacion: { type: 'boolean' },
        senal_compra: { type: 'boolean' },
      },
      required: ['destino', 'fechas', 'personas', 'pidio_cotizacion', 'senal_compra'],
      additionalProperties: false,
    },
  },
  required: ['tipo', 'merecia_pasar', 'motivo', 'nota_sol', 'error_sol', 'datos'],
  additionalProperties: false,
} as const

interface Veredicto {
  tipo: 'venta_nueva' | 'cliente_existente' | 'no_cliente'
  merecia_pasar: 'si' | 'dudoso' | 'no' | 'no_aplica'
  motivo: string
  nota_sol: number
  error_sol: string
  datos: Record<string, boolean>
}

let cliente: Anthropic | null = null
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  cliente ??= new Anthropic()
  return cliente
}

const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: HORARIO.zona, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Conversación como texto plano, del más viejo al más nuevo, con quién habla. */
async function transcripcion(mensajes: MensajeGhl[]): Promise<string> {
  const legibles = (await resolverAudios(mensajes))
    .filter(m => !m.messageType?.startsWith('TYPE_ACTIVITY') && (m.body ?? '').trim())
  const deSol = (await idsDeSol(legibles.filter(m => m.direction !== 'inbound' && m.id))) ?? new Set<string>()
  return [...legibles]
    .reverse()
    .map(m => {
      const quien = m.direction === 'inbound' ? 'Cliente' : deSol.has(m.id) ? 'Sol' : 'Asesora'
      const cuando = m.dateAdded ? `[${fecha.format(new Date(m.dateAdded))}] ` : ''
      return `${cuando}${quien}: ${legibleParaSol(m.body!).slice(0, 1500)}`
    })
    .join('\n')
}

/** Evalúa un lead y guarda el veredicto. Devuelve null si no hay nada que leer. */
export async function evaluarLead(contactId: string, conversationId?: string | null): Promise<Veredicto | null> {
  const convId = conversationId ?? (await conversacionDe(contactId))?.id
  if (!convId) return null
  const [mensajes, contacto] = await Promise.all([ultimosMensajes(convId, 100), obtenerContacto(contactId)])
  const texto = await transcripcion(mensajes)
  if (!texto) {
    // Se marca igual para no reintentarlo en cada corrida.
    await createAdminClient().from('agente_evaluaciones').upsert({
      contact_id: contactId, conversation_id: convId, tipo: 'no_cliente', merecia_pasar: 'no_aplica',
      motivo: 'La conversación no tiene mensajes de texto legibles.', criterio: CRITERIO, evaluado_en: new Date().toISOString(),
    })
    return null
  }

  const r = await anthropic().messages.create({
    model: MODELO,
    max_tokens: 1500,
    system: SISTEMA,
    messages: [{ role: 'user', content: `Conversación:\n\n${texto}` }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA as never } },
  })
  const bloque = r.content.find(b => b.type === 'text')
  if (!bloque || bloque.type !== 'text') throw new Error('el evaluador no devolvió texto')
  const v = JSON.parse(bloque.text) as Veredicto
  if (v.tipo !== 'venta_nueva') v.merecia_pasar = 'no_aplica'
  v.nota_sol = Math.min(5, Math.max(1, Math.round(v.nota_sol)))

  const u = r.usage
  const costo = ((u.input_tokens * 2) + (u.cache_read_input_tokens ?? 0) * 0.2 + u.output_tokens * 10) / 1_000_000
  const nombre = [contacto?.firstName, contacto?.lastName].filter(Boolean).join(' ').trim() || null

  const { error } = await createAdminClient().from('agente_evaluaciones').upsert({
    contact_id: contactId,
    conversation_id: convId,
    nombre,
    tipo: v.tipo,
    merecia_pasar: v.merecia_pasar,
    motivo: v.motivo,
    nota_sol: v.nota_sol,
    error_sol: v.error_sol?.trim() || null,
    datos: v.datos,
    criterio: CRITERIO,
    costo_usd: costo,
    evaluado_en: new Date().toISOString(),
  })
  if (error) throw new Error(`agente_evaluaciones: ${error.message}`)
  return v
}

/**
 * Corrida del cron: evalúa hasta `limite` leads asentados sin veredicto, de
 * `paralelo` en `paralelo`. Cada lead en su propio try/catch.
 */
export async function correrEvaluador(limite = 25, paralelo = 5): Promise<{ evaluados: number; fallos: string[]; pendientes: number }> {
  const db = createAdminClient()
  const [turnos, hechas] = await Promise.all([
    todasLasFilas((a, b) => db.from('sol_ab_turnos').select('contact_id, conversation_id, en').gte('en', COHORTE_DESDE).order('en', { ascending: true }).order('id').range(a, b)),
    todasLasFilas((a, b) => db.from('agente_evaluaciones').select('contact_id').order('contact_id').range(a, b)),
  ])
  if (turnos.error) throw new Error(`sol_ab_turnos: ${turnos.error.message}`)
  const yaEvaluados = new Set((hechas.data ?? []).map(r => r.contact_id as string))

  // Último turno y conversación de cada contacto.
  const ultimo = new Map<string, { conv: string | null; en: string }>()
  for (const t of turnos.data ?? []) {
    ultimo.set(t.contact_id, { conv: t.conversation_id ?? ultimo.get(t.contact_id)?.conv ?? null, en: t.en })
  }
  const corte = Date.now() - ASENTADA_HORAS * 3600_000
  const candidatos = [...ultimo.entries()]
    .filter(([id, u]) => !yaEvaluados.has(id) && new Date(u.en).getTime() < corte)

  const lote = candidatos.slice(0, limite)
  let evaluados = 0
  const fallos: string[] = []
  for (let i = 0; i < lote.length; i += paralelo) {
    await Promise.all(lote.slice(i, i + paralelo).map(async ([id, u]) => {
      try {
        if (await evaluarLead(id, u.conv)) evaluados++
      } catch (err) {
        fallos.push(`${id}: ${(err as Error).message}`)
      }
    }))
  }
  return { evaluados, fallos, pendientes: candidatos.length - lote.length }
}
