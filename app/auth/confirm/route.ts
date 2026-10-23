import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Procesa el enlace del correo de confirmación de Supabase (Ruta B).
 *
 * La plantilla de "Confirm signup" apunta aquí con `token_hash` + `type`:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/admin
 *
 * Verificamos el token (crea la sesión) y mandamos al panel. Si el enlace
 * expiró o no es válido, de vuelta al login con un aviso. Usamos token_hash
 * (verifyOtp) en vez del flujo con `code` para que el enlace funcione aunque
 * se abra en otro dispositivo o navegador.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return redirectTo(request, next)
  } else if (code) {
    // Respaldo por si la plantilla usa el flujo PKCE por defecto.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirectTo(request, next)
  } else if (!searchParams.has('error')) {
    // Flujo implícito (plantilla con {{ .ConfirmationURL }}, p. ej. "Invite
    // user"): la sesión viene en el #fragmento, que el servidor no ve. El
    // navegador conserva el fragmento al redirigir y RescateEnlaceAuth (en el
    // layout raíz) la guarda; sin ?error para no mostrar "enlace vencido".
    return redirectTo(request, '/admin/login')
  }

  return redirectTo(request, '/admin/login?error=enlace_invalido')
}

/** Redirige conservando el host correcto (producción o local). */
function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone()
  const [pathname, search = ''] = path.split('?')
  url.pathname = pathname
  url.search = search
  url.hash = ''
  return NextResponse.redirect(url)
}
