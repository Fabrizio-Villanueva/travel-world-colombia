'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarActividad } from '@/lib/admin/audit'
import { destinoSchema } from '@/lib/validations/destino'
import { precioTextoPlano } from '@/lib/precio'
import { categoriasValidas } from '@/lib/admin/categorias'
import { CLAVES_PRODUCTO_PERSONALIZABLES } from '@/lib/textos'

export type FormState = { error?: string }

/** Texto multilínea → array de líneas no vacías. */
function lineas(v: FormDataEntryValue | null): string[] {
  return String(v ?? '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

/** Entero o undefined si está vacío / no es número. */
function numEntero(v: FormDataEntryValue | null): number | undefined {
  const s = String(v ?? '').trim()
  if (s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

/** Número (admite decimales) o undefined si está vacío / no es número. */
function numDecimal(v: FormDataEntryValue | null): number | undefined {
  const s = String(v ?? '').trim()
  if (s === '') return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function texto(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? '').trim()
  return s === '' ? undefined : s
}

/**
 * Textos de sección personalizados del viaje: campos `textos.<clave>` del
 * bloque "Personalizar textos". Solo claves conocidas y solo si traen valor;
 * lo vacío usa la plantilla global.
 */
function textosPersonalizados(formData: FormData): Record<string, string> {
  const textos: Record<string, string> = {}
  for (const { clave } of CLAVES_PRODUCTO_PERSONALIZABLES) {
    const v = texto(formData.get(`textos.${clave}`))
    if (v) textos[clave] = v
  }
  return textos
}

/** Parsea un array JSON serializado (repetidores del formulario). */
function jsonArray(v: FormDataEntryValue | null): unknown[] {
  try {
    const p = JSON.parse(String(v ?? '[]'))
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

/**
 * Construye el payload validado a partir del FormData.
 * Las imágenes se suben directo del navegador a Supabase Storage (ver
 * lib/supabase/upload-cliente.ts); aquí solo llegan sus URLs en campos ocultos.
 */
function construirPayload(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()

  const precio_valor = numDecimal(formData.get('precio_valor'))
  const precio_moneda = texto(formData.get('precio_moneda')) as 'COP' | 'USD' | undefined
  const precio_nota = texto(formData.get('precio_nota'))

  const base = {
    nombre: String(formData.get('nombre') ?? '').trim(),
    slug,
    pais: String(formData.get('pais') ?? '').trim(),
    region: texto(formData.get('region')),
    transporte: texto(formData.get('transporte')),
    salida_fin_ano: formData.get('salida_fin_ano') === 'on',
    activo: formData.get('activo') === 'on',
    destacado: formData.get('destacado') === 'on',
    orden: numEntero(formData.get('orden')) ?? 0,
    precio_valor,
    precio_moneda,
    precio_nota,
    // precio_desde ahora es texto derivado del estructurado: lo lee el agente
    // Sol (conocimiento.ts) y es el fallback de la web. Sin valor → null.
    precio_desde: precio_valor != null && precio_moneda
      ? precioTextoPlano(precio_valor, precio_moneda, precio_nota)
      : undefined,
    duracion: texto(formData.get('duracion')),
    cupos_disponibles: numEntero(formData.get('cupos_disponibles')),
    frase_hero: texto(formData.get('frase_hero')),
    autor_frase: texto(formData.get('autor_frase')),
    cargo_autor: texto(formData.get('cargo_autor')),
    subtitulo: texto(formData.get('subtitulo')),
    descripcion: texto(formData.get('descripcion')),
    incluye: lineas(formData.get('incluye')),
    no_incluye: lineas(formData.get('no_incluye')),
    keywords: lineas(formData.get('keywords')),
    stats: jsonArray(formData.get('stats')),
    highlights: jsonArray(formData.get('highlights')),
    info_clave: jsonArray(formData.get('info_clave')),
    itinerario: jsonArray(formData.get('itinerario')),
    archivos: jsonArray(formData.get('archivos')),
    hospedaje: jsonArray(formData.get('hospedaje')),
    galeria: jsonArray(formData.get('galeria')),
    cta_titulo: texto(formData.get('cta_titulo')),
    cta_subtitulo: texto(formData.get('cta_subtitulo')),
    meta_title: texto(formData.get('meta_title')),
    meta_description: texto(formData.get('meta_description')),
    textos: textosPersonalizados(formData),
  }

  const parsed = destinoSchema.safeParse(base)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
  }

  const imagen_hero = texto(formData.get('imagen_hero'))
  const imagen_thumb = texto(formData.get('imagen_thumb'))
  const imagen_about = texto(formData.get('imagen_about'))

  const payload = { ...parsed.data, imagen_hero, imagen_thumb, imagen_about }

  // Postgres necesita null explícito para vaciar una columna: JSON.stringify
  // omite las claves undefined, así que un campo borrado en el formulario
  // nunca llegaría al UPDATE y la web seguiría mostrando el valor viejo.
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, v === undefined ? null : v])
  ) as typeof payload
}

function revalidar(slug?: string) {
  revalidatePath('/')
  revalidatePath('/destinos')
  revalidatePath('/cruceros')
  if (slug) revalidatePath(`/destinos/${slug}`)
  revalidatePath('/admin')
  revalidatePath('/admin/viajes')
  revalidatePath('/sitemap.xml')
}

/** Crea un nuevo destino. */
export async function crearDestino(_prev: FormState, formData: FormData): Promise<FormState> {
  // Si la sesión expiró o el rol no permite editar, mostramos el mensaje en el
  // formulario en vez de dejar que la excepción tumbe la página con un error genérico.
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }
  const admin = createAdminClient()

  let payload
  try {
    // es_crucero no se envía: la base lo deriva de las categorías (Cruceros).
    payload = { ...construirPayload(formData), categorias: await categoriasValidas(formData.getAll('categorias')) }
  } catch (e) {
    return { error: (e as Error).message }
  }

  const { error } = await admin.from('destinos').insert(payload)
  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un viaje con ese slug.' : error.message }
  }

  await registrarActividad({
    email: user.email!,
    accion: 'crear',
    slug: payload.slug,
    nombre: payload.nombre,
  })

  revalidar(payload.slug)
  redirect('/admin/viajes')
}

/** Actualiza un destino existente (id se enlaza con .bind). */
export async function actualizarDestino(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let user
  try {
    ;({ user } = await requireEditor())
  } catch (e) {
    return { error: (e as Error).message }
  }
  const admin = createAdminClient()

  let payload
  try {
    // es_crucero no se envía: la base lo deriva de las categorías (Cruceros).
    payload = { ...construirPayload(formData), categorias: await categoriasValidas(formData.getAll('categorias')) }
  } catch (e) {
    return { error: (e as Error).message }
  }

  const { error } = await admin.from('destinos').update(payload).eq('id', id)
  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un viaje con ese slug.' : error.message }
  }

  await registrarActividad({
    email: user.email!,
    accion: 'actualizar',
    slug: payload.slug,
    nombre: payload.nombre,
  })

  revalidar(payload.slug)
  redirect('/admin/viajes')
}
