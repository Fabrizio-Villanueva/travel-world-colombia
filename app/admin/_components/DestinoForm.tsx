'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { ArrowLeft, HelpCircle, ExternalLink, Loader2, ImagePlus } from 'lucide-react'
import type { CategoriaArbol, Destino } from '@/types/destino'
import type { FormState } from '../destinos/actions'
import { RepetidorObjetos } from './RepetidorObjetos'
import { HighlightsEditor } from './HighlightsEditor'
import { ItinerarioEditor } from './ItinerarioEditor'
import { GaleriaEditor } from './GaleriaEditor'
import { ArchivosEditor } from './ArchivosEditor'
import { HospedajeEditor } from './HospedajeEditor'
import { CategoriasSelector } from './CategoriasSelector'
import { BUCKET_DESTINOS, subirAStorage, validarImagen, slugDelFormulario } from '@/lib/supabase/upload-cliente'
import { PAISES, REGIONES } from '@/lib/paises'
import { CLAVES_PRODUCTO_PERSONALIZABLES, MAX_TEXTO, type Textos } from '@/lib/textos'

type Action = (prev: FormState, fd: FormData) => Promise<FormState>

const inputCls = 'w-full rounded-md px-3 py-2.5 font-inter text-base outline-none'
const inputStyle = { background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)' } as const
const labelCls = 'mb-1.5 block font-inter text-sm'
const labelStyle = { color: 'var(--text-dim)' } as const

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <p className="font-cinzel text-[13px] tracking-[0.2em] uppercase" style={{ color: 'var(--orange)' }}>
          {titulo}
        </p>
        {ayuda && (
          <span className="group relative inline-flex items-center">
            <HelpCircle size={13} style={{ color: 'var(--text-muted)', cursor: 'help' }} aria-label={ayuda} />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-5 top-1/2 z-30 hidden w-72 -translate-y-1/2 rounded-md p-3 font-inter text-[13px] normal-case leading-relaxed tracking-normal group-hover:block"
              style={{ background: '#0f1f3d', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
            >
              {ayuda}
            </span>
          </span>
        )}
      </div>
      <div className="rounded-lg p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </div>
    </section>
  )
}

