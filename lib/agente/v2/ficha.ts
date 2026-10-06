import { getDestinos } from '@/lib/destinos'
import { precioDesde } from '@/lib/precio'
import { SITE, WHATSAPP } from '@/lib/site'

/**
 * Marcadores de Sol v2 → tarjetas de WhatsApp con botón (GoGHL `#btn`).
 *
 *   [ficha:slug|por qué le encaja]  → foto del destino + título + botón "Ver el viaje"
 *   [llamar]                        → botón para llamar a la agencia
 *
 * Probado en vivo el 05-oct-2026 (WhatsApp Web): llega como tarjeta con la foto
 * y el botón; WebP funciona. GHL guarda el código crudo en el historial; ver
 * `legibleParaSol` en claude.ts. Los separadores `|` y `*` no pueden ir dentro
 * de los textos: se limpian.
 */

const RE_FICHA = /\[ficha:([a-z0-9-]+)(?:\|([^\]]*))?\]/gi
const RE_LLAMAR = /\[llamar\]/gi

const limpiar = (s: string, max: number) => {
  const t = s.replace(/[|*\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

export interface Tarjeta {
  /** El texto `#btn|…` que se envía como mensaje. */
  codigo: string
  /** Para mostrar en el laboratorio sin el código. */
  vista: { titulo: string; texto: string; imagen?: string; boton: string; enlace: string }
}

export async function extraerTarjetas(mensaje: string): Promise<{ texto: string; tarjetas: Tarjeta[] }> {
  const fichas = [...mensaje.matchAll(RE_FICHA)].map(m => ({ slug: m[1].toLowerCase(), motivo: m[2] ?? '' }))
  const llamar = /\[llamar\]/i.test(mensaje)
  const texto = mensaje
    .replace(RE_FICHA, '')
    .replace(RE_LLAMAR, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const tarjetas: Tarjeta[] = []
  if (fichas.length) {
    const porSlug = new Map((await getDestinos()).map(d => [d.slug, d]))
    for (const f of fichas.slice(0, 2)) {
      const d = porSlug.get(f.slug)
      if (!d) continue // slug inventado o inactivo: no se manda nada
      const imagen = d.imagen_hero || d.imagen_thumb || d.galeria?.[0] || undefined
      const precio = precioDesde(d, { conNota: true })
      const titulo = limpiar(`${d.nombre}${d.duracion ? ` · ${d.duracion}` : ''}`, 60)
      const cuerpo = limpiar([f.motivo, precio ? `${precio} por persona, sujeto a fecha y disponibilidad.` : null].filter(Boolean).join('. '), 300)
      const enlace = `${SITE.url}/destinos/${d.slug}`
      const media = imagen ? `image*${imagen}` : 'undefined'
      tarjetas.push({
        codigo: `#btn|${titulo}|${cuerpo || 'undefined'}|${media}|cta_url*Ver el viaje*${enlace}`,
        vista: { titulo, texto: cuerpo, imagen, boton: 'Ver el viaje', enlace },
      })
    }
  }
  if (llamar) {
    const tel = `+${WHATSAPP.principal}`
    tarjetas.push({
      codigo: `#btn|Hablemos por teléfono|Toca el botón y te atendemos en la línea de la agencia.|undefined|cta_call*Llamar*${tel}`,
      vista: { titulo: 'Hablemos por teléfono', texto: 'Toca el botón y te atendemos en la línea de la agencia.', boton: 'Llamar', enlace: `tel:${tel}` },
    })
  }
  return { texto, tarjetas }
}
