'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Rescata los enlaces de invitación / recuperación de Supabase que llegan con
 * la sesión en el fragmento (#access_token=…&type=invite).
 *
 * Supabase manda así el enlace cuando la plantilla del correo usa
 * {{ .ConfirmationURL }} (flujo implícito) y, si el redirectTo no está en
 * "Redirect URLs", lo deja caer en el Site URL: el inicio de la web. El
 * fragmento nunca llega al servidor, así que /auth/confirm no lo ve y la
 * persona quedaba en el home sin poder crear su contraseña. Aquí lo tomamos en
 * el navegador, guardamos la sesión y la llevamos al formulario de contraseña.
 */
const TIPOS = new Set(['invite', 'recovery', 'signup', 'magiclink'])

export function RescateEnlaceAuth() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=') && !hash.includes('error_code=')) return
    const p = new URLSearchParams(hash.slice(1))

    if (p.get('error_code')) {
      window.location.replace('/admin/login?error=enlace_invalido')
      return
    }

    const access_token = p.get('access_token')
    const refresh_token = p.get('refresh_token')
    const type = p.get('type') ?? ''
    if (!access_token || !refresh_token || !TIPOS.has(type)) return

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        const destino = error
          ? '/admin/login?error=enlace_invalido'
          : type === 'invite' || type === 'recovery'
            ? '/admin/actualizar-password'
            : '/admin'
        window.location.replace(destino)
      })
  }, [])

  return null
}
