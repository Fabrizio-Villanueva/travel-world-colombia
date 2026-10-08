import Link from 'next/link'
import { Plane, Star, HelpCircle, Users, ArrowRight } from 'lucide-react'
import { requirePagina } from '@/lib/admin/guard'
import { superadmins } from '@/lib/admin/allowlist'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

export default async function Dashboard() {
  const { user } = await requirePagina()

  const admin = createAdminClient()
  const cnt = (q: { count: number | null }) => q.count ?? 0

  const [
    viajesTot, viajesAct, resenasTot, resenasAct, faqsTot, faqsAct, allowlist,
    recienteAct,
  ] = await Promise.all([
    admin.from('destinos').select('*', { count: 'exact', head: true }),
    admin.from('destinos').select('*', { count: 'exact', head: true }).eq('activo', true),
    admin.from('resenas').select('*', { count: 'exact', head: true }),
    admin.from('resenas').select('*', { count: 'exact', head: true }).eq('activa', true),
    admin.from('faqs').select('*', { count: 'exact', head: true }),
    admin.from('faqs').select('*', { count: 'exact', head: true }).eq('activa', true),
    admin.from('admin_allowlist').select('*', { count: 'exact', head: true }),
    admin.from('audit_log').select('user_email, accion, destino_nombre, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const cards = [
    { href: '/admin/viajes',   Icon: Plane,      label: 'Viajes',     valor: cnt(viajesTot),  sub: `${cnt(viajesAct)} activos` },
    { href: '/admin/resenas',  Icon: Star,       label: 'Reseñas',    valor: cnt(resenasTot), sub: `${cnt(resenasAct)} activas` },
    { href: '/admin/faqs',     Icon: HelpCircle, label: 'Preguntas',  valor: cnt(faqsTot),    sub: `${cnt(faqsAct)} activas` },
    { href: '/admin/usuarios', Icon: Users,      label: 'Usuarios',   valor: cnt(allowlist) + superadmins().length, sub: 'con acceso' },
  ]

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Panel
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Hola, {user.email}. Resumen de tu sitio.
        </p>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ href, Icon, label, valor, sub }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl p-5 transition-transform hover:-translate-y-0.5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <Icon size={20} style={{ color: 'var(--orange)' }} />
            <p className="mt-3 font-plus-jakarta text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{valor}</p>
            <p className="font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
            <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>{sub}</p>
          </Link>
        ))}
      </div>

      <Panel titulo="Actividad reciente" href="/admin/actividad">
        {(recienteAct.data ?? []).length === 0 ? (
          <Vacio>Sin actividad registrada.</Vacio>
        ) : (
          (recienteAct.data ?? []).map((a, i) => (
            <Item
              key={i}
              principal={`${a.accion}${a.destino_nombre ? ` · ${a.destino_nombre}` : ''}`}
              secundario={a.user_email}
              fecha={a.created_at}
            />
          ))
        )}
      </Panel>
    </>
  )
}

function Panel({ titulo, href, children }: { titulo: string; href: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-plus-jakarta text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{titulo}</h2>
        <Link href={href} className="flex items-center gap-1 font-inter text-xs" style={{ color: 'var(--orange)' }}>
          Ver todo <ArrowRight size={13} />
        </Link>
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

function Item({ principal, secundario, fecha }: { principal: string; secundario: string; fecha: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <div className="min-w-0">
        <p className="truncate font-inter text-sm" style={{ color: 'var(--text-primary)' }}>{principal}</p>
        <p className="truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{secundario}</p>
      </div>
      <time className="shrink-0 font-inter text-xs" style={{ color: 'var(--text-dim)' }}>{fmtFecha.format(new Date(fecha))}</time>
    </li>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <li className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>{children}</li>
}
