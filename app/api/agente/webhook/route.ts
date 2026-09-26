import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { eventoGhlSchema, normalizar } from '@/lib/agente/schemas'
import { identificarAutor } from '@/lib/agente/autor'
import { anotarEvento, registrarEvento } from '@/lib/agente/eventos'
import { enriquecerDesdeContacto } from '@/lib/agente/enriquecer'
import { TAGS, ACTIVO_DESDE, TAG_PRUEBAS } from '@/lib/agente/config'
import { atender, meTocaResponder } from '@/lib/agente/conversacion'
import { extraerReferral, registrarAnuncio } from '@/lib/agente/anuncios'
import { secretoRecibido } from '@/lib/agente/secreto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * El trabajo de `after()` incluye la espera de ráfaga (10 s) más la llamada al
 * modelo (4–17 s medidos) y los envíos a GHL. 90 s da margen de sobra sin
 * dejar funciones colgadas si algo se atasca.
 */
export const maxDuration = 90

/**
 * Webhook del agente Sol — FASE 1: escucha y registra, NO responde a nadie.
 *
 * Objetivo de esta fase: con tráfico real, confirmar la forma del payload de
 * GHL y que sepamos distinguir quién escribió (cliente / Sol / bot actual /
 * asesora). Hasta validar eso, el agente no tiene voz.
 *
 * Contrato con GHL: responder 200 de inmediato. El trabajo va en `after()`,
 * que corre cuando la respuesta ya salió, para no arriesgar el timeout del
 * webhook (GHL reintenta y duplicaría eventos).
 */

function secretoValido(req: NextRequest): boolean {
  const esperado = process.env.AGENTE_WEBHOOK_SECRET
  if (!esperado) return false // sin secreto configurado, nadie entra

  const recibido = secretoRecibido(req)

  // Comparación de tiempo constante (evita descubrir el secreto midiendo).
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!secretoValido(req)) {
    return Response.json({ ok: false }, { status: 401 })
  }

  let crudo: unknown
  try {
    crudo = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'cuerpo no es JSON' }, { status: 400 })
  }

  // El procesamiento va después de responder. Devolvemos 200 ya.
  after(async () => {
    const parsed = eventoGhlSchema.safeParse(crudo)

    if (!parsed.success) {
      // Ni así lo descartamos: guardar el crudo es el objetivo de esta fase.
      await registrarEvento({
        autor: 'desconocido',
        payload: crudo,
        nota: `no coincide con el esquema: ${parsed.error.issues.map(i => i.path.join('.')).join(', ')}`,
      })
      return
    }

    const n = normalizar(parsed.data)

    // Compuerta barata: la acción gratuita ya manda los tags, así que a un
    // proveedor o mayorista se le cierra la puerta SIN gastar una sola llamada
    // a la API (ni al modelo, cuando Sol tenga voz).
    const esNoCliente = n.tags.some(t => (TAGS.noCliente as readonly string[]).includes(t))
    if (esNoCliente) {
      await registrarEvento({
        tipo: n.tipo,
        conversationId: n.conversationId,
        contactId: n.contactId,
        messageId: n.messageId,
        direccion: n.direccion,
        canal: n.canal,
        cuerpo: n.cuerpo,
        autor: 'cliente',
        payload: { webhook: crudo, mensaje: null, tags: n.tags },
        nota: 'NO CLIENTE (proveedor/mayorista) · descartado por tags, sin llamar a la API',
      })
      return
    }

    // Falta la dirección y la huella del autor: eso solo está en la API.
    const extra = n.contactId ? await enriquecerDesdeContacto(n.contactId) : null

    const direccion = n.direccion ?? extra?.direccion
    const messageId = n.messageId ?? extra?.messageId

    const { autor, nota } = await identificarAutor({
      direccion,
      messageId,
      // La huella del bot actual viene en el mensaje real, no en el webhook.
      payload: extra?.mensajeCrudo ?? crudo,
    })

    const tags = n.tags.length ? n.tags : (extra?.tagsContacto ?? [])
    const conversationId = n.conversationId ?? extra?.conversationId

    // El evento se registra ANTES de esperar la ráfaga: así, si llega otro
    // mensaje mientras esperamos, ese ve el nuestro y sabe que es más nuevo.
    const evento = await registrarEvento({
      tipo: n.tipo,
      conversationId,
      contactId: n.contactId,
      messageId,
      direccion,
      canal: n.canal ?? extra?.canal,
      cuerpo: n.cuerpo ?? extra?.cuerpo,
      autor,
      payload: { webhook: crudo, mensaje: extra?.mensajeCrudo ?? null, tags },
      nota: [nota, extra?.esNoCliente ? 'NO CLIENTE (proveedor/mayorista)' : null, ...(extra?.nota ?? [])]
        .filter(Boolean)
        .join(' · '),
    })

    // Solo los mensajes del cliente disparan un turno de Sol.
    if (autor !== 'cliente' || !n.contactId || !conversationId) return

    // Si el cliente escribió desde un anuncio de Meta, GHL manda la etiqueta
    // del anuncio en el payload: queda registrado por cuál llegó esta
    // conversación para que Sol sepa qué vio (nunca lanza).
    const referral = extraerReferral(crudo)
    if (referral) await registrarAnuncio(referral, conversationId, n.contactId)

    try {
      if (evento && !(await meTocaResponder(conversationId, evento.recibidoEn))) {
        await anotarEvento(evento.id, 'SOL → cede el turno: llegó otro mensaje (ráfaga)')
        return
      }

      const turno = await atender({
        contactId: n.contactId,
        conversationId,
        nombre: n.nombreContacto,
        nombreConfirmado: extra?.nombreConfirmado,
        canal: n.canal ?? extra?.canal,
        tags,
        fechaMensaje: extra?.mensajeCrudo?.dateAdded
          ? new Date(extra.mensajeCrudo.dateAdded)
          : new Date(),
      })
      if (evento) await anotarEvento(evento.id, `SOL → ${turno.nota}`)
    } catch (err) {
      console.error('atender error:', err)
      if (evento) await anotarEvento(evento.id, `SOL falló: ${(err as Error).message}`)
    }
  })

  return Response.json({ ok: true })
}

/**
 * Sonda de vida y diagnóstico de configuración. Va detrás del mismo secreto y
 * NUNCA devuelve valores: solo si cada variable está presente. Sirve para
 * confirmar desde fuera que el despliegue tiene todo lo que necesita.
 */
export async function GET(req: NextRequest) {
  if (!secretoValido(req)) return Response.json({ ok: false }, { status: 401 })

  const activoDesde = ACTIVO_DESDE
  const encendido = activoDesde.getTime() <= Date.now()

  return Response.json({
    ok: true,
    encendido,
    modo: encendido
      ? TAG_PRUEBAS
        ? `responde solo a contactos con el tag "${TAG_PRUEBAS}"`
        : 'responde a todos los contactos'
      : 'mudo (solo escucha y registra)',
    activoDesde: activoDesde.toISOString(),
    configuracion: {
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      GHL_TWC_PIT: Boolean(process.env.GHL_TWC_PIT),
      AGENTE_WEBHOOK_SECRET: Boolean(process.env.AGENTE_WEBHOOK_SECRET),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  })
}