function Campo({
  label, name, defaultValue, value, onChange, onBlur, type = 'text', required, placeholder, hint, full,
}: {
  label: string; name: string; defaultValue?: string | number; type?: string
  value?: string; onChange?: (v: string) => void; onBlur?: () => void
  required?: boolean; placeholder?: string; hint?: string; full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <label className={labelCls} style={labelStyle}>{label}{required && ' *'}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        onBlur={onBlur}
        required={required}
        placeholder={placeholder}
        className={inputCls}
        style={inputStyle}
      />
      {hint && <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

/** "Tolú & Coveñas 2026" → "tolu-covenas-2026" (lo que exige la validación del slug). */
function slugificar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
}

function CampoSelect({
  label, name, defaultValue, required, opciones, hint,
}: {
  label: string; name: string; defaultValue?: string; required?: boolean; opciones: string[]; hint?: string
}) {
  // Si el valor actual no está en la lista, lo agregamos para no perderlo al editar.
  const ops = defaultValue && !opciones.includes(defaultValue) ? [defaultValue, ...opciones] : opciones
  return (
    <div>
      <label className={labelCls} style={labelStyle}>{label}{required && ' *'}</label>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className={inputCls}
        style={inputStyle}
      >
        <option value="" disabled style={{ background: 'var(--bg-alt)' }}>Selecciona…</option>
        {ops.map(o => (
          <option key={o} value={o} style={{ background: 'var(--bg-alt)' }}>{o}</option>
        ))}
      </select>
      {hint && <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function Area({
  label, name, defaultValue, rows = 4, placeholder, hint,
}: {
  label: string; name: string; defaultValue?: string; rows?: number; placeholder?: string; hint?: string
}) {
  return (
    <div className="sm:col-span-2">
      <label className={labelCls} style={labelStyle}>{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        placeholder={placeholder}
        className={inputCls}
        style={inputStyle}
      />
      {hint && <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function ImagenCampo({ label, name, urlActual, reco }: { label: string; name: string; urlActual?: string; reco?: string }) {
  // La imagen se sube directo a Supabase Storage al elegirla (evita los topes
  // de body de Next/Vercel); en el formulario solo viaja la URL resultante.
  const [url, setUrl] = useState(urlActual ?? '')
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problema = validarImagen(file)
    if (problema) return setError(problema)
    setError('')
    const slug = slugDelFormulario('destino')
    start(async () => {
      try {
        setUrl(await subirAStorage(BUCKET_DESTINOS, slug, name, file))
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div>
      <label className={labelCls} style={labelStyle}>{label}</label>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mb-2 h-20 w-full rounded-md object-cover" style={{ border: '1px solid var(--border)' }} />
      )}
      <input type="hidden" name={name} value={url} readOnly />
      <label
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 font-inter text-sm"
        style={{ border: '1px dashed var(--border-orange)', color: 'var(--orange)' }}
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        {pending ? 'Subiendo…' : url ? 'Reemplazar imagen' : 'Elegir imagen'}
        <input type="file" accept="image/*" onChange={onFile} disabled={pending} className="hidden" />
      </label>
      {error && <p className="mt-1 font-inter text-xs" style={{ color: '#fca5a5' }}>{error}</p>}
      {reco && (
        <p className="mt-1 font-inter text-xs" style={{ color: 'var(--orange)' }}>
          Recomendado: {reco}
        </p>
      )}
      <p className="mt-0.5 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        {url ? 'Sube una nueva para reemplazar, o déjala para conservar.' : 'Opcional.'}
      </p>
    </div>
  )
}

/**
 * Bloque plegado "Personalizar textos": los títulos y etiquetas de sección de
 * ESTE viaje. Vacío = usa la plantilla global (lo que se ve como placeholder).
 */
function TextosPropios({ inicial, globales }: { inicial?: Record<string, string>; globales?: Textos }) {
  const secciones = new Map<string, typeof CLAVES_PRODUCTO_PERSONALIZABLES>()
  for (const t of CLAVES_PRODUCTO_PERSONALIZABLES) {
    secciones.set(t.seccion, [...(secciones.get(t.seccion) ?? []), t])
  }
  const cuantos = Object.values(inicial ?? {}).filter(v => v?.trim()).length

  return (
    <details className="sm:col-span-2">
      <summary className="cursor-pointer font-inter text-sm" style={{ color: 'var(--orange)' }}>
        Personalizar títulos de sección de este viaje{cuantos > 0 ? ` (${cuantos} personalizado${cuantos !== 1 ? 's' : ''})` : ''}
      </summary>
      <p className="mt-2 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
        Solo si este viaje necesita un título distinto al del resto. Lo que dejes vacío usa la plantilla
        de <strong>Textos del sitio</strong> (se muestra como ejemplo). El subtítulo y el CTA final se editan
        en sus propios campos más abajo.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {[...secciones.entries()].map(([seccion, campos]) => (
          <div key={seccion} className="rounded-md p-3" style={{ border: '1px solid var(--border)' }}>
            <p className="mb-2 font-inter text-xs font-semibold" style={{ color: 'var(--text-dim)' }}>{seccion}</p>
            <div className="grid gap-3">
              {campos.map(t => (
                <div key={t.clave}>
                  <label className={labelCls} style={labelStyle}>
                    {t.tipo === 'etiqueta' ? 'Etiqueta' : t.tipo === 'titulo' ? 'Título' : 'Subtítulo'}
                  </label>
                  <input
                    name={`textos.${t.clave}`}
                    defaultValue={inicial?.[t.clave] ?? ''}
                    placeholder={globales?.[t.clave] ?? t.original}
                    maxLength={MAX_TEXTO[t.tipo]}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

export function DestinoForm({ action, destino, titulo, categorias, textosGlobales }: {
  action: Action
  destino?: Destino
  titulo: string
  categorias: CategoriaArbol[]
  /** Plantilla global de textos (para mostrar como ejemplo en "Personalizar textos"). */
  textosGlobales?: Textos
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const d = destino

  // Nombre y slug controlados: el slug se genera solo desde el nombre (hasta que
  // el usuario lo toque a mano) y siempre se normaliza a minúsculas-sin-tildes,
  // para que la validación del servidor no lo rechace.
  const [nombre, setNombre] = useState(d?.nombre ?? '')
  const [slug, setSlug] = useState(d?.slug ?? '')
  const [slugManual, setSlugManual] = useState(Boolean(d))

  // Si el servidor devuelve un error, lo llevamos a la vista: el mensaje sale
  // junto al botón Guardar y el usuario puede estar en cualquier parte de la página.
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (state.error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [state])

  return (
    <form
      action={formAction}
      // Enviamos dentro de una transición en vez del action nativo: React 19
      // resetea el formulario tras un action de <form>, y si la validación
      // falla el usuario perdería todo lo escrito.
      onSubmit={e => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        // Guardar con "Activo" desmarcado saca el viaje de la web y su página
        // pasa a dar 404 — ya ocurrió por descuido al editar otros campos, así
        // que pedimos confirmación explícita antes de ocultarlo.
        if (d?.activo && fd.get('activo') !== 'on') {
          const seguro = window.confirm(
            `"${d.nombre}" quedará OCULTO: desaparece de la web y su página dará error 404.\n\n` +
              '¿Seguro que quieres guardarlo como oculto? Si fue sin querer, cancela y marca la casilla "Activo (visible en la web)".'
          )
          if (!seguro) return
        }
        startTransition(() => formAction(fd))
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/viajes" className="flex h-9 w-9 items-center justify-center rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-plus-jakarta text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{titulo}</h1>
        </div>
        {d?.slug && (
          <a
            href={`/destinos/${d.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre la página pública del viaje en una pestaña nueva"
            className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 font-inter text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}
          >
            <ExternalLink size={15} />
            <span className="hidden sm:inline">Ver viaje</span>
          </a>
        )}
      </div>

      <Seccion
        titulo="Imágenes"
        ayuda="Las 3 fotos del destino: el fondo grande del hero, la miniatura de la tarjeta y la imagen de 'sobre el destino'. Se suben a Supabase y aparecen solas en la web. Usa JPG o WebP (evita PNG pesados); cada campo muestra el tamaño recomendado debajo."
      >
        <ImagenCampo
          label="Imagen hero (fondo grande)"
          name="imagen_hero"
          urlActual={d?.imagen_hero}
          reco="horizontal 16:9, 1920×1080 px · JPG o WebP · máx ~500 KB"
        />
        <ImagenCampo
          label="Imagen thumbnail (tarjeta)"
          name="imagen_thumb"
          urlActual={d?.imagen_thumb}
          reco="cuadrada 1:1, 600×600 px · JPG o WebP · máx ~200 KB"
        />
        <ImagenCampo
          label="Imagen 'sobre el destino'"
          name="imagen_about"
          urlActual={d?.imagen_about}
          reco="horizontal 3:2, 1200×800 px · JPG o WebP · máx ~300 KB"
        />
      </Seccion>

      <Seccion
        titulo="Galería"
        ayuda="Fotos adicionales del destino que se muestran en una cuadrícula en su página. Sube varias; cada una se guarda al elegirla."
      >
        <GaleriaEditor name="galeria" inicial={d?.galeria} />
      </Seccion>

      <Seccion
        titulo="Documentos"
        ayuda="PDFs o Word del viaje (itinerario detallado, condiciones, folleto…). Aparecen en la sección 'Documentos del viaje' de la página del producto, solo si subes alguno. Cada archivo se guarda al elegirlo; el título es lo que ve el cliente."
      >
        <ArchivosEditor name="archivos" inicial={d?.archivos} />
      </Seccion>

      <Seccion
        titulo="Hospedaje"
        ayuda="Solo para paquetes que incluyen hospedaje: carga una opción por categoría (2★ hostal, 3★ turista…) con sus hoteles por ciudad, amenidades y tipos de habitación. En la web se ve como una tarjeta grande con pestañas. Si el paquete no incluye hospedaje, deja esto vacío y la sección no aparece."
      >
        <HospedajeEditor name="hospedaje" inicial={d?.hospedaje} />
      </Seccion>

      <Seccion
        titulo="Hero"
        ayuda="Portada del destino: la frase inspiradora que aparece sobre la imagen grande del hero, con su autor opcional. La imagen de fondo se sube en la sección Imágenes."
      >
        <Campo label="Frase del hero" name="frase_hero" defaultValue={d?.frase_hero} full placeholder="El Caribe que siempre soñaste, todo incluido." />
        <Campo label="Autor de la frase" name="autor_frase" defaultValue={d?.autor_frase} />
        <Campo label="Cargo del autor" name="cargo_autor" defaultValue={d?.cargo_autor} />
      </Seccion>

      <Seccion
        titulo="Básico"
        ayuda="Datos principales: nombre, slug (la URL), país (define el filtro de /destinos), precio, duración, cupos y orden. 'Activo' lo muestra en la web; 'Destacado' lo lleva al home."
      >
        <Campo
          label="Nombre"
          name="nombre"
          value={nombre}
          onChange={v => {
            setNombre(v)
            if (!slugManual) setSlug(slugificar(v))
          }}
          required
          placeholder="Punta Cana"
        />
        <Campo
          label="Slug (URL)"
          name="slug"
          value={slug}
          onChange={v => {
            setSlugManual(true)
            setSlug(slugificar(v))
          }}
          onBlur={() => setSlug(s => s.replace(/-+$/, ''))}
          required
          placeholder="punta-cana"
          hint="Se genera solo desde el nombre; puedes ajustarlo. Solo minúsculas, números y guiones."
        />
        <CampoSelect label="País" name="pais" defaultValue={d?.pais} required opciones={PAISES} hint="Define el filtro en /destinos." />
        <div>
          <label className={labelCls} style={labelStyle}>Región / Continente</label>
          {/* Lista cerrada (antes texto libre): un typo como "Suramerica" creaba
              una categoría huérfana que el mapa y las tarjetas no reconocen. */}
          <select name="region" defaultValue={d?.region ?? ''} className={inputCls} style={inputStyle}>
            <option value="" style={{ background: 'var(--bg-alt)' }}>— Sin región (nacional)</option>
            {(d?.region && !REGIONES.includes(d.region) ? [d.region, ...REGIONES] : REGIONES).map(r => (
              <option key={r} value={r} style={{ background: 'var(--bg-alt)' }}>{r}</option>
            ))}
          </select>
          <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>
            En internacionales agrupa por continente y activa su zona en el mapa y las tarjetas de /destinos.
          </p>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Transporte (solo nacional)</label>
          <select name="transporte" defaultValue={d?.transporte ?? ''} className={inputCls} style={inputStyle}>
            <option value="" style={{ background: 'var(--bg-alt)' }}>— No aplica</option>
            <option value="bus" style={{ background: 'var(--bg-alt)' }}>En bus</option>
            <option value="avion" style={{ background: 'var(--bg-alt)' }}>En avión</option>
          </select>
          <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>Agrupa los viajes de Colombia en /destinos.</p>
        </div>
        <Campo
          label="Precio desde (solo el número)"
          name="precio_valor"
          type="number"
          defaultValue={d?.precio_valor ?? undefined}
          placeholder="1290000"
          hint={d?.precio_desde && d?.precio_valor == null ? `Texto actual sin estructurar: "${d.precio_desde}"` : 'Sin puntos ni símbolos: 1290000 (COP) o 1290 (USD).'}
        />
        <div>
          <label className={labelCls} style={labelStyle}>Moneda del precio</label>
          <select name="precio_moneda" defaultValue={d?.precio_moneda ?? ''} className={inputCls} style={inputStyle}>
            <option value="" style={{ background: 'var(--bg-alt)' }}>— Sin precio publicado</option>
            <option value="COP" style={{ background: 'var(--bg-alt)' }}>COP (pesos)</option>
            <option value="USD" style={{ background: 'var(--bg-alt)' }}>USD (dólares)</option>
          </select>
          <p className="mt-1 font-inter text-xs" style={{ color: 'var(--text-muted)' }}>Obligatoria si hay valor. Define cómo se formatea y qué ve Google.</p>
        </div>
        <Campo label="Nota del precio" name="precio_nota" defaultValue={d?.precio_nota ?? undefined} placeholder="Acomodación triple" hint="Opcional: acomodación, temporada, condiciones." />
        <Campo label="Duración" name="duracion" defaultValue={d?.duracion} placeholder="8 días / 7 noches" />
        <Campo label="Cupos disponibles" name="cupos_disponibles" type="number" defaultValue={d?.cupos_disponibles} placeholder="10" />
        <Campo label="Orden" name="orden" type="number" defaultValue={d?.orden ?? 0} hint="Menor = aparece primero." />
        <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          <input type="checkbox" name="activo" defaultChecked={d ? d.activo : true} /> Activo (visible en la web)
        </label>
        <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          <input type="checkbox" name="destacado" defaultChecked={d?.destacado ?? false} /> Destacado / Favorito
        </label>
        <label className="flex items-center gap-2 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
          <input type="checkbox" name="salida_fin_ano" defaultChecked={d?.salida_fin_ano ?? false} /> Salida confirmada fin de año
        </label>
      </Seccion>

      <Seccion
        titulo="Categorías"
        ayuda="Clasifica el viaje: puede tener varias categorías (ej. Cruceros › Sin visa y Todo incluido). Se ven como etiqueta en la tarjeta del viaje y sirven de filtro en /destinos. La categoría Cruceros hace que el viaje salga en la página /cruceros."
      >
        <CategoriasSelector arbol={categorias} iniciales={d?.categorias ?? []} />
      </Seccion>

      <Seccion
        titulo="Contenido"
        ayuda="Subtítulo y descripción larga del destino. Aparecen en la sección 'sobre el destino' de su página."
      >
        <Campo label="Subtítulo" name="subtitulo" defaultValue={d?.subtitulo} full />
        <Area label="Descripción" name="descripcion" defaultValue={d?.descripcion} rows={5} />
      </Seccion>

      <Seccion
        titulo="Qué incluye"
        ayuda="Lo que incluye y lo que NO incluye el paquete, una característica por línea. Se muestran como listas con check (verde) y equis (rojo)."
      >
        <Area label="Incluye (uno por línea)" name="incluye" defaultValue={d?.incluye?.join('\n')} hint="Una característica por línea." />
        <Area label="No incluye (uno por línea)" name="no_incluye" defaultValue={d?.no_incluye?.join('\n')} hint="Una por línea." />
      </Seccion>

      <Seccion
        titulo="Itinerario día a día"
        ayuda="El plan del viaje, un día por fila. El número de día (01, 02…) se asigna solo según el orden. Cada día lleva foto (opcional), título, fecha opcional para salidas fijas (ej. '11 NOV'), etiqueta (ej. 'Cena incluida') y descripción. En la web se ve con la foto a la izquierda y el texto justificado a la derecha."
      >
        <ItinerarioEditor name="itinerario" inicial={d?.itinerario} />
      </Seccion>

      <Seccion
        titulo="Stats (barra de cifras)"
        ayuda="Cifras destacadas del destino que aparecen en una barra (ej. '500+ familias'). Cada fila: número + etiqueta."
      >
        <RepetidorObjetos
          name="stats"
          etiqueta="cifra"
          inicial={d?.stats as unknown as Record<string, string>[] | undefined}
          campos={[
            { key: 'num', label: 'Cifra (ej. 500+)', ancho: 'corto' },
            { key: 'label', label: 'Etiqueta (ej. familias viajaron)' },
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Experiencias únicas"
        ayuda="Tarjetas de experiencias del destino, cada una con un emoji, un título, una descripción y una foto. Se muestran TODAS en 'Experiencias únicas'. Si la actividad es opcional, escribe su valor y saldrá como etiqueta naranja sobre la tarjeta."
      >
        <HighlightsEditor name="highlights" inicial={d?.highlights} />
      </Seccion>

      <Seccion
        titulo="Información clave"
        ayuda="Datos prácticos del viaje (ej. moneda, idioma, mejor época para viajar). Cada fila: icono + etiqueta + valor + un sub-texto opcional. Elige el icono con el selector visual."
      >
        <RepetidorObjetos
          name="info_clave"
          etiqueta="dato"
          inicial={d?.info_clave as unknown as Record<string, string>[] | undefined}
          campos={[
            { key: 'icono', label: 'Icono', tipo: 'icono' },
            { key: 'label', label: 'Etiqueta' },
            { key: 'valor', label: 'Valor' },
            { key: 'sub', label: 'Sub (opcional)' },
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Textos de la página (avanzado)"
        ayuda="Los títulos y etiquetas de cada sección (Qué incluye, Hospedaje, Itinerario…) vienen de la plantilla global en 'Textos del sitio' y son iguales para todos los viajes. Aquí puedes cambiar alguno SOLO para este viaje. Normalmente no hace falta."
      >
        <TextosPropios inicial={d?.textos} globales={textosGlobales} />
      </Seccion>

      <Seccion
        titulo="SEO & CTA"
        ayuda="Llamado a la acción final del destino + datos para buscadores (meta título, meta descripción y keywords). Mejoran el posicionamiento en Google."
      >
        <Campo label="Título del CTA final" name="cta_titulo" defaultValue={d?.cta_titulo} full />
        <Area label="Subtítulo del CTA" name="cta_subtitulo" defaultValue={d?.cta_subtitulo} rows={2} />
        <Campo label="Meta título (SEO)" name="meta_title" defaultValue={d?.meta_title} full />
        <Area label="Meta descripción (SEO)" name="meta_description" defaultValue={d?.meta_description} rows={2} />
        <Area label="Keywords (una por línea)" name="keywords" defaultValue={d?.keywords?.join('\n')} rows={3} />
      </Seccion>

      {state.error && (
        <p ref={errorRef} className="rounded-md p-3 font-inter text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-6 py-2.5 font-plus-jakarta text-sm font-bold"
          style={{ background: 'var(--orange)', color: 'var(--orange-contrast)', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? 'Guardando…' : 'Guardar viaje'}
        </button>
        <Link href="/admin" className="font-inter text-sm" style={{ color: 'var(--text-dim)' }}>Cancelar</Link>
      </div>
    </form>
  )
}
