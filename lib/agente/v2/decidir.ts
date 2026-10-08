import Anthropic from '@anthropic-ai/sdk'
import { aHistorial, lineaAnuncio, type Decision, type EstadoComercial } from '@/lib/agente/claude'
import { construirConocimiento } from '@/lib/agente/conocimiento'
import { resolverAudios } from '@/lib/agente/transcribir'
import { cargarReglas, reglasParaPrompt, type ReglasComerciales } from '@/lib/agente/reglas'
import { HORARIO } from '@/lib/agente/config'
import { equipo, lineaEquipo } from '@/lib/agente/equipo'
import { armarBorrador } from '@/lib/agente/v2/borrador'
import { EJEMPLOS, ESQUEMA_DECISION_V2, FOCO, METODO, NUCLEO } from '@/lib/agente/v2/prompt'
import type { MensajeGhl } from '@/lib/agente/ghl'
import type { AnuncioContexto } from '@/lib/agente/anuncios'

/**
 * Sol v2: decide qué hacer en un turno (docs/plan-sol-vendedora.md §3-§4).
 *
 * Misma forma que `decidir` (v1) para que webhook, seguimiento y laboratorio la
 * usen igual, con tres diferencias: el prompt va por capas (núcleo + método
 * cacheados; reglas comerciales, foco por estado y ejemplos por turno), devuelve
 * el bloque `venta` (estado comercial, señal de compra, compromiso…) y, cuando
 * el lead queda listo o se escala, el código arma el borrador de cotización.
 *
 * Mismo modelo y esfuerzo que v1 (Sonnet 5, medium): la prueba A/B compara
 * método contra método, sin cambiar el costo por mensaje.
 */

export const MODELO_V2 = 'claude-sonnet-5'

export interface ContextoV2 {
  nombre?: string
  nombreConfirmado?: string
  canal?: string
  primerContacto?: boolean
  seguimiento?: { intento: number; maximo: number; angulo?: string }
  anuncio?: AnuncioContexto | null
  respaldo?: { asesora?: string; idsSol: Set<string> }
  /** Estado comercial con que quedó el cliente el turno anterior (decide el módulo de foco). */
  estadoPrevio?: EstadoComercial
  /** Reglas ya cargadas (el laboratorio las reusa entre turnos). */
  reglas?: ReglasComerciales
}

export interface ResultadoV2 {
  decision: Decision
  uso: { entrada: number; cacheLeida: number; cacheEscrita: number; salida: number }
}

let cliente: Anthropic | null = null
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  cliente ??= new Anthropic()
  return cliente
}

