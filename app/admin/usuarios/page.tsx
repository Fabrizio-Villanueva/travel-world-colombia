import { ShieldCheck, Clock, Users as UsersIcon, Send } from 'lucide-react'
import { requirePagina } from '@/lib/admin/guard'
import { superadmins, ROLE_LABEL, type Role } from '@/lib/admin/allowlist'
import { createAdminClient } from '@/lib/supabase/admin'
import { AprobarBtn, RevocarBtn, RoleSelect, InvitarForm, NombreEditable } from './UserActions'

export const dynamic = 'force-dynamic'

const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })

interface AllowRow { email: string; nombre: string | null; rol: Role | null; aprobado_por: string | null; created_at: string }

export default async function UsuariosPage() {
  const session = await requirePagina({ roles: ['admin'] })
  const { user, rol: miRol } = session
  const esAdmin = miRol === 'admin'
  const puedeModificar = miRol !== 'lector'

  const admin = createAdminClient()
  const [{ data: aprobados }, { data: usersData }] = await Promise.all([
    admin.from('admin_allowlist').select('email, nombre, rol, aprobado_por, created_at').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers(),
  ])

  const supers = superadmins()
  const filas = (aprobados ?? []) as AllowRow[]
  const aprobadosEmails = new Set(filas.map(a => a.email.toLowerCase()))
  const registrados = usersData?.users ?? []
  // Estado de verificación por correo: nos dice si la persona ya confirmó su
  // correo (email_confirmed_at) o si ni siquiera ha creado la cuenta todavía.
  const authByEmail = new Map(registrados.map(u => [(u.email ?? '').toLowerCase(), u]))

  const pendientes = registrados.filter(u => {
    const e = (u.email ?? '').toLowerCase()
    return e && !supers.includes(e) && !aprobadosEmails.has(e)
  })

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Usuarios
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          El acceso al panel es solo por invitación: invita aquí a los nuevos usuarios con su rol
        </p>
      </div>

      {/* Invitar: única vía de alta (el registro público de Supabase está apagado). */}
      {esAdmin && (
        <Seccion icon={<Send size={16} />} titulo="Invitar usuario">
          <li
            className="rounded-lg p-4"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <InvitarForm />
          </li>
        </Seccion>
      )}

      {/* Pendientes: cuentas registradas o creadas en Supabase, aún sin aprobar. */}
      {pendientes.length > 0 && (
        <Seccion icon={<Clock size={16} />} titulo="Pendientes" n={pendientes.length}>
          {pendientes.map(u => (
            <Fila key={u.id} titulo={u.email ?? '—'} sub={`Registrado el ${fmtFecha.format(new Date(u.created_at))}`}>
              {puedeModificar ? <AprobarBtn email={u.email ?? ''} /> : null}
            </Fila>
          ))}
        </Seccion>
      )}

      {/* Aprobados (gestionables) */}
      <Seccion icon={<UsersIcon size={16} />} titulo="Con acceso" n={filas.length}>
        {filas.length === 0 ? (
          <Vacio>Aún no hay usuarios además de los superadmins.</Vacio>
        ) : (
          filas.map(a => {
            const esYo = a.email.toLowerCase() === (user.email ?? '').toLowerCase()
            const authUser = authByEmail.get(a.email.toLowerCase())
            return (
              <Fila
                key={a.email}
                titulo={<NombreEditable email={a.email} nombre={a.nombre} puedeEditar={puedeModificar} />}
                badge={<EstadoBadge authExiste={Boolean(authUser)} confirmado={Boolean(authUser?.email_confirmed_at)} />}
                sub={<>{a.email} · {ROLE_LABEL[(a.rol ?? 'lector') as Role]} · alta {fmtFecha.format(new Date(a.created_at))}{a.aprobado_por ? ` · por ${a.aprobado_por}` : ''}{esYo ? ' · (tú)' : ''}</>}
              >
                {puedeModificar && (
                  <div className="flex items-center gap-2">
                    <RoleSelect email={a.email} rol={(a.rol ?? 'lector') as Role} puedeAdmin={esAdmin} disabled={esYo} />
                    {esAdmin && !esYo ? <RevocarBtn email={a.email} /> : null}
                  </div>
                )}
              </Fila>
            )
          })
        )}
      </Seccion>

      {/* Superadmins (env) */}
      <Seccion icon={<ShieldCheck size={16} />} titulo="Superadmins (fijos)" n={supers.length}>
        {supers.map(e => {
          const nombre = filas.find(a => a.email.toLowerCase() === e)?.nombre
          return (
          <Fila key={e} titulo={nombre ?? e} sub={`${nombre ? `${e} · ` : ''}Admin · definido en ADMIN_EMAILS · no se puede cambiar aquí`}>
            <span className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>Permanente</span>
          </Fila>
          )
        })}
      </Seccion>
    </>
  )
}

function Seccion({ icon, titulo, n, children }: { icon: React.ReactNode; titulo: string; n?: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        <span style={{ color: 'var(--orange)' }}>{icon}</span>
        {titulo}
        {n !== undefined && (
          <span className="rounded-full px-2 py-0.5 font-inter text-xs" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{n}</span>
        )}
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

function Fila({ titulo, sub, badge, children }: { titulo: React.ReactNode; sub: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li
      className="flex items-center gap-4 rounded-lg p-3"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 truncate font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{titulo}</div>
          {badge}
        </div>
        <p className="truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  )
}

/**
 * Estado de verificación de correo del usuario:
 *  - Sin cuenta: aprobado en la allowlist pero aún no se ha registrado.
 *  - Sin confirmar: se registró pero no ha hecho clic en el enlace del correo.
 *  - (Confirmado): no muestra nada, es el estado normal.
 */
function EstadoBadge({ authExiste, confirmado }: { authExiste: boolean; confirmado: boolean }) {
  if (!authExiste) {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 font-inter text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        Sin cuenta
      </span>
    )
  }
  if (!confirmado) {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 font-inter text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)', color: 'var(--orange)' }}
      >
        Sin confirmar
      </span>
    )
  }
  return null
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-md p-6 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
      {children}
    </li>
  )
}
