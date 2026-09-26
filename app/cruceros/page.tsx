import type { Metadata } from 'next'
import { Ship } from 'lucide-react'
import { getCategorias, getDestinos } from '@/lib/destinos'
import { arbolCategorias } from '@/lib/categorias'
import { DestinoCard } from '@/components/destinos/DestinoCard'
import { SectionTag } from '@/components/ui/SectionTag'
import { Button } from '@/components/ui/Button'
import { WHATSAPP } from '@/lib/site'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Cruceros',
  description:
    'Cruceros por el Caribe, el Mediterráneo y más, con todo el respaldo de Travel World Colombia. Consulta salidas y tarifas.',
  alternates: { canonical: '/cruceros' },
}

const waCruceros = `https://wa.me/${WHATSAPP.principal}?text=${encodeURIComponent('Hola! Me interesan los cruceros 🚢')}`

export default async function CrucerosPage() {
  const [todos, categorias] = await Promise.all([getDestinos(), getCategorias()])
  const cruceros = todos.filter(d => d.es_crucero)

  // Subgrupos por las subcategorías de la categoría del sistema "Cruceros"
  // (ej. Con visa / Sin visa). Sin subcategorías asignadas: una sola grilla.
  const hijas = arbolCategorias(categorias).find(c => c.clave === 'cruceros')?.hijas ?? []
  const grupos = hijas
    .map(h => ({ titulo: h.nombre, lista: cruceros.filter(d => d.categorias?.includes(h.id)) }))
    .filter(g => g.lista.length > 0)
  const sinSub = cruceros.filter(d => !hijas.some(h => d.categorias?.includes(h.id)))
  if (grupos.length > 0 && sinSub.length > 0) grupos.push({ titulo: 'Otros cruceros', lista: sinSub })

  return (
    <div className="tema-claro">
      {/* Hero */}
      <section className="tema-oscuro relative overflow-hidden px-6 pt-32 pb-16" style={{ background: 'var(--bg)' }}>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 85% 0%, rgba(41, 87, 164,0.4) 0%, transparent 60%)' }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <SectionTag className="mb-4">Navega el mundo</SectionTag>
          <h1
            className="font-plus-jakarta text-4xl font-extrabold leading-tight sm:text-6xl"
            style={{ color: 'var(--text-primary)' }}
          >
            Nuestros
            <br />
            <span style={{ color: 'var(--orange)' }}>cruceros</span>
          </h1>
          <p className="mt-5 max-w-lg font-inter text-sm leading-relaxed sm:text-base" style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
            Vive el mar como nunca. Cruceros todo incluido por el Caribe, el Mediterráneo y más,
            con la asesoría cercana de siempre.
          </p>
        </div>
      </section>

      {/* Lista */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {cruceros.length > 0 && grupos.length > 0 ? (
            <div className="flex flex-col gap-12">
              {grupos.map(g => (
                <section key={g.titulo}>
                  <h2 className="mb-5 font-plus-jakarta text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {g.titulo} <span className="font-inter text-sm font-normal" style={{ color: 'var(--text-dim)' }}>· {g.lista.length}</span>
                  </h2>
                  <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {g.lista.map((d, i) => (
                      <DestinoCard key={d.id} d={d} i={i} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : cruceros.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cruceros.map((d, i) => (
                <DestinoCard key={d.id} d={d} i={i} />
              ))}
            </ul>
          ) : (
            <div
              className="mx-auto flex max-w-xl flex-col items-center rounded-2xl px-6 py-16 text-center"
              style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
            >
              <span
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--orange) 12%, transparent)', color: 'var(--orange)' }}
              >
                <Ship size={26} strokeWidth={1.5} />
              </span>
              <h2 className="mb-2 font-plus-jakarta text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Muy pronto, nuevos cruceros
              </h2>
              <p className="mb-7 font-inter text-base leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                Estamos preparando las mejores rutas. Mientras tanto, escríbenos y te armamos la
                propuesta de crucero ideal para ti.
              </p>
              <Button href={waCruceros} variant="whatsapp" size="md" target="_blank" rel="noopener noreferrer">
                Consultar cruceros
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
