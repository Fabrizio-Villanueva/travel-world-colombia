import { createAdminClient } from '@/lib/supabase/admin'
import {
  ALERTAS_INTERNAS,
  CONTACTO_INTERNO_DE_ASESORA,
  GHL,
  SLA_HUMANO,
  TAGS,
} from '@/lib/agente/config'
import {
  agregarTags,
  conversacionDe,
  crearNota,
  nombreUsuario,
  obtenerContacto,
  quitarTags,
  ultimosMensajes,
} from '@/lib/agente/ghl'
import { idsDeSol } from '@/lib/agente/conversacion'
import { escritoPorAsesora } from '@/lib/agente/etapas'
import { enviarAlerta, type DestinoAlerta } from '@/lib/agente/alertas'
import { duracionTexto, pasoSla, primerHumanoDesde } from '@/lib/agente/sla-reglas'
import type { MotivoTraspaso } from '@/lib/agente/sla-registro'

/**
 * SLA de respuesta HUMANA a los leads que Sol pasa al equipo.
 *
 * Hueco que cierra (auditoría del 09-oct-2026): Sol responde en 18 s, pero el
 * primer mensaje de una asesora a un lead que Sol calificó tardaba una
 * mediana de 21 h y el 23 % nunca recibía uno. Las dos alarmas que ya
 * existían no lo ven:
 *  - el vigilante (`lead_sin_respuesta`) mira si ALGUIEN contestó el último
 *    mensaje del cliente, y Sol, en "espera caliente", siempre contesta;
 *  - L-02 (workflow de GHL "lead sin respuesta 60 min") depende de los
 *    disparadores de mensaje saliente, que no cubren el WhatsApp custom.
 *
 * Por eso aquí el reloj NO es "último mensaje del cliente" sino "desde que Sol
 * pasó el lead" (fila en `agente_sla_humano`, la abre `registrarTraspaso` en el
 * turno de Sol), y solo lo detiene un mensaje de una PERSONA del equipo.
 *
 *  1. 60 min hábiles sin mensaje humano → aviso a la asesora asignada (por su
 *     WhatsApp interno si está en `CONTACTO_INTERNO_DE_ASESORA`; si no, a
 *     `ALERTAS_INTERNAS` diciendo de quién es), nota en el contacto y tag
 *     `sla_sin_respuesta_humana`.
 *  2. 3 h hábiles → aviso a supervisión (`ALERTAS_INTERNAS`).
 *  3. En cuanto escribe alguien del equipo → se cierra el episodio y se quita el tag.
 *
 * Minutos HÁBILES: un lead calificado de noche empieza a contar en la
 * siguiente apertura (ver `minutosHabilesEntre`). Idempotente: cada aviso se
 * marca en la fila con un UPDATE condicional ANTES de enviarse, así dos
 * corridas solapadas no avisan dos veces. Lo corre el cron del vigilante
 * (cada 10 min); `AGENTE_SLA_HUMANO=off` lo apaga.
 */

interface FilaSla {
  id: string
  contact_id: string
  conversation_id: string | null
  motivo: MotivoTraspaso
  inicio: string
  alerta_asesora_en: string | null
  alerta_supervision_en: string | null
}

export interface ResumenSla {
  corrio: boolean
  motivo?: string
  abiertos: number
  respondidos: number
  vencidos: number
  avisosAsesora: { contactId: string; minutos: number; nota: string }[]
  avisosSupervision: { contactId: string; minutos: number; nota: string }[]
  errores: number
}

const MOTIVO_TEXTO: Record<MotivoTraspaso, string> = {
  calificado: 'Sol lo dejó listo para cotizar',
  escalado: 'Sol lo escaló a una persona',
  escalado_respaldo: 'Sol (cubriendo a la asesora) pidió que la asesora retome',
}

const urlChat = (conversationId: string | null, contactId: string) =>
  conversationId
    ? `https://app.gohighlevel.com/v2/location/${GHL.locationId}/conversations/conversations/${conversationId}`
    : `https://app.gohighlevel.com/v2/location/${GHL.locationId}/contacts/detail/${contactId}`

const horaBogota = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

