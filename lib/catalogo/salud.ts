import { getDestinos } from '@/lib/destinos'
import { construirConocimiento } from '@/lib/agente/conocimiento'
import { createAdminClient } from '@/lib/supabase/admin'
import { precioFueraDeRango } from '@/lib/validations/destino'
import { formatearPrecio } from '@/lib/precio'
import type { Destino } from '@/types/destino'

/**
 * "Salud del catálogo": lo que está mal o incompleto en lo que VE EL CLIENTE.
 *
 * Usa a propósito el MISMO código que la web y Sol (`getDestinos` y
 * `construirConocimiento`), no consultas aparte: si algo se ve mal aquí, se ve
 * mal allá. Así se evita el error del 05-oct-2026 (una consulta con tope y una
 * columna vieja dieron un diagnóstico falso del catálogo).
 */

export type Gravedad = 'grave' | 'aviso'

export interface Problema {
  /** id del viaje (para el link de edición) */
  id?: string
  slug?: string
  nombre: string
  gravedad: Gravedad
  tipo: string
  detalle: string
}

export interface SaludCatalogo {
  activos: number
  enSol: number
  problemas: Problema[]
  graves: number
  revisadoEn: string
}

/** Precio sin tocar en más de esto → revisar (tarifas cambian por temporada). */
const DIAS_PRECIO_VIEJO = 90
/** Los rangos de Sol se revisan cada 6 meses (decidido 05-oct-2026). */
const DIAS_RANGO_VIEJO = 180

const dias = (iso?: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 86_400_000 : Infinity)

function revisarDestino(d: Destino): Problema[] {
  const p: Problema[] = []
  const base = { id: d.id, slug: d.slug, nombre: d.nombre }
  const tienePrecio = d.precio_valor != null && Boolean(d.precio_moneda)

  if (!tienePrecio && !d.a_la_medida) {
    p.push({
      ...base,
      gravedad: 'grave',
      tipo: 'Sin precio',
      detalle: d.precio_desde
        ? `Solo tiene el texto viejo "${d.precio_desde}". Cárgalo como valor + moneda o márcalo "A la medida".`
        : 'Publicado sin precio: Sol dice "lo confirma una asesora". Pon el precio o márcalo "A la medida".',
    })
  }
  const raro = precioFueraDeRango(d.precio_valor, d.precio_moneda)
  if (raro) p.push({ ...base, gravedad: 'grave', tipo: 'Precio sospechoso', detalle: raro })
  if (tienePrecio && dias(d.precio_actualizado_en) > DIAS_PRECIO_VIEJO) {
    p.push({
      ...base,
      gravedad: 'aviso',
      tipo: 'Precio viejo',
      detalle: d.precio_actualizado_en
        ? `${formatearPrecio(d.precio_valor!, d.precio_moneda!)} sin actualizar desde ${new Date(d.precio_actualizado_en).toLocaleDateString('es-CO')}.`
        : `${formatearPrecio(d.precio_valor!, d.precio_moneda!)} sin fecha de actualización.`,
    })
  }
  if (!(d.imagen_hero || d.imagen_thumb || d.galeria?.length)) {
    p.push({ ...base, gravedad: 'aviso', tipo: 'Sin foto', detalle: 'Sol no puede mandar la ficha con foto; solo el link.' })
  }
  if (!d.descripcion?.trim()) p.push({ ...base, gravedad: 'aviso', tipo: 'Sin descripción', detalle: 'La página y Sol no tienen cómo describir el viaje.' })
  if (!d.incluye?.length) p.push({ ...base, gravedad: 'aviso', tipo: 'Sin "incluye"', detalle: 'El borrador de cotización sale sin lo que incluye.' })
  return p
}

export async function revisarCatalogo(): Promise<SaludCatalogo> {
  const [destinos, conocimiento] = await Promise.all([getDestinos(), construirConocimiento()])
  const problemas = destinos.flatMap(revisarDestino)

  // ¿Sol recibe TODOS los programas activos? (mismo conteo que la web)
  // Cada programa del índice termina en "…/destinos/<slug>".
  const slugsEnSol = new Set(
    conocimiento.base
      .split('\n')
      .map(l => l.match(/\/destinos\/([a-z0-9-]+)\s*$/)?.[1])
      .filter((s): s is string => Boolean(s))
  )
  const faltanEnSol = destinos.filter(d => !slugsEnSol.has(d.slug))
  for (const d of faltanEnSol) {
    problemas.push({ id: d.id, slug: d.slug, nombre: d.nombre, gravedad: 'grave', tipo: 'Sol no lo ve', detalle: 'Está activo en la web pero no aparece en el catálogo que recibe Sol.' })
  }

  // Rangos de referencia de Sol: se revisan cada 6 meses.
  const { data: rangos } = await createAdminClient()
    .from('sol_rangos')
    .select('destino, revisado_en')
    .eq('activo', true)
  for (const r of (rangos ?? []) as { destino: string; revisado_en: string }[]) {
    if (dias(r.revisado_en) > DIAS_RANGO_VIEJO) {
      problemas.push({
        nombre: `Rango: ${r.destino}`,
        gravedad: 'aviso',
        tipo: 'Rango viejo',
        detalle: `Revisado el ${new Date(r.revisado_en).toLocaleDateString('es-CO')}: hace más de 6 meses. Revísalo en Sol › Reglas comerciales.`,
      })
    }
  }

  const orden: Record<Gravedad, number> = { grave: 0, aviso: 1 }
  problemas.sort((a, b) => orden[a.gravedad] - orden[b.gravedad] || a.nombre.localeCompare(b.nombre))

  return {
    activos: destinos.length,
    enSol: destinos.length - faltanEnSol.length,
    problemas,
    graves: problemas.filter(x => x.gravedad === 'grave').length,
    revisadoEn: new Date().toISOString(),
  }
}

/** Texto corto para el aviso semanal por WhatsApp. null si no hay nada que avisar. */
export function textoAlerta(s: SaludCatalogo): string | null {
  if (s.problemas.length === 0) return null
  const graves = s.problemas.filter(p => p.gravedad === 'grave')
  const avisos = s.problemas.length - graves.length
  const lista = graves.slice(0, 12).map(p => `• ${p.nombre}: ${p.tipo.toLowerCase()}`).join('\n')
  return [
    '🩺 *Salud del catálogo* (revisión semanal)',
    '',
    `${s.activos} viajes activos · Sol ve ${s.enSol}.`,
    graves.length ? `*${graves.length} problema${graves.length === 1 ? '' : 's'} grave${graves.length === 1 ? '' : 's'}:*\n${lista}${graves.length > 12 ? `\n…y ${graves.length - 12} más` : ''}` : 'Sin problemas graves ✅',
    avisos ? `Además ${avisos} aviso${avisos === 1 ? '' : 's'} menor${avisos === 1 ? '' : 'es'} (fotos, precios viejos, rangos).` : null,
    '',
    'Detalle: travelworldcolombia.com/admin/catalogo',
  ]
    .filter(x => x !== null)
    .join('\n')
}

/** Conteo liviano de problemas graves de los viajes (para el menú del panel). */
export async function contarGraves(): Promise<number> {
  try {
    return (await getDestinos()).flatMap(revisarDestino).filter(p => p.gravedad === 'grave').length
  } catch {
    return 0
  }
}
