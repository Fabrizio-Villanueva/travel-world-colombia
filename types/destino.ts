export interface Stat {
  num: string
  label: string
}

export interface Highlight {
  icono: string
  titulo: string
  descripcion: string
  imagen?: string
  /** Valor de la actividad cuando es opcional (texto libre, ej. "$180.000"). */
  precio?: string
  /** Duración de la actividad (texto libre, ej. "4 horas" o "Día completo"). */
  duracion?: string
}

export interface InfoClave {
  icono: string
  label: string
  valor: string
  sub?: string
}

/** Un día del itinerario. El número de día sale de la posición en el array. */
export interface ItinerarioDia {
  titulo: string
  /** Etiqueta corta opcional, ej. "Cena incluida". */
  badge?: string
  descripcion?: string
  /** Fecha opcional para salidas fijas, ej. "11 NOV". */
  fecha?: string
  /** Foto del día (subida desde el panel a Storage). */
  imagen?: string
}

/** Tipo de habitación dentro de una opción de hospedaje. */
export interface HabitacionHospedaje {
  /** Ej. "Sencilla", "Doble", "Triple", "Niño". */
  tipo: string
  /** Texto libre, ej. "USD $1.440 por persona" (opcional). */
  precio?: string
}

/** Ciudad con sus hoteles dentro de una opción de hospedaje. */
export interface CiudadHospedaje {
  nombre: string
  hoteles: string[]
}

/**
 * Opción/categoría de hospedaje del paquete (una pestaña de la sección
 * "Hospedaje" del producto): ej. "Hostal o similares" 2★, "Hotel turista" 3★.
 * El paquete muestra la sección solo si tiene opciones cargadas.
 */
export interface OpcionHospedaje {
  titulo: string
  /** Categoría 1–5 estrellas (opcional). */
  estrellas?: number
  descripcion?: string
  imagen?: string
  ciudades?: CiudadHospedaje[]
  /** Chips cortos, ej. "Wi-Fi", "Desayuno buffet". */
  amenidades?: string[]
  habitaciones?: HabitacionHospedaje[]
}

/** Documento descargable del viaje (subido desde el panel al bucket `documentos`). */
export interface ArchivoAdjunto {
  /** Nombre visible en la web, ej. "Itinerario detallado". */
  titulo: string
  url: string
  /** 'pdf' se puede ver en el navegador; 'word' solo se descarga. */
  tipo: 'pdf' | 'word'
  /** Peso del archivo, para mostrar "2.3 MB" junto al enlace. */
  bytes?: number
}

export interface Destino {
  id: string
  slug: string
  activo: boolean
  destacado: boolean
  orden: number

  nombre: string
  nombre_local?: string
  pais: string
  region?: string
  /** Solo para nacionales (Colombia): agrupa en "En bus" / "En avión". */
  transporte?: 'bus' | 'avion'
  /** Flag de "Salidas confirmadas fin de año" (chip de filtro en /destinos). */
  salida_fin_ano?: boolean
  /**
   * Es un crucero: se lista en /cruceros y se excluye de /destinos. Lo deriva
   * la base de las categorías (categoría del sistema "Cruceros"); no se edita.
   */
  es_crucero?: boolean
  /** Ids de las categorías del viaje (tabla `categorias`, editable en el panel). */
  categorias?: string[]
  /**
   * Agregados al leer (lib/destinos.ts), no son columnas: etiquetas visibles
   * ("Cruceros · Sin visa") y slugs de todas sus categorías (filtro ?f=cat:).
   */
  etiquetas?: string[]
  categoria_slugs?: string[]
  frase_hero?: string
  autor_frase?: string
  cargo_autor?: string
  imagen_hero?: string
  imagen_thumb?: string

  subtitulo?: string
  descripcion?: string
  imagen_about?: string
  stats?: Stat[]
  highlights?: Highlight[]
  galeria?: string[]
  info_clave?: InfoClave[]
  itinerario?: ItinerarioDia[]
  archivos?: ArchivoAdjunto[]
  hospedaje?: OpcionHospedaje[]

  /** LEGADO: texto libre; derivado del estructurado al guardar desde el panel. */
  precio_desde?: string
  precio_valor?: number | null
  precio_moneda?: 'COP' | 'USD' | null
  precio_nota?: string | null
  incluye?: string[]
  no_incluye?: string[]
  duracion?: string
  cupos_disponibles?: number

  cta_titulo?: string
  cta_subtitulo?: string
  meta_title?: string
  meta_description?: string
  keywords?: string[]
  /**
   * Textos de sección propios de este viaje (clave → valor, mismas claves que
   * la plantilla global de lib/textos.ts). Lo que falte usa la plantilla.
   */
  textos?: Record<string, string>

  created_at: string
  updated_at: string
}

/** Categoría de viajes (dos niveles). `clave` no nula = del sistema (no se borra). */
export interface Categoria {
  id: string
  nombre: string
  slug: string
  parent_id: string | null
  clave: string | null
  orden: number
}

/** Categoría principal con sus subcategorías. */
export interface CategoriaArbol extends Categoria {
  hijas: Categoria[]
}