/** Marca la columna de aviso SOLO si sigue vacía. true = esta corrida se ganó el aviso. */
async function reclamarAviso(id: string, columna: 'alerta_asesora_en' | 'alerta_supervision_en'): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_sla_humano')
    .update({ [columna]: new Date().toISOString() })
    .eq('id', id)
    .is(columna, null)
    .is('cerrado_en', null)
    .select('id')
  if (error) throw new Error(`no se pudo marcar ${columna}: ${error.message}`)
  return (data?.length ?? 0) > 0
}

async function cerrar(id: string, cierre: 'respondido' | 'vencido' | 'no_cliente', respondidoEn?: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('agente_sla_humano')
    .update({ cerrado_en: new Date().toISOString(), cierre, respondido_en: respondidoEn ?? null })
    .eq('id', id)
    .is('cerrado_en', null)
  if (error) throw new Error(`no se pudo cerrar el episodio: ${error.message}`)
}

async function anotarAviso(id: string, columna: 'alerta_asesora_nota' | 'alerta_supervision_nota', nota: string) {
  const admin = createAdminClient()
  await admin.from('agente_sla_humano').update({ [columna]: nota.slice(0, 1000) }).eq('id', id)
}

export async function revisarSlaHumano(
  opciones: { dry?: boolean; ahora?: Date } = {}
): Promise<ResumenSla> {
  const ahora = opciones.ahora ?? new Date()
  const dry = opciones.dry ?? false
  const resumen: ResumenSla = {
    corrio: SLA_HUMANO.activo,
    motivo: [
      SLA_HUMANO.activo ? null : 'SLA humano apagado (AGENTE_SLA_HUMANO=off)',
      dry ? 'DRY RUN (no escribe ni avisa)' : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined,
    abiertos: 0,
    respondidos: 0,
    vencidos: 0,
    avisosAsesora: [],
    avisosSupervision: [],
    errores: 0,
  }
  if (!SLA_HUMANO.activo) return resumen

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agente_sla_humano')
    .select('id, contact_id, conversation_id, motivo, inicio, alerta_asesora_en, alerta_supervision_en')
    .is('cerrado_en', null)
    .order('inicio', { ascending: true })
    .limit(300)
  if (error) throw new Error(`SLA humano: no se pudo leer agente_sla_humano: ${error.message}`)

  const filas = (data ?? []) as FilaSla[]
  resumen.abiertos = filas.length
  let avisos = 0

  for (const f of filas) {
    try {
      const inicio = new Date(f.inicio)
      const { paso, minutosHabiles } = pasoSla({
        inicio,
        ahora,
        avisoAsesora: Boolean(f.alerta_asesora_en),
        avisoSupervision: Boolean(f.alerta_supervision_en),
      })

      // Aún no toca avisar y no hay tag que quitar: no se gasta ninguna
      // llamada a GHL. Si una persona ya respondió, se verá cuando toque
      // decidir (la fecha de su mensaje queda igual en `respondido_en`).
      if (paso === 'esperar' && !f.alerta_asesora_en) continue

      // 1. ¿Ya escribió alguien del equipo? Con el aviso ya enviado se mira en
      //    cada corrida, para quitar el tag en cuanto responden.
      const conversationId = f.conversation_id ?? (await conversacionDe(f.contact_id))?.id ?? null
      if (conversationId) {
        const mensajes = await ultimosMensajes(conversationId, 40)
        const salientes = mensajes.filter(m => m.direction === 'outbound' && m.id)
        const deSol = await idsDeSol(salientes as { id: string }[])
        // Sin el registro de Sol no se distingue a la asesora: no decidir a ciegas.
        if (deSol === null) continue
        const humano = primerHumanoDesde(mensajes, inicio, m => escritoPorAsesora(m, deSol))
        if (humano) {
          if (!dry) {
            await cerrar(f.id, 'respondido', humano.dateAdded)
            if (f.alerta_asesora_en) await quitarTags(f.contact_id, [TAGS.slaHumano]).catch(() => undefined)
          }
          resumen.respondidos++
          continue
        }
      }

      if (paso === 'vencido') {
        if (!dry) {
          await cerrar(f.id, 'vencido')
          if (f.alerta_asesora_en) await quitarTags(f.contact_id, [TAGS.slaHumano]).catch(() => undefined)
        }
        resumen.vencidos++
        continue
      }
      if (paso === 'esperar') continue
      if (avisos >= SLA_HUMANO.maxAvisosPorCorrida) continue

      const contacto = await obtenerContacto(f.contact_id)
      const tags = contacto?.tags ?? []
      if (tags.some(t => (TAGS.noCliente as readonly string[]).includes(t))) {
        if (!dry) await cerrar(f.id, 'no_cliente')
        continue
      }
      const nombreCliente =
        [contacto?.firstName, contacto?.lastName].filter(Boolean).join(' ').trim() || 'Cliente sin nombre'
      const asesoraId = contacto?.assignedTo
      const asesora = asesoraId ? ((await nombreUsuario(asesoraId).catch(() => null)) ?? 'asesora asignada') : null
      const enlace = urlChat(conversationId, f.contact_id)
      const espera = duracionTexto(minutosHabiles)

      if (paso === 'avisar_asesora') {
        const directo = asesoraId ? CONTACTO_INTERNO_DE_ASESORA[asesoraId] : undefined
        const destinos: readonly DestinoAlerta[] = directo
          ? [{ nombre: asesora ?? 'asesora', contactId: directo }]
          : ALERTAS_INTERNAS
        const texto = [
          `⏰ Lead sin respuesta del equipo: ${nombreCliente}`,
          `${MOTIVO_TEXTO[f.motivo]} (${horaBogota(f.inicio)}) y lleva ${espera} hábiles sin que una persona le escriba.`,
          directo
            ? 'Es tuyo: escríbele apenas puedas.'
            : asesora
              ? `Asesora asignada: ${asesora} (no tengo su WhatsApp interno: avísenle, por favor).`
              : 'No tiene asesora asignada: asígnenlo, por favor.',
          enlace,
        ].join('\n')

        if (dry) {
          resumen.avisosAsesora.push({ contactId: f.contact_id, minutos: minutosHabiles, nota: `DRY → ${destinos.map(d => d.nombre).join(', ')}` })
          avisos++
          continue
        }
        if (!(await reclamarAviso(f.id, 'alerta_asesora_en'))) continue
        avisos++
        const notas = await enviarAlerta(destinos, texto)
        try {
          await crearNota(
            f.contact_id,
            [
              `⏰ SLA de respuesta: ${MOTIVO_TEXTO[f.motivo].toLowerCase()} el ${horaBogota(f.inicio)} y en ${espera} hábiles nadie del equipo le ha escrito.`,
              `Aviso enviado a: ${destinos.map(d => d.nombre).join(', ')}.`,
              `Si a las ${duracionTexto(SLA_HUMANO.minSupervision)} hábiles sigue sin respuesta, se avisa a supervisión. La etiqueta "${TAGS.slaHumano}" se quita sola cuando alguien del equipo escriba en el chat.`,
            ].join('\n\n')
          )
          await agregarTags(f.contact_id, [TAGS.slaHumano])
          notas.push('nota + tag')
        } catch (err) {
          notas.push(`nota/tag falló: ${(err as Error).message}`)
        }
        await anotarAviso(f.id, 'alerta_asesora_nota', notas.join(' · '))
        resumen.avisosAsesora.push({ contactId: f.contact_id, minutos: minutosHabiles, nota: notas.join(' · ') })
        continue
      }

      // paso === 'avisar_supervision'
      const texto = [
        `🚨 ${espera} hábiles sin respuesta del equipo: ${nombreCliente}`,
        `${MOTIVO_TEXTO[f.motivo]} (${horaBogota(f.inicio)}). ${asesora ? `Asesora asignada: ${asesora}.` : 'Sin asesora asignada.'} Ya se le avisó hace rato y nadie le ha escrito.`,
        enlace,
      ].join('\n')
      if (dry) {
        resumen.avisosSupervision.push({ contactId: f.contact_id, minutos: minutosHabiles, nota: 'DRY → supervisión' })
        avisos++
        continue
      }
      if (!(await reclamarAviso(f.id, 'alerta_supervision_en'))) continue
      avisos++
      const notas = await enviarAlerta(ALERTAS_INTERNAS, texto)
      await anotarAviso(f.id, 'alerta_supervision_nota', notas.join(' · '))
      resumen.avisosSupervision.push({ contactId: f.contact_id, minutos: minutosHabiles, nota: notas.join(' · ') })
    } catch (err) {
      resumen.errores++
      console.error(`SLA humano ${f.contact_id}:`, (err as Error).message)
    }
  }

  return resumen
}
