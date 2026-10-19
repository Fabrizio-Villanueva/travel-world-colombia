import { PIPELINE } from '@/lib/agente/config'
import {
  agregarTags,
  contactoPorTelefono,
  crearContacto,
  crearNota,
  crearOportunidad,
  oportunidadesDe,
} from '@/lib/agente/ghl'
import { PRESUPUESTO_OPCIONES } from '@/lib/validations/cotizacion'

/**
 * Registra en GHL un lead del formulario de cotización (/contacto).
 *
 * Va directo por la API y no por un webhook entrante de GHL: el webhook
 * respondía 200 aunque no hubiera un workflow publicado que lo procesara, y
 * en la reestructura de octubre-2026 el receptor ("web-webhook") desapareció
 * — el formulario nunca dejó un solo contacto en el CRM (medido el 19-oct).
 *
 * - Contacto nuevo → se crea con tags; el workflow E-01 ("Contacto nuevo →
 *   tarjeta en Leads") le abre la tarjeta en 🆕 Lead Nuevo.
 * - Contacto existente → no se pisa su nombre; se le suman los tags y, si no
 *   tiene tarjeta abierta en Leads, se le abre una (E-01 no se dispara).
 * - En ambos casos queda una nota con lo que pidió para la asesora.
 */

export interface LeadWeb {
  nombre: string
  /** E.164, p. ej. +573001234567 */
  telefono: string
  destino_interes: string
  num_viajeros?: number
  fecha_viaje?: string
  presupuesto?: string
  mensaje?: string
}

const FUENTE = 'Sitio web — formulario de cotización'

function textoNota(l: LeadWeb): string {
  const presupuesto = PRESUPUESTO_OPCIONES.find(p => p.value === l.presupuesto)?.label
  return [
    '📝 Solicitud de cotización desde el sitio web (formulario de /contacto)',
    `Destino: ${l.destino_interes}`,
    `Viajeros: ${l.num_viajeros ?? 'no indicó'}`,
    `Fechas tentativas: ${l.fecha_viaje ?? 'no indicó'}`,
    `Presupuesto: ${presupuesto ?? 'no indicó'}`,
    l.mensaje ? `Mensaje: ${l.mensaje}` : null,
    '',
    'El sitio le prometió respuesta en menos de 24 horas. Aún no ha escrito por WhatsApp: hay que escribirle.',
  ]
    .filter(linea => linea !== null)
    .join('\n')
}

export async function registrarLeadWeb(lead: LeadWeb): Promise<boolean> {
  const tags = ['web-form', `destino: ${lead.destino_interes}`.toLowerCase()]
  try {
    const existente = await contactoPorTelefono(lead.telefono)
    const contacto =
      existente ??
      (await crearContacto({ firstName: lead.nombre, phone: lead.telefono, source: FUENTE, tags }))

    if (existente) {
      await agregarTags(existente.id, tags)
      const abiertas = (await oportunidadesDe(existente.id)).filter(
        o => o.pipelineId === PIPELINE.id && o.status === 'open'
      )
      if (abiertas.length === 0) {
        await crearOportunidad({
          contactId: existente.id,
          name: lead.nombre,
          pipelineId: PIPELINE.id,
          pipelineStageId: PIPELINE.etapas.leadNuevo,
          source: FUENTE,
        })
      }
    }

    // El lead ya quedó en el CRM: si la nota falla, no se le dice al cliente
    // que su solicitud no llegó.
    await crearNota(contacto.id, textoNota(lead)).catch(e =>
      console.error('[lead-web] nota GHL falló:', e)
    )
    return true
  } catch (e) {
    console.error('[lead-web] no se pudo registrar el lead en GHL:', e)
    return false
  }
}
