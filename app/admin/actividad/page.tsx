import { redirect } from 'next/navigation'
import {
  PlusCircle, Pencil, Trash2, Eye, EyeOff, Star, StarOff, Activity, UserCheck, UserX, UserCog,
  ClipboardList, Send, Link2, Ban, FileSearch, Globe, FileSignature,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin/guard'
import type { AccionAudit } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  user_email: string
  accion: AccionAudit
  destino_slug: string | null
  destino_nombre: string | null
  detalle: Record<string, unknown> | null
  created_at: string
}

/** Etiqueta + color + icono para cada acción. */
const ACCIONES: Record<AccionAudit, { label: string; color: string; Icon: typeof Activity }> = {
  crear:               { label: 'Creó',            color: '#4ade80', Icon: PlusCircle },
  actualizar:          { label: 'Editó',           color: 'var(--orange)', Icon: Pencil },
  eliminar:            { label: 'Eliminó',         color: '#ef4444', Icon: Trash2 },
  activar:             { label: 'Activó',          color: '#4ade80', Icon: Eye },
  ocultar:             { label: 'Ocultó',          color: 'var(--text-muted)', Icon: EyeOff },
  destacar:            { label: 'Destacó',         color: 'var(--orange)', Icon: Star },
  'quitar-destacado':  { label: 'Quitó destacado', color: 'var(--text-muted)', Icon: StarOff },
  'aprobar-usuario':   { label: 'Aprobó acceso',   color: '#4ade80', Icon: UserCheck },
  'invitar-usuario':   { label: 'Invitó',          color: '#4ade80', Icon: Send },
  'revocar-usuario':   { label: 'Revocó acceso',   color: '#ef4444', Icon: UserX },
  'cambiar-rol':       { label: 'Cambió rol',      color: 'var(--orange)', Icon: UserCog },
  'cambiar-nombre-usuario': { label: 'Cambió nombre', color: 'var(--orange)', Icon: UserCog },
  'guardar-reserva':   { label: 'Guardó reserva',  color: '#4ade80', Icon: ClipboardList },
  'enviar-enlace-documentos':  { label: 'Envió enlace de documentos', color: '#4ade80', Icon: Link2 },
  'revocar-enlace-documentos': { label: 'Desactivó enlace de documentos', color: '#ef4444', Icon: Ban },
  'ver-documento':             { label: 'Vio un documento de viajero', color: 'var(--orange)', Icon: FileSearch },
  'editar-regla-visa':         { label: 'Editó regla de visa', color: 'var(--orange)', Icon: Globe },
  'enviar-contrato':           { label: 'Envió contrato para firma', color: '#4ade80', Icon: FileSignature },
  'anular-contrato':           { label: 'Anuló un contrato', color: '#ef4444', Icon: Ban },
  'ver-contrato':              { label: 'Abrió un contrato firmado', color: 'var(--orange)', Icon: FileSearch },
}

// timeZone explícita: en Vercel el proceso corre en UTC, así que sin esto la
// bitácora mostraría las horas corridas 5 h.
const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Bogota',
})

export default async function ActividadPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  // Service-role: no depende de RLS (ver nota en app/admin/viajes/page.tsx).
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const registros = (data ?? []) as AuditRow[]

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Actividad
        </h1>
        <p className="mt-1 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Registro de cambios hechos en el panel · quién, qué y cuándo
        </p>
      </div>

      {error && (
        <p className="rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          Error cargando la bitácora: {error.message}
        </p>
      )}

      {!error && registros.length === 0 && (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Aún no hay actividad registrada. Cada cambio en el panel aparecerá aquí.
        </p>
      )}

      {registros.length > 0 && (
        <ul className="flex flex-col gap-2">
          {registros.map(r => {
            const meta = ACCIONES[r.accion] ?? { label: r.accion, color: 'var(--text-dim)', Icon: Activity }
            const { Icon } = meta
            return (
              <li
                key={r.id}
                className="flex items-center gap-4 rounded-lg p-3"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: meta.color }}
                >
                  <Icon size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-inter text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    {r.destino_nombre ? <> «{r.destino_nombre}»</> : null}
                  </p>
                  <p className="truncate font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.user_email}
                    {r.destino_slug ? <> · /{r.destino_slug}</> : null}
                  </p>
                </div>

                <time
                  dateTime={r.created_at}
                  className="shrink-0 font-inter text-xs"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {fmtFecha.format(new Date(r.created_at))}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
