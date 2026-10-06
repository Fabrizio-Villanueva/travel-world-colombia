import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PoliticaReserva, Promocion, RangoPrecio } from '@/lib/agente/reglas'
import { PoliticaForm, PromocionForm, RangoForm, type OpcionViaje } from './ReglasForms'

export const dynamic = 'force-dynamic'

/** Reglas comerciales de Sol. SOLO administradores (decidido 05-oct-2026). */
export default async function SolReglasPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  if (session.rol !== 'admin') redirect('/admin')

  const admin = createAdminClient()
  const [pol, ran, pro, des] = await Promise.all([
    admin.from('sol_politica_reserva').select('*').eq('id', 1).maybeSingle(),
    admin.from('sol_rangos').select('*').order('destino'),
    admin.from('sol_promociones').select('*').order('valida_hasta', { ascending: false }),
    admin.from('destinos').select('slug, nombre').eq('activo', true).order('nombre'),
  ])
  const opciones = (des.data ?? []) as OpcionViaje[]
  const politica = pol.data as PoliticaReserva | null
  // Más de 6 meses sin revisar → aviso (se calcula aquí, en el servidor).
  const ahora = new Date().getTime()
  const rangos = ((ran.data ?? []) as RangoPrecio[]).map(r => ({
    ...r,
    desde: Number(r.desde),
    hasta: Number(r.hasta),
    viejo: (ahora - Date.parse(r.revisado_en)) / 86_400_000 > 180,
  }))
  const promociones = (pro.data ?? []) as Promocion[]
  const error = pol.error ?? ran.error ?? pro.error

  const h2 = 'mb-1 font-plus-jakarta text-lg font-extrabold'
  const sub = 'mb-4 max-w-2xl font-inter text-sm'

  return (
    <>
      <div className="mb-8">
        <h1 className="font-plus-jakarta text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Sol: reglas comerciales</h1>
        <p className="mt-1 max-w-2xl font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          Lo que Sol puede decir sobre cómo se aparta un viaje, qué precios de referencia dar y qué urgencia es real.
          Los cambios aplican desde el siguiente mensaje, sin publicar código. Solo administradores.
        </p>
      </div>

      {error && (
        <p className="mb-6 rounded-md p-4 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
          Error cargando las reglas: {error.message}
        </p>
      )}

      <section className="mb-10">
        <h2 className={h2} style={{ color: 'var(--text-primary)' }}>Política de reserva</h2>
        <p className={sub} style={{ color: 'var(--text-dim)' }}>Sol la explica cuando el cliente pregunta cómo se aparta o da una señal de compra.</p>
        {politica && <PoliticaForm p={politica} />}
      </section>

      <section className="mb-10">
        <h2 className={h2} style={{ color: 'var(--text-primary)' }}>Rangos de precio de referencia</h2>
        <p className={sub} style={{ color: 'var(--text-dim)' }}>
          Por persona, en acomodación doble, saliendo de Bogotá. Sol los usa como referencia (siempre &quot;sujeto a fecha y
          disponibilidad&quot;) y nunca inventa cifras fuera de aquí ni del catálogo. Se revisan cada 6 meses: guardar un
          rango lo marca como revisado hoy.
        </p>
        <div className="flex flex-col gap-3">
          {rangos.map(r => <RangoForm key={r.id} r={r} opciones={opciones} />)}
          <details className="rounded-lg p-4" style={{ background: 'var(--card-bg)', border: '1px dashed var(--border)' }}>
            <summary className="cursor-pointer font-inter text-sm font-semibold" style={{ color: 'var(--orange)' }}>+ Agregar rango</summary>
            <div className="mt-3"><RangoForm opciones={opciones} /></div>
          </details>
        </div>
      </section>

      <section className="mb-10">
        <h2 className={h2} style={{ color: 'var(--text-primary)' }}>Promociones con fecha límite</h2>
        <p className={sub} style={{ color: 'var(--text-dim)' }}>
          La única urgencia que Sol puede mencionar. Vencida la fecha, Sol deja de usarla sola.
        </p>
        <div className="flex flex-col gap-3">
          {promociones.map(p => <PromocionForm key={p.id} p={p} opciones={opciones} />)}
          <details className="rounded-lg p-4" style={{ background: 'var(--card-bg)', border: '1px dashed var(--border)' }}>
            <summary className="cursor-pointer font-inter text-sm font-semibold" style={{ color: 'var(--orange)' }}>+ Agregar promoción</summary>
            <div className="mt-3"><PromocionForm opciones={opciones} /></div>
          </details>
        </div>
      </section>
    </>
  )
}