export async function decidirV2(mensajes: MensajeGhl[], ctx: ContextoV2): Promise<ResultadoV2> {
  const conTexto = await resolverAudios(mensajes)
  const historial = aHistorial(conTexto, ctx.respaldo?.idsSol)
  const vacio = { entrada: 0, cacheLeida: 0, cacheEscrita: 0, salida: 0 }
  if (historial.length === 0) {
    return {
      decision: {
        accion: 'callar',
        motivo: 'la conversación no tiene mensajes de texto legibles',
        mensaje: '',
        temperatura: 'no_aplica',
        datos: {},
      },
      uso: vacio,
    }
  }

  const [{ base, detallesPara, nombreDe }, reglas, miembros] = await Promise.all([
    construirConocimiento(),
    ctx.reglas ? Promise.resolve(ctx.reglas) : cargarReglas(),
    equipo(),
  ])

  const textoConversacion = historial.map(m => (typeof m.content === 'string' ? m.content : '')).join(' ')
  const anuncio = ctx.anuncio ?? null
  const detalle = detallesPara(textoConversacion, anuncio?.slugs ?? [])

  const hoy = new Date()
  const fechaLarga = new Intl.DateTimeFormat('es-CO', { timeZone: HORARIO.zona, dateStyle: 'full' }).format(hoy)
  const fechaIso = new Intl.DateTimeFormat('en-CA', { timeZone: HORARIO.zona }).format(hoy)

  const situacion = [
    `Hoy es ${fechaLarga} (${fechaIso}), hora de Colombia.`,
    ctx.nombreConfirmado
      ? `El cliente se llama ${ctx.nombreConfirmado} (confirmado): no le preguntes el nombre.`
      : ctx.nombre
        ? `En el chat figura como "${ctx.nombre}", que puede no ser su nombre real: pregúntalo una vez con naturalidad, sin insistir.`
        : 'No sabes su nombre: pregúntalo una vez, sin insistir.',
    ctx.canal ? `Canal: ${ctx.canal}.` : null,
    ctx.primerContacto
      ? 'Es el PRIMER mensaje: aparte ya se le envía el saludo con tu nombre y el aviso de datos. No te vuelvas a presentar. Si solo saluda, pregúntale qué viaje tiene en mente; si ya dijo destino, ve directo a eso.'
      : null,
    ctx.seguimiento
      ? `Este turno es un SEGUIMIENTO programado (intento ${ctx.seguimiento.intento} de ${ctx.seguimiento.maximo}): el cliente no contestó tu último mensaje.${ctx.seguimiento.angulo ? ` Ángulo anotado: ${ctx.seguimiento.angulo}` : ''} Decide si vale la pena escribir ("callar" es válido); si escribes, aporta algo nuevo y corto.`
      : null,
    lineaEquipo(miembros, Boolean(ctx.respaldo)),
    anuncio ? lineaAnuncio(anuncio, nombreDe) : null,
    ctx.respaldo
      ? `MODO RESPALDO: esta conversación la lleva ${ctx.respaldo.asesora ? `la asesora ${ctx.respaldo.asesora}` : 'una asesora'}; los mensajes "[Escrito por la asesora]" son suyos. La cubres porque el cliente lleva rato sin respuesta. Preséntate una vez como Sol, del equipo. No contradigas lo que ella ofreció ni prometas nada fuera del catálogo; pagos, contrato, cambios y reclamos → "escalar" diciendo que ella se lo confirma muy pronto.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  const estado = ctx.estadoPrevio
  const foco = estado && FOCO[estado]
    ? `## Foco de este turno\n${FOCO[estado]}${EJEMPLOS[estado]?.length ? `\nAsí lo dicen las asesoras (inspiración, no copies literal):\n${EJEMPLOS[estado].map(e => `- ${e}`).join('\n')}` : ''}`
    : null

  const variable = [
    situacion,
    reglasParaPrompt(reglas),
    foco,
    detalle ? `## Detalle de los destinos que interesan al cliente\n\n${detalle}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const respuesta = await anthropic().messages.create({
    model: MODELO_V2,
    max_tokens: 4000,
    system: [
      { type: 'text', text: `${NUCLEO}\n\n${METODO}` },
      // Breakpoint de caché de 1 h: núcleo + método + índice del catálogo son
      // idénticos para todas las conversaciones (ver claude.ts, mismo criterio).
      { type: 'text', text: base, cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: variable },
    ],
    messages: historial,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: ESQUEMA_DECISION_V2 as never },
    },
  })

  const uso = {
    entrada: respuesta.usage.input_tokens,
    cacheLeida: respuesta.usage.cache_read_input_tokens ?? 0,
    cacheEscrita: respuesta.usage.cache_creation_input_tokens ?? 0,
    salida: respuesta.usage.output_tokens,
  }

  if (respuesta.stop_reason === 'refusal') {
    return {
      decision: {
        accion: 'escalar',
        motivo: `el modelo declinó responder (${respuesta.stop_details?.category ?? 'sin categoría'})`,
        mensaje: 'Déjame pasarle tu caso a alguien del equipo para ayudarte mejor 😊',
        temperatura: 'no_aplica',
        datos: {},
      },
      uso,
    }
  }

  const texto = respuesta.content.find(b => b.type === 'text')
  if (!texto || texto.type !== 'text') throw new Error('La respuesta del modelo no trae texto')
  const decision = JSON.parse(texto.text) as Decision

  // Borrador de cotización: lo arma el código solo cuando el lead quedó listo
  // para reservar (en una escalada —reclamo, post-venta— no aplica).
  if (decision.venta?.estado === 'listo_para_reservar' && decision.accion === 'responder') {
    try {
      decision.borrador = await armarBorrador(decision, reglas)
    } catch (err) {
      console.error('borrador de cotización falló:', (err as Error).message)
    }
  }

  return { decision, uso }
}

/** Costo aproximado en USD de un turno con Sonnet 5 (por millón: entrada $2, caché leída $0,20, escritura de caché 1 h $4, salida $10). */
export function costoUsd(u: ResultadoV2['uso']): number {
  return (u.entrada * 2 + u.cacheLeida * 0.2 + u.cacheEscrita * 4 + u.salida * 10) / 1_000_000
}
