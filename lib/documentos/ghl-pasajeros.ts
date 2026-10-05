import { actualizarCamposOportunidad, listarCamposTodosLosModelos } from '@/lib/agente/ghl'
import type { TipoDocumento } from '@/lib/documentos/config'
import type { DatosDocumento } from '@/lib/documentos/tipos'
import { SITE } from '@/lib/site'

/**
 * Escritura de los datos confirmados en los campos P1–P8 de la oportunidad.
 *
 * Los campos se resuelven por NOMBRE (igual que el Generador de Contratos):
 * se crearon desde el catálogo y el nombre es su llave natural. En GHL queda
 * el DATO (nombre, número, fechas) y un ENLACE al panel para ver las fotos
 * (pide sesión del equipo); la imagen nunca sale del bucket privado.
 */

/**
 * Página del panel con los documentos de un viajero (frente y reverso). Va en
 * el campo de oportunidad `P{n} - Documentos (panel)`: abrirla exige sesión
 * del equipo, firma las fotos por 5 minutos y queda en la bitácora.
 */
export function urlDocumentosPanel(opportunityId: string, viajero: number): string {
  return `${SITE.url.replace(/\/$/, '')}/admin/reservas/${encodeURIComponent(opportunityId)}/documentos/${viajero}`
}

let cache: { porNombre: Map<string, string>; vence: number } | null = null

async function idsPorNombre(): Promise<Map<string, string>> {
  if (cache && Date.now() < cache.vence) return cache.porNombre
  const campos = await listarCamposTodosLosModelos()
  const porNombre = new Map<string, string>()
  for (const c of campos) {
    if (c.model === 'opportunity' && c.name) porNombre.set(c.name.trim(), c.id)
  }
  cache = { porNombre, vence: Date.now() + 10 * 60_000 }
  return porNombre
}

function nombreCompleto(d: DatosDocumento): string {
  return [d.nombres, d.apellidos].map(s => (s ?? '').trim()).filter(Boolean).join(' ')
}

/**
 * Qué campo recibe qué dato, por tipo de documento. Nombre y fecha de
 * nacimiento los traen pasaporte y cédula: el último confirmado manda (son el
 * mismo dato de la misma persona).
 */
function lote(
  opportunityId: string,
  viajero: number,
  tipo: TipoDocumento,
  d: DatosDocumento
): { nombre: string; valor: string }[] {
  const p = `P${viajero} - `
  const out: { nombre: string; valor: string }[] = []
  const poner = (campo: string, valor: string | undefined) => {
    const v = (valor ?? '').trim()
    if (v) out.push({ nombre: p + campo, valor: v })
  }
  if (tipo === 'pasaporte') {
    poner('Nombre y Apellido', nombreCompleto(d))
    poner('Pasaporte', d.numero)
    poner('Fecha de Nacimiento', d.fecha_nacimiento)
    poner('Vencimiento Pasaporte', d.fecha_vencimiento)
    poner('Documento', d.documento_identidad)
  } else if (tipo === 'cedula') {
    poner('Nombre y Apellido', nombreCompleto(d))
    poner('Documento', d.numero)
    poner('Fecha de Nacimiento', d.fecha_nacimiento)
  } else if (tipo === 'registro_civil') {
    poner('Nombre y Apellido', nombreCompleto(d))
    poner('Documento', d.numero)
    poner('Fecha de Nacimiento', d.fecha_nacimiento)
  } else {
    poner('Visa Número', d.numero)
    poner('Visa Vencimiento', d.fecha_vencimiento)
  }
  poner('Documentos (panel)', urlDocumentosPanel(opportunityId, viajero))
  return out
}

/** Escribe los datos de un documento en la oportunidad. Devuelve cuántos campos escribió. */
export async function escribirViajeroEnGhl(
  opportunityId: string,
  viajero: number,
  tipo: TipoDocumento,
  datos: DatosDocumento
): Promise<number> {
  const ids = await idsPorNombre()
  const campos = lote(opportunityId, viajero, tipo, datos)
    .map(({ nombre, valor }) => {
      const id = ids.get(nombre)
      if (!id) {
        console.warn(`[documentos] campo de oportunidad no encontrado: ${nombre}`)
        return null
      }
      return { id, field_value: valor }
    })
    .filter((c): c is { id: string; field_value: string } => c !== null)
  if (campos.length === 0) return 0
  await actualizarCamposOportunidad(opportunityId, campos)
  return campos.length
}

/** Valor de un campo P{n} por nombre (para precargar nombres en el portal). */
export async function idCampoPasajero(nombre: string): Promise<string | undefined> {
  return (await idsPorNombre()).get(nombre)
}
