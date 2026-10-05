import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Solo protege el panel admin (chequeo optimista). Los headers de seguridad
 * viven en next.config.ts (fuente única); por eso el matcher se limita a
 * /admin y no corre en cada request del sitio público.
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // SameSite=None para sobrevivir dentro del iframe de GHL — ver
      // lib/supabase/server.ts (los tres clientes deben coincidir).
      cookieOptions: { sameSite: 'none', secure: true },
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalida el JWT contra el servidor de Supabase
  // (más seguro que getSession(), que solo confía en la cookie).
  const { data: { user } } = await supabase.auth.getUser()

  // Páginas de auth públicas: login (entrar), registro (crear cuenta / ver
  // estado "pendiente de aprobación") y el flujo de restablecer contraseña
  // (recuperar = pedir el enlace estando deslogueado; actualizar-password = poner
  // la nueva con la sesión de recuperación). No deben forzar redirecciones.
  const path = req.nextUrl.pathname
  const isAuthPage =
    path.startsWith('/admin/login') ||
    path.startsWith('/admin/registro') ||
    path.startsWith('/admin/recuperar') ||
    path.startsWith('/admin/actualizar-password')

  if (!user && !isAuthPage) {
    // Conserva a dónde iba (p. ej. el enlace "Documentos (panel)" del CRM)
    // para volver ahí después de iniciar sesión.
    const destino = new URL('/admin/login', req.url)
    if (path !== '/admin') destino.searchParams.set('next', path + req.nextUrl.search)
    return NextResponse.redirect(destino)
  }

  if (user && !isAuthPage) {
    const email = (user.email ?? '').toLowerCase()
    const superadmins = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? []
    let aprobado = superadmins.includes(email)
    let rol: string | null = aprobado ? 'admin' : null
    if (!aprobado) {
      // ¿Aprobado desde el panel? (tabla admin_allowlist). El usuario está
      // autenticado, así que la política RLS de lectura de su fila lo permite.
      const { data } = await supabase.from('admin_allowlist').select('email, rol').eq('email', email).maybeSingle()
      aprobado = Boolean(data)
      rol = data?.rol ?? null
    }
    if (!aprobado) {
      // Autenticado pero fuera de la allowlist → pantalla de "pendiente".
      return NextResponse.redirect(new URL('/admin/registro', req.url))
    }

    // El representante solo ve Reservas: cualquier otra sección lo devuelve
    // ahí (chequeo optimista; los guards de página/acción son la defensa real).
    if (rol === 'representante' && !path.startsWith('/admin/reservas')) {
      return NextResponse.redirect(new URL('/admin/reservas', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
