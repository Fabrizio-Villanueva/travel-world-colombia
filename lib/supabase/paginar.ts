/**
 * Supabase (PostgREST) corta cada respuesta en 1000 filas aunque se pida
 * `.limit()` mayor. Para tablas que crecen (bitácoras), pedir por tandas con
 * `.range()` hasta que una tanda llegue incompleta. La consulta debe tener un
 * orden estable para que las tandas no se pisen.
 */
const TANDA = 1000

export async function todasLasFilas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const filas: T[] = []
  for (let desde = 0; ; desde += TANDA) {
    const { data, error } = await consulta(desde, desde + TANDA - 1)
    if (error) return { data: filas, error }
    filas.push(...(data ?? []))
    if (!data || data.length < TANDA) return { data: filas, error: null }
  }
}
