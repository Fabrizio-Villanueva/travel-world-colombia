import { createAdminClient } from '@/lib/supabase/admin'
import {
  BUCKET_DOCUMENTOS_VIAJEROS,
  DIAS_RETENCION_SIN_REGRESO,
  DIAS_RETENCION_TRAS_REGRESO,
} from '@/lib/documentos/config'

/**
 * Retención (Fase 3): las fotos de los documentos se borran 30 días después de
 * la fecha de regreso del viaje (Ley 1581: no guardar datos sensibles más de lo
 * necesario). Los datos extraídos siguen en GHL (los necesita el contrato / el
 * TMS) y las filas quedan con `borrado_en` como constancia.
 *
 * Lo corre el cron de Vercel (/api/documentos/purga, diario). Idempotente.
 */

export interface ResumenPurga {
  solicitudes: number
  archivos: number
  errores: string[]
}

/** Página del listado de Storage. Con 20 viajeros × varios documentos × 2 caras se superan 100 objetos. */
const PAGINA = 100

/**
 * Todos los objetos bajo la carpeta de la solicitud, paginando. Antes se
 * listaban solo los primeros 100: un grupo grande dejaba fotos huérfanas en el
 * bucket para siempre mientras la solicitud quedaba marcada como purgada.
 */
async function listarTodo(db: ReturnType<typeof createAdminClient>, carpeta: string): Promise<string[]> {
  const rutas: string[] = []
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await db.storage.from(BUCKET_DOCUMENTOS_VIAJEROS).list(carpeta, { limit: PAGINA, offset })
    if (error) throw new Error(`listando ${carpeta}: ${error.message}`)
    const pagina = (data ?? []).filter(o => o.name).map(o => `${carpeta}/${o.name}`)
    rutas.push(...pagina)
    if (pagina.length < PAGINA) return rutas
  }
}

export async function purgarDocumentosVencidos(dry = false): Promise<ResumenPurga> {
  const db = createAdminClient()
  const hoy = new Date()
  const limiteRegreso = new Date(hoy.getTime() - DIAS_RETENCION_TRAS_REGRESO * 86_400_000).toISOString().slice(0, 10)
  const limiteCreacion = new Date(hoy.getTime() - DIAS_RETENCION_SIN_REGRESO * 86_400_000).toISOString()

  const { data, error } = await db
    .from('doc_solicitudes')
    .select('id, fecha_regreso, creada_en, estado')
    .is('purgada_en', null)
    .or(`fecha_regreso.lt.${limiteRegreso},and(fecha_regreso.is.null,creada_en.lt.${limiteCreacion})`)
    .limit(200)
  if (error) throw new Error(error.message)

  const resumen: ResumenPurga = { solicitudes: 0, archivos: 0, errores: [] }
  for (const s of (data ?? []) as { id: string; estado: string }[]) {
    try {
      // Todo lo que haya bajo la carpeta de la solicitud (por si quedó algún objeto huérfano).
      const rutas = await listarTodo(db, s.id)
      if (!dry) {
        // Borrado por lotes y, al final, comprobación de que no quedó nada:
        // la solicitud solo se marca purgada si la carpeta quedó vacía.
        for (let i = 0; i < rutas.length; i += PAGINA) {
          const { error: e } = await db.storage.from(BUCKET_DOCUMENTOS_VIAJEROS).remove(rutas.slice(i, i + PAGINA))
          if (e) throw new Error(e.message)
        }
        const restantes = await listarTodo(db, s.id)
        if (restantes.length > 0) {
          throw new Error(`quedaron ${restantes.length} objeto(s) sin borrar; se reintenta en la próxima corrida`)
        }
        const ahora = new Date().toISOString()
        await db.from('doc_archivos').update({ borrado_en: ahora }).eq('solicitud_id', s.id).is('borrado_en', null)
        await db
          .from('doc_solicitudes')
          .update({
            purgada_en: ahora,
            actualizada_en: ahora,
            // Un enlace activo de un viaje ya regresado no debe seguir abriendo.
            ...(s.estado === 'activa' ? { estado: 'revocada' } : {}),
          })
          .eq('id', s.id)
      }
      resumen.solicitudes++
      resumen.archivos += rutas.length
    } catch (e) {
      resumen.errores.push(`${s.id}: ${(e as Error).message}`)
    }
  }
  return resumen
}
