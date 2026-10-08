import Link from 'next/link'
import { requirePagina } from '@/lib/admin/guard'
import { revisarCatalogo, type Problema } from '@/lib/catalogo/salud'

export const dynamic = 'force-dynamic'

const COLOR: Record<Problema['gravedad'], { bg: string; fg: string; etiqueta: string }> = {
  grave: { bg: 'rgba(239,68,68,0.12)', fg: '#dc2626', etiqueta: 'Grave' },
  aviso: { bg: 'rgba(234,179,8,0.14)', fg: '#a16207', etiqueta: 'Aviso' },
}

export default async function SaludCatalogoPage() {
  await requirePagina()

  const salud = await revisarCatalogo()
  const avisos = salud.problemas.length - salud.graves

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Salud del catálogo
        </h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Lo que está mal o incompleto en los viajes que ve el cliente. Se revisa con el mismo código que usan la web
          y Sol, así que lo que aparece aquí es exactamente lo que ellos ven. Cada lunes llega un resumen por WhatsApp.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Viajes activos', valor: salud.activos },
          { label: 'Los ve Sol', valor: salud.enSol },
          { label: 'Problemas graves', valor: salud.graves },
          { label: 'Avisos', valor: avisos },
        ].map(t => (
          <div key={t.label} className="rounded-lg p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p className="font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{t.label}</p>
            <p className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{t.valor}</p>
          </div>
        ))}
      </div>

      {salud.problemas.length === 0 ? (
        <p className="rounded-md p-8 text-center font-inter text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          Todo en orden ✅ Ningún viaje activo tiene problemas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {salud.problemas.map((p, i) => {
            const c = COLOR[p.gravedad]
            return (
              <li key={`${p.slug ?? p.nombre}-${p.tipo}-${i}`} className="flex flex-wrap items-start gap-3 rounded-lg p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <span className="rounded px-2 py-0.5 font-inter text-xs font-semibold" style={{ background: c.bg, color: c.fg }}>{c.etiqueta}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-inter text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.nombre} · <span style={{ color: c.fg }}>{p.tipo}</span>
                  </p>
                  <p className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>{p.detalle}</p>
                </div>
                {p.id && (
                  <Link href={`/admin/destinos/${p.id}`} className="font-inter text-xs underline" style={{ color: 'var(--orange)' }}>
                    Ir al viaje
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-6 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Revisado: {new Date(salud.revisadoEn).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
      </p>
    </>
  )
}
