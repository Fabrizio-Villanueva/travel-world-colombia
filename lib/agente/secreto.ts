import type { NextRequest } from 'next/server'

/**
 * Lee el secreto compartido del agente desde el request. Solo lo usan los dos
 * endpoints que llama GHL (webhook y reservacion); los crons exigen únicamente
 * `CRON_SECRET` (auditoría 2026-10-08).
 *
 * Canal preferido: el header `x-sol-secret`. El query `?secret=` sigue
 * aceptado como fallback SOLO mientras los webhooks de GHL migran al header —
 * es deprecado porque la URL completa queda en los logs de Vercel y a la
 * vista de cualquier usuario de la subcuenta de GHL que abra el workflow.
 * Cuando todos los llamadores usen el header: eliminar el fallback y ROTAR el
 * secreto (el viejo ya estuvo en logs).
 */
export function secretoRecibido(req: NextRequest): string {
  const header = req.headers.get('x-sol-secret')
  if (header !== null) return header

  const query = req.nextUrl.searchParams.get('secret')
  if (query !== null) {
    console.warn(
      `[agente] secreto recibido por query string en ${req.nextUrl.pathname} (deprecado: queda en logs) — migrar el llamador al header x-sol-secret`
    )
    return query
  }
  return ''
}
