import { createAdminClient } from '@/lib/supabase/admin'
import {
  REQUISITOS_INTERNACIONAL,
  REQUISITOS_NACIONAL,
  type Requisitos,
} from '@/lib/documentos/config'

/**
 * Reglas de visa por país (tabla doc_reglas_visa, editable en /admin/documentos/visas)
 * y la sugerencia de requisitos para un viaje a partir de su destino.
 *
 * La regla no se adivina: si el destino no calza con ningún país de la tabla
 * (ni directamente ni a través de un viaje del catálogo), se sugiere pasaporte
 * sin visa y se le dice a la asesora que no hay regla para ese destino.
 */

export interface ReglaVisa {
  pais: string
  requiere_visa: boolean
  nota: string | null
  actualizado_por: string | null
  actualizado_en: string
}

export async function listarReglasVisa(): Promise<ReglaVisa[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('doc_reglas_visa').select('*').order('pais')
  return (data ?? []) as ReglaVisa[]
}

/** Sin tildes, minúsculas, sin puntuación: para comparar nombres de lugares. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Sugerencia {
  requisitos: Requisitos
  /** País de la regla que se aplicó, o null si no hubo regla. */
  pais: string | null
  nota: string | null
  /** Texto corto para la asesora: de dónde salió la sugerencia. */
  motivo: string
}

/**
 * Sugiere los requisitos de un viaje según su destino ("Destino de interés" de
 * la oportunidad). Primero busca un país de la tabla dentro del texto; si no,
 * busca un viaje del catálogo cuyo nombre esté en el texto y usa su país.
 */
export async function sugerirRequisitos(destino: string | null | undefined): Promise<Sugerencia> {
  const texto = normalizar(destino ?? '')
  const sinRegla: Sugerencia = {
    requisitos: { ...REQUISITOS_INTERNACIONAL },
    pais: null,
    nota: null,
    motivo: texto
      ? 'No hay regla de visa para este destino: se sugiere pasaporte. Revisa y ajusta.'
      : 'La oportunidad no tiene destino: se sugiere pasaporte. Revisa y ajusta.',
  }
  if (!texto) return sinRegla

  const reglas = await listarReglasVisa()
  const aplicar = (r: ReglaVisa, via: string): Sugerencia => ({
    requisitos: r.pais === 'Colombia' ? { ...REQUISITOS_NACIONAL } : { ...REQUISITOS_INTERNACIONAL, visa: r.requiere_visa },
    pais: r.pais,
    nota: r.nota,
    motivo: via,
  })

  // 1) El país aparece en el texto del destino ("México - Cancún").
  const directa = reglas
    .filter(r => texto.includes(normalizar(r.pais)))
    .sort((a, b) => b.pais.length - a.pais.length)[0]
  if (directa) return aplicar(directa, `Regla de ${directa.pais}.`)

  // 2) Un viaje del catálogo con ese nombre → su país.
  const admin = createAdminClient()
  const { data: viajes } = await admin.from('destinos').select('nombre, pais').limit(500)
  const viaje = ((viajes ?? []) as { nombre: string; pais: string | null }[])
    .filter(v => v.pais && v.nombre && (texto.includes(normalizar(v.nombre)) || normalizar(v.nombre).includes(texto)))
    .sort((a, b) => b.nombre.length - a.nombre.length)[0]
  if (viaje?.pais) {
    const regla = reglas.find(r => normalizar(r.pais) === normalizar(viaje.pais!))
    if (regla) return aplicar(regla, `Regla de ${regla.pais} (viaje "${viaje.nombre}" del catálogo).`)
    if (normalizar(viaje.pais) === 'colombia') {
      return { requisitos: { ...REQUISITOS_NACIONAL }, pais: 'Colombia', nota: null, motivo: `Viaje nacional ("${viaje.nombre}").` }
    }
    return { ...sinRegla, motivo: `El viaje "${viaje.nombre}" es a ${viaje.pais} y no hay regla de visa para ese país.` }
  }

  return sinRegla
}
