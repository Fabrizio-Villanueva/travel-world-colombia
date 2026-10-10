import { PIPELINE, TAGS } from '@/lib/agente/config'
import { idsDeSol, salientesReales } from '@/lib/agente/conversacion'
import {
  conversacionesRecientes,
  moverOportunidad,
  moverYAsignarOportunidad,
  oportunidadesEnEtapa,
  quitarTags,
  ultimosMensajes,
  type MensajeGhl,
} from '@/lib/agente/ghl'

/**
 * Avance automático del pipeline 🎯 Leads.
 *
 * El equipo no arrastra tarjetas y GHL no tiene disparador para los mensajes
 * SALIENTES del WhatsApp conectado (proveedor custom), así que un workflow no
 * puede hacerlo. Esta corrida periódica lo hace con dos reglas, que solo
 * avanzan (nunca regresan una tarjeta):
 *
 *  1. Tarjeta en Lead Nuevo / No calificado / Calificado por Bot / Asignado a Agente cuyo chat
 *     tiene un mensaje de una asesora → 📞 Contactado. Si no tenía asesor, se
 *     le asigna quien escribió. Se le quita `new_lead` al contacto.
 *  2. Tarjeta en Lead Nuevo que ya tiene asesor → 👤 Asignado a Agente.
 *
 * Solo mira los chats con movimiento en los últimos `VENTANA_MIN` minutos: un
 * mensaje de la asesora mueve la fecha del chat, así que con el cron cada 10
 * minutos ninguno se escapa. La limpieza del histórico se hizo aparte (05-oct).
 */

const VENTANA_MIN = 30
/** Tope de tarjetas movidas por corrida: lo que no alcance va en la siguiente. */
const MAX_MOVIMIENTOS = 60

const ETAPAS_TEMPRANAS = [
  PIPELINE.etapas.leadNuevo,
  PIPELINE.etapas.noCalificado,
  PIPELINE.etapas.calificadoPorBot,
  PIPELINE.etapas.asignadoAAgente,
] as const

export interface ResumenEtapas {
  revisadas: number
  chatsRecientes: number
  contactadas: string[]
  asignadas: string[]
  errores: number
}

/**
 * ¿Lo escribió una persona del equipo? Los mensajes de Sol se reconocen SOLO por
 * su registro (`idsSol`): Sol hereda el userId de la asesora asignada, así que
 * el userId por sí solo no distingue. Lo de workflows (alertas internas,
 * recordatorios) tampoco cuenta. Lo enviado desde el celular del número
 * compartido llega sin userId pero con la marca "Sent from another device".
 */
export function escritoPorAsesora(m: MensajeGhl & { id: string }, idsSol: Set<string>): boolean {
  if (idsSol.has(m.id) || m.source === 'workflow') return false
  return Boolean(m.userId) || /Sent from another device/i.test(m.body ?? '')
}

export async function avanzarEtapas(
  opciones: { dry?: boolean; ahora?: Date } = {}
): Promise<ResumenEtapas> {
  const ahora = opciones.ahora ?? new Date()
  const dry = opciones.dry ?? false
  const resumen: ResumenEtapas = { revisadas: 0, chatsRecientes: 0, contactadas: [], asignadas: [], errores: 0 }

  const tarjetas = (await Promise.all(ETAPAS_TEMPRANAS.map(e => oportunidadesEnEtapa(PIPELINE.id, e))))
    .flat()
    .filter(o => o.contactId && !(o.contact?.tags ?? []).some(t => (TAGS.noCliente as readonly string[]).includes(t)))
  resumen.revisadas = tarjetas.length

  const recientes = await conversacionesRecientes(new Date(ahora.getTime() - VENTANA_MIN * 60_000))
  resumen.chatsRecientes = recientes.length
  const chatsPorContacto = new Map<string, string[]>()
  for (const c of recientes) chatsPorContacto.set(c.contactId, [...(chatsPorContacto.get(c.contactId) ?? []), c.id])

  for (const o of tarjetas) {
    if (resumen.contactadas.length + resumen.asignadas.length >= MAX_MOVIMIENTOS) break
    try {
      // Regla 1: ¿una asesora ya le escribió? (el mensaje más reciente manda)
      let autora: (MensajeGhl & { id: string }) | undefined
      for (const conversationId of chatsPorContacto.get(o.contactId!) ?? []) {
        const salientes = salientesReales(await ultimosMensajes(conversationId, 30))
        const deSol = await idsDeSol(salientes)
        // Sin el registro de Sol no se distingue a la asesora: no mover a ciegas.
        if (deSol === null) continue
        autora = salientes.find(m => escritoPorAsesora(m, deSol))
        if (autora) break
      }

      if (autora) {
        if (!dry) {
          await moverYAsignarOportunidad(
            o.id,
            PIPELINE.id,
            PIPELINE.etapas.contactado,
            o.assignedTo ? undefined : autora.userId
          )
          if (o.contact?.tags?.includes(TAGS.nuevoLead)) await quitarTags(o.contactId!, [TAGS.nuevoLead])
        }
        resumen.contactadas.push(o.id)
        continue
      }

      // Regla 2: asignada pero nadie le ha escrito todavía.
      if (o.pipelineStageId === PIPELINE.etapas.leadNuevo && o.assignedTo) {
        if (!dry) await moverOportunidad(o.id, PIPELINE.id, PIPELINE.etapas.asignadoAAgente)
        resumen.asignadas.push(o.id)
      }
    } catch (err) {
      resumen.errores++
      console.error(`avanzarEtapas ${o.id}:`, (err as Error).message)
    }
  }

  return resumen
}
