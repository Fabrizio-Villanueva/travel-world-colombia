/**
 * Constantes de la subcuenta de GoHighLevel de Travel World Colombia.
 * Mapeadas y verificadas contra la API (ver `docs/ghl-twc-mapa.md`).
 */

export const GHL = {
  api: 'https://services.leadconnectorhq.com',
  version: '2021-07-28',
  locationId: 'RMFUo0i4KOVl7eZHEn7s',
} as const

/**
 * Pipeline comercial "🎯 Leads (venta)" y las etapas que Sol puede tocar.
 * Migración 2026-08-25 (ver `docs/migracion-campos-oportunidad.md`): los leads
 * nuevos nacen aquí. El "✅ PIPELINE PRINCIPAL" viejo se vació y eliminó el
 * 2026-09-29 (su historial cerrado se mudó a este pipeline).
 */
export const PIPELINE = {
  id: 'MLoZOGIYvCBRUgQdYRA8',
  etapas: {
    leadNuevo: '369a3d70-ec39-4a88-9289-5d578fe63180', // 🆕 Lead Nuevo
    /**
     * Creada el 09-oct-2026: Sol terminó sus seguimientos sin calificarlo. Va
     * ANTES de Calificado por Bot; desde aquí Sol (y la reactivación) puede
     * subirlo igual que desde Lead Nuevo. Ver lib/agente/no-calificado.ts.
     */
    noCalificado: '7811ad09-1099-4e3e-a3bd-e45aebcfbf33', // 🧊 No calificado
    calificadoPorBot: '311ed363-2809-4443-8849-73a444bec6df', // 🤖 Calificado por Bot
    asignadoAAgente: '24cc9101-80ec-4478-910e-bf253d0f206d', // 👤 Asignado a Agente
    contactado: 'faa05280-9bb8-477e-9dfb-b8448bdee719', // 📞 Contactado
  },
  /**
   * A partir de aquí manda un humano: si la oportunidad ya está en cotización o
   * más allá, Sol no interviene aunque no tenga `stop_bot`.
   */
  etapasVedadas: [
    'faa05280-9bb8-477e-9dfb-b8448bdee719', // 📞 Contactado
    'f34e7cd3-673f-4405-b608-4a031eac04e8', // 📋 Cotización Enviada
    '202714ba-4a61-457d-b648-f5f7c99dc0ae', // 🔄 En Seguimiento
    '2ff59f80-0b8a-4dde-9419-0f4b97b701f0', // ✅ Ganada
    'c9bb7c35-ee9b-4ae2-97b6-791f526af2d7', // ❌ Perdida / Abandonado
  ],
} as const

/**
 * Pipeline post-venta "🗂️ Reservaciones (operación)": la oportunidad ganada se
 * MUDA aquí (misma tarjeta, nunca una nueva — duplicaría reservas en el TMS).
 * La mudanza la hace /api/agente/reservacion porque la acción nativa de GHL
 * "Create/Update Opportunity" crea duplicados al cruzar pipelines (verificado
 * 2026-08-26 en prueba real).
 */
export const PIPELINE_RESERVACIONES = {
  id: 'Jq7CxjuirY9Gu44el0bs',
  etapas: {
    reservaCreada: 'b2b106ba-7431-4c10-bc4b-ad91365f28fd', // 📋 Reserva Creada
    enPagos: '0583b4e0-d88f-43f4-bf30-f8e311d60cd3', // 💳 En Pagos
    pagadaDocumentada: 'ffc56431-3638-487b-9401-063f2d6b9cd2', // 📁 Pagada y Documentada
  },
  /** Todas las etapas en el orden del tablero: la automatización solo avanza. */
  orden: [
    'b2b106ba-7431-4c10-bc4b-ad91365f28fd', // 📋 Reserva Creada
    '9c94de93-0e54-4925-9901-f6bf8c6f57b6', // 📤 Contrato Enviado
    'ecdf4a60-5ef6-4b21-b61c-0103fec0e146', // ✍️ Contrato Firmado
    '0583b4e0-d88f-43f4-bf30-f8e311d60cd3', // 💳 En Pagos
    'ffc56431-3638-487b-9401-063f2d6b9cd2', // 📁 Pagada y Documentada
    'cdd8d29b-db59-4da2-8e57-6d6f0f0ed7de', // 🧳 Por Viajar
    'd670196a-d1f3-4dd9-89d7-3710aa3a91cf', // 🛫 En Viaje
    'b84cd8aa-975b-4f49-970d-cdcb5907cfab', // ✈️ Completada
    'bce3ac20-4888-475f-96ef-4e5323d7d4d2', // 🌟 Solicitar Review
    '76d49ba3-c574-478c-8b02-21bab764b557', // ⛔ Cancelada
  ],
} as const

/** Etapa "✅ Ganada" del pipeline de Leads: desde aquí se muda a Reservaciones. */
export const ETAPA_GANADA = '2ff59f80-0b8a-4dde-9419-0f4b97b701f0'

/**
 * Campos de la migración a oportunidad que el código toca directamente
 * (catálogo completo en scripts/ghl-campos-oportunidad.catalog.json).
 */
export const CAMPOS_RESERVA = {
  /** opportunity.fecha_confirmada_de_salida (DATE) */
  oppFechaSalida: 'jo2GTriNmRltzHrzaAW9',
} as const

/**
 * Pipelines 100% humanos: "🗂️ Reservaciones (operación)", que cubre toda la
 * post-venta hasta el regreso del viaje ("🛫 Clientes Viajando" se migró aquí y
 * se eliminó el 2026-09-30).
 */
export const PIPELINES_POSTVENTA = [PIPELINE_RESERVACIONES.id] as const

/**
 * Calificación que Sol escribe, en la OPORTUNIDAD de Leads (carpeta
 * "⭐ Calificación (Sol)"): regla "contacto = la persona, oportunidad = el
 * viaje" — un cliente que vuelve a cotizar no pisa la calificación del viaje
 * anterior. Destino, presupuesto y habitaciones reusan campos que ya existían
 * (los imprime el contrato). Hasta 2026-10-02 Sol escribía también los campos
 * viejos del contacto (carpeta "Calificación", hoy en cuarentena).
 */
export const CAMPOS_CALIFICACION_OPP = {
  destino: '9x1Ui70nMDNBivYkPn8A', // opportunity.destino_de_inters (TEXT)
  fechas: 'bIWAbcbJpqlwI25CuR14', // opportunity.fechas_tentativas_de_viaje (TEXT)
  ciudadSalida: '4ms8gl4tchRFinJfyHb2', // opportunity.ciudad_de_salida (TEXT)
  adultos: 'ywJznpjVhUUHuSOoOTdv', // opportunity.cantidad_de_adultos (NUMERICAL)
  ninos: 'oGeYbm0vGHlrgTSdcetU', // opportunity.cantidad_de_ninos (NUMERICAL)
  edadesNinos: 'Q3DkI8jEAjmrWcc6qnlE', // opportunity.edades_de_los_ninos (TEXT)
  presupuesto: 'i4k1Y68Ta6BXlmnalXwG', // opportunity.presupuesto_estimado (TEXT)
  duracion: 'qK7CxgOeehU1DrcY6P2D', // opportunity.duracion_del_viaje (TEXT)
  habitaciones: 'VVO9E00TX4QbWj4oB43e', // opportunity.cantidad_de_habitaciones (TEXT)
  nivelUrgencia: 'wcg7cuuyjYkGsCKgjjFs', // opportunity.nivel_de_urgencia (TEXT)
  viajePersonalizado: 'LX3zNlP7xnkDderdvK4U', // opportunity.viaje_personalizado (Sí/No)
  fuenteLead: 'YYZ5nzaNLlceZJnkV8Ar', // opportunity.fuente_del_lead (TEXT)
  mensajeCotizacion: 'ZShI58MDGvpT3bh1mLLv', // opportunity.mensaje_de_cotizacion (LARGE_TEXT)
} as const

/**
 * Seguimiento y método de venta de Sol, en la OPORTUNIDAD (carpeta "⭐
 * Calificación (Sol)"). Creados el 05-oct-2026 con scripts/ghl-campos-sol-v2.mjs;
 * reemplazan a los sol_* del contacto (se copiaron con
 * scripts/ghl-migrar-sol-contacto-a-opp.mjs). sol_idioma se queda en el contacto.
 */
export const CAMPOS_SOL_OPP = {
  estadoComercial: 'n6qtOOZVHPfrRkMnvJ2m', // SINGLE_OPTIONS
  temperatura: 'AIB6Wb4WlkOH8p8MY8g9', // SINGLE_OPTIONS caliente/tibio/frio/no_interesado
  resumen: 'oLiwj36D1LoF7yxAJzWk', // LARGE_TEXT
  objecionPrincipal: 'mEhRXTkqkMBMR2pxfU4y', // SINGLE_OPTIONS
  detalleObjecion: 'Ep3LHWeDeit0RnJUAW4e', // LARGE_TEXT
  confianza: 'rD4JhweXYoo6NF9BlKaO', // SINGLE_OPTIONS alta/media/baja
  canal: 'ASSlqf7RhIMH0lUSZPFi', // SINGLE_OPTIONS whatsapp/instagram/facebook/widget
  ultimaInteraccion: 'VUOzlXgNaeLwF1vcpvyJ', // DATE (YYYY-MM-DD)
  proximoSeguimiento: '7pcMC3q1VTd2YvhllaZ8', // DATE
  intentosSeguimiento: 'j8YfrVRV0M4CU4zAfCKR', // NUMERICAL
  motivoCierre: 'O8XevcDBHvvHkTEzsTIb', // TEXT
  senalCompra: 'esJNNQhcUtAqAcilZy2X', // TEXT
  respuestaCompromiso: 'vyUKD3zDmH2cWxXuz9E6', // SINGLE_OPTIONS si/todavia_no/no/no_preguntada
  quienDecide: 'mupcqLvRQHgnRHDSvQhx', // TEXT
  rangoDado: 'mnMwLVipy5Bjda5nGtoV', // TEXT
  canalCierre: 'QF9aLomFAFT75XqygQrQ', // SINGLE_OPTIONS whatsapp/llamada/oficina
  borradorCotizacion: 'lFDAzxNFOpQIJDrjVlOl', // LARGE_TEXT
  /** Ya existía en 🗺️ Generales del Viaje. */
  motivoViaje: 'aVw68I4wtOqlp9ljlLOL', // TEXT
} as const

/** sol_idioma: es de la persona, se queda en el CONTACTO (decidido 05-oct-2026). */
export const CAMPO_SOL_IDIOMA = '6HTkEjejzS5pYuFseaz4'

/**
 * "IA - NOMBRE" (folder IA `a3uTifBfuZDOYpqDRYzj`): el nombre REAL que el cliente
 * dice ser (el de WhatsApp no siempre lo es). Sol lo pregunta una vez y lo
 * escribe aquí; un workflow de la cuenta copia este campo al "Nombre" principal.
 */
export const CAMPO_IA_NOMBRE = 'ZJgh8LCTvQz6VIne19uz' // contact.ia__nombre (TEXT)

/**
 * Tags existentes en la cuenta que Sol respeta o usa. Se reusan a propósito
 * (no se inventan nuevos) para no romper los workflows que ya funcionan.
 */
export const TAGS = {
  /** Apaga el bot para ese contacto. Lo pone una asesora o el propio Sol. */
  stopBot: 'stop_bot',
  /** Escalada: dispara la notificación al equipo. */
  transferenciaHumano: 'transferencia a humano',
  /** No son clientes: Sol no interviene. Espeja la exclusión del workflow "Sol Webhook". */
  // Equipo interno (10-oct): "administrador" = supervisoras (Lynda) y "equipo" = asesoras;
  // reemplazan a "mayorista / operadores" en los contactos del equipo. Sol nunca les contesta.
  noCliente: ['proveedor', 'mayorista / operadores', 'zolutium-ai', '[device] - mayorista b2b', 'administrador', 'equipo'],
  /** Ya se le envió el aviso de tratamiento de datos: no repetirlo. */
  avisoDatos: 'sol_aviso_datos',
  /**
   * Lead listo para cotizar. Handoff silencioso: Sol lo pone al calificar, sigue
   * en espera caliente, y un workflow de GHL (que NO debe mensajear al cliente)
   * notifica al asignado. Se pone una sola vez por contacto.
   */
  calificado: 'sol_calificado',
  /**
   * NUEVO (creado por Sol): lo pone el vigilante cuando un lead lleva más del SLA
   * sin que NADIE (ni Sol ni un humano) responda, y solo dentro del horario de
   * atención. Un workflow de GHL escucha este tag y notifica al usuario asignado.
   * El propio vigilante lo quita cuando detecta que ya respondieron (re-arma).
   */
  sinRespuesta: 'lead_sin_respuesta',
  /**
   * NUEVO (creado por Sol): Sol está CUBRIENDO a la asesora en un chat con
   * `stop_bot` porque el cliente escribió y nadie le contestó a tiempo (ver
   * `RESPALDO`). Lo pone Sol al enviar su primera respuesta de respaldo y lo
   * quita en cuanto la asesora vuelve a escribir. Las asesoras lo ven en GHL.
   */
  respaldo: 'sol_respaldo',
  /**
   * Heredado: lo ponía un workflow viejo (en borrador desde ~08-ago-2026). Se
   * quitó de toda la cuenta el 05-oct-2026; `avanzarEtapas` lo retira si
   * reaparece en un lead que la asesora ya contactó.
   */
  nuevoLead: 'new_lead',
  /**
   * NUEVO (lo pone el código): el cliente pidió no recibir más novedades
   * (respondió SALIR o "no me escriban" — ver `esBaja` en
   * lib/agente/reactivacion/reglas.ts). Desde ahí nadie le escribe por
   * iniciativa propia: ni la reactivación, ni los seguimientos, ni Sol vende en
   * ese chat. Si vuelve a escribir, lo atiende una persona (el vigilante avisa
   * por SLA). Quitarlo es decisión de una asesora, a mano.
   */
  noContactar: 'no_contactar',
  /**
   * NUEVO (lo pone el código): Sol calificó o escaló el lead y pasaron 60 min
   * hábiles sin ningún mensaje de una persona del equipo (ver `SLA_HUMANO`).
   * Se quita solo cuando alguien del equipo escribe. Sirve para filtrar en GHL
   * "quién está esperando" y para colgarle un workflow que notifique al
   * usuario asignado (igual que `lead_sin_respuesta`).
   */
  slaHumano: 'sla_sin_respuesta_humana',
  /**
   * NUEVOS (los pone el código al mover la tarjeta a 🧊 No calificado): Sol
   * agotó sus seguimientos sin calificarlo. `rescate` = el cliente conversó y
   * se enfrió; `silencioso` = nunca contestó al primer mensaje de Sol. Mismo
   * criterio que los segmentos de la reactivación. Se quedan aunque el lead
   * vuelva y califique: marcan de dónde vino.
   */
  noCalificadoRescate: 'no_calificado_rescate',
  noCalificadoSilencioso: 'no_calificado_silencioso',
  /**
   * Los pone la integración de WhatsApp cuando el chat nace de un anuncio de
   * Meta (clic a WhatsApp desde Facebook o Instagram). Fuente del lead cuando
   * no quedó la etiqueta del anuncio en `agente_conversacion_anuncio`.
   */
  anuncioMeta: ['fb-ad-lead-whatsapp', 'instagram-ad-lead-whatsapp'],
} as const

/**
 * SLA de respuesta HUMANA a los leads que Sol pasa al equipo (calificados con
 * `sol_calificado` o escalados con `transferencia a humano`). Ver
 * lib/agente/sla-humano.ts; lo corre el cron del vigilante.
 *
 * Por qué existe (auditoría del 09-oct-2026): Sol responde en 18 s, pero el
 * primer mensaje de una asesora a un lead calificado tardaba una mediana de
 * 21 h y el 23 % nunca recibía uno. El vigilante no lo veía: Sol sigue en
 * "espera caliente" contestando, así que para él el chat estaba respondido.
 *
 *  - `activo`: `AGENTE_SLA_HUMANO=off` en Vercel lo apaga (los traspasos se
 *    siguen registrando, así al encenderlo no arranca en blanco).
 *  - `minAsesora`: minutos HÁBILES (ver `minutosHabilesEntre`) hasta el primer
 *    aviso: a la asesora asignada + nota en el contacto + tag `slaHumano`.
 *  - `minSupervision`: minutos hábiles hasta el segundo aviso, a `ALERTAS_INTERNAS`.
 *  - `ventanaDias`: un traspaso más viejo que esto se da por vencido sin avisar
 *    más (evita una avalancha de avisos viejos tras una caída del cron).
 *  - `maxAvisosPorCorrida`: tope de WhatsApps internos por corrida (cada 10 min).
 */
export const SLA_HUMANO = {
  activo: process.env.AGENTE_SLA_HUMANO !== 'off',
  minAsesora: 60,
  minSupervision: 180,
  ventanaDias: 5,
  maxAvisosPorCorrida: 10,
} as const

/**
 * WhatsApp interno de cada asesora: usuario de GHL → su contacto en GHL (al que
 * se le escribe por la misma ruta que `ALERTAS_INTERNAS`). Solo funciona si ese
 * contacto ya le escribió alguna vez a la línea (el canal custom necesita un
 * entrante previo). Una asesora que no esté aquí no recibe el aviso directo:
 * va a `ALERTAS_INTERNAS` diciendo de quién es el lead. Agregar a las demás
 * cuando se tenga su contacto (no inventar ids).
 */
export const CONTACTO_INTERNO_DE_ASESORA: Readonly<Record<string, string>> = {
  '2fa0Pph0vWepKKCNmju8': 'J2zSGMpjGr865pH1Qx95', // Ginna Cardenas
  'gtBMafW2RLtgisOI1iuN': '6FpczLZAbqLDC0qvwc7E', // Lynda Quintero (+57 315 595 6783; tag administrador: Sol no le responde)
  // 10-oct: teléfonos de Configuración → Usuarios, cruzados con su contacto de WhatsApp en GHL.
  'gfnLjWvx4P1cBqKTE3sr': 'DUVlAtfz6QYkf9eRDx1C', // Adriana Gomez
  'TUADpssNhFeR5ZKoFQeE': 'zgflFnJFQCDvYTFGGZ0N', // Alejandra Mayorga
  'DEOpN0jovQXAXy49fo9D': 'Dpby2l4v7VZBpk53HsVS', // Johana Lozano
  'LCUXUU3Ai3hyU2oPtkso': 'Yo0UDSlBsxSq95YFsXkZ', // Juan Camilo Gomez
  'GXv9erHPii1ZKzwfbLhD': 'uUZDsfNxayZbfG6MImkS', // Juanita Sue Cardenas
  'YufMwsZbiQHyk4qiI3w5': '6GDbr6vBmkznPKjIRZZl', // Luisa Aguirre
}

/**
 * Mantenimiento de las oportunidades que corre con el cron de etapas:
 *  - `fuente`: escribe la fuente REAL del lead (anuncio, Instagram, WhatsApp
 *    directo…) en el `source` nativo, que el workflow E-01 deja en "lead" y
 *    vuelve inútil el reporte de fuentes. `AGENTE_FUENTE=off` lo apaga.
 *  - `fuenteDias`: solo oportunidades creadas en estos últimos días (las nuevas
 *    se corrigen en ≤ 10 min; para el histórico, `?fuenteDias=365` a mano).
 *  - `valor`: copia "Total Pasajeros - Valor Total" al valor de la tarjeta en
 *    las ventas que no pasaron por el Generador. `AGENTE_VALOR_VENTA=off` lo apaga.
 */
export const MANTENIMIENTO_OPP = {
  fuente: process.env.AGENTE_FUENTE !== 'off',
  fuenteDias: 30,
  maxFuentesPorCorrida: 60,
  valor: process.env.AGENTE_VALOR_VENTA !== 'off',
  maxValoresPorCorrida: 60,
} as const

/**
 * Reactivación de leads no calificados por WhatsApp, con prueba A/B
 * (IA de Sol vs. plantilla fija). Ver lib/agente/reactivacion/.
 *
 * El código decide QUIÉN y CUÁNDO (elegibilidad, cupo, horario legal) y la
 * lista corta de productos; la variante solo decide CÓMO se dice.
 *
 *  - `activo`: interruptor general. En false la ruta solo acepta `?dry=1`
 *    (genera y registra como dry_run, sin enviar nada). Encender = cambiar a
 *    true y publicar (decisión del dueño, después de revisar un dry-run).
 *  - `loteDiario`: envíos por corrida (el cron corre una vez al día, L-S),
 *    repartidos 50/50 entre variantes para que la comparación sea pareja.
 *  - `promoDelMes`: texto de una promoción REAL vigente que la variante IA
 *    puede mencionar (null = ninguna; entonces no se habla de descuentos).
 */
export const REACTIVACION = {
  /** Encendido el 09-oct-2026 tras aprobar el primer lote (20 mensajes revisados uno a uno). */
  activo: true,
  loteDiario: 20,
  /**
   * Un cliente por corrida y al menos este tiempo entre envíos (pedido del
   * dueño, 09-oct): el cron corre cada minuto de 10:00 a 10:39 y cada pasada
   * atiende a uno solo, así el lote sale espaciado y no como ráfaga.
   */
  porCorrida: 1,
  espaciadoSegundos: 55,
  promoDelMes: null as string | null,
  /** Días mínimos desde el último mensaje de Sol sin respuesta. */
  diasSinRespuesta: 3,
  /** No se vuelve a escribir a un contacto reactivado (o evaluado por la IA) en este plazo. */
  diasEntreReactivaciones: 30,
  /** Leads más viejos que esto (última actividad de Sol) ya no se persiguen. */
  ventanaDias: 90,
  /** Tags que excluyen además de stop_bot, sol_calificado, escalada, no_contactar y no-clientes. */
  tagsExcluidos: ['invalid whatsapp number', 'contact is not registered'],
  /** Línea legal que el código agrega SIEMPRE al final del texto (no la escribe la IA). */
  lineaBaja: 'Si prefieres no recibir más novedades, responde SALIR.',
  /** Respuesta única a quien pide la baja. Texto fijo (no lo redacta el modelo). */
  confirmacionBaja: 'Listo, no te enviaremos más novedades. Si algún día quieres planear un viaje, aquí estamos 🙌',
} as const

/**
 * Avisos internos al equipo (salud del catálogo, "listo para reservar" sin
 * respuesta…). Se mandan por WhatsApp a estos contactos de GHL por la misma
 * ruta que Sol (el proveedor del último mensaje entrante). Todos tienen un tag
 * de no-cliente ("mayorista / operadores" o "administrador"), así que Sol nunca
 * les contesta. Decidido 05-oct-2026; Lynda (supervisora) desde el 10-oct.
 */
export const ALERTAS_INTERNAS = [
  { nombre: 'Fabrizio Villanueva', contactId: 'uw120Td4Hyo4an1K4S0L' },
  { nombre: 'Ginna Cardenas', contactId: 'J2zSGMpjGr865pH1Qx95' },
  { nombre: 'Lynda Quintero', contactId: '6FpczLZAbqLDC0qvwc7E' }, // supervisora (tag administrador), 10-oct
] as const

/**
 * "Sol de respaldo": ningún cliente se queda sin respuesta aunque su asesora
 * esté ocupada o fuera de horario. En un chat con `stop_bot` (lo lleva una
 * asesora), si el último mensaje del cliente lleva más de estos minutos sin
 * respuesta, el vigilante hace que Sol lo cubra; desde ahí Sol contesta al
 * instante hasta que la asesora vuelva a escribir.
 *
 *  - `minEnHorario`: el mensaje llegó en horario y seguimos en horario
 *    (antes de esto, a los 60 min, el vigilante ya le avisó a la asesora).
 *  - `minFueraHorario`: cualquier otro caso (noche, domingo, festivo…).
 *
 * `AGENTE_RESPALDO=off` en Vercel lo apaga sin tocar el resto de Sol.
 */
export const RESPALDO = {
  activo: process.env.AGENTE_RESPALDO !== 'off',
  minEnHorario: 120,
  minFueraHorario: 15,
} as const

/**
 * Pausa temporal de Sol (prueba del 09-oct-2026: Ginna atiende como Sol
 * debería trabajar y Sol solo observa). Mientras dure:
 *  - Sol no contesta (ni turno normal, ni respaldo, ni seguimientos);
 *  - todo cliente que escriba y no tenga dueño se asigna a `asignarA`
 *    (contacto + tarjeta abierta de Leads) y queda con stop_bot, para que al
 *    terminar la pausa Sol no se meta en un chat que ya lleva una persona;
 *  - el webhook sigue registrando todo, así queda el rastro para el resumen.
 * Se apaga sola al pasar `hasta`. `AGENTE_PAUSA_HASTA` en Vercel la cambia sin
 * tocar código (fecha ISO; vacío o pasada = sin pausa).
 */
export const PAUSA = {
  hasta: new Date(process.env.AGENTE_PAUSA_HASTA || '2026-10-09T22:00:00Z'), // 5:00 p. m. Bogotá
  asignarA: process.env.AGENTE_PAUSA_ASIGNAR_A || '2fa0Pph0vWepKKCNmju8', // Ginna Cardenas
} as const

export function solEnPausa(ahora = new Date()): boolean {
  return ahora.getTime() < PAUSA.hasta.getTime()
}

/**
 * Aviso de tratamiento de datos (Ley 1581 de 2012): consentimiento informado +
 * enlace a la política. Se envía UNA sola vez por contacto, como mensaje aparte,
 * antes de la primera respuesta real de Sol. Es texto LEGAL: va literal, nunca
 * lo redacta el modelo (que podría reformularlo o soltar el enlace). Para
 * cambiarlo, edítalo aquí.
 */
export const AVISO_DATOS =
  '¡Hola! Soy Sol, de Travel World Colombia 🌍\n\n' +
  'Con gusto te ayudo a planear tu viaje. Para cuidar tus datos: al continuar ' +
  'por este chat aceptas nuestros términos y el tratamiento de tu información ' +
  'según nuestra política 👉 https://bit.ly/4tGfmuG'

/**
 * Momento a partir del cual Sol atiende conversaciones. Decisión del cliente:
 * SOLO conversaciones nuevas — nada de contestar mensajes viejos ni de
 * perseguir el histórico al encender.
 *
 * Se compara contra la fecha del mensaje entrante, no contra la del contacto:
 * un cliente antiguo que escribe hoy sí es una conversación viva.
 */
export const ACTIVO_DESDE = new Date(
  process.env.AGENTE_ACTIVO_DESDE ?? '2099-01-01T00:00:00Z'
)

/**
 * Modo prueba: Sol solo conversa con contactos que tengan este tag. Para ABRIR a
 * todos los leads, pon `AGENTE_TAG_PRUEBAS` a un sentinel de "sin compuerta":
 * vacío, `all`, `*`, `todos`… e incluso `""`/`''` (el error típico al querer
 * vaciarlo en la UI de Vercel, que lo guarda como comillas literales).
 * Cualquier otro valor se trata como el tag real de la compuerta de prueba.
 */
const rawTagPruebas = (process.env.AGENTE_TAG_PRUEBAS ?? 'pruebas_fabrizio').trim()
const SIN_COMPUERTA = new Set(['', '""', "''", 'all', '*', 'todos', 'none', 'off'])
export const TAG_PRUEBAS = SIN_COMPUERTA.has(rawTagPruebas.toLowerCase()) ? '' : rawTagPruebas

/**
 * Ventana para agrupar ráfagas de mensajes, en milisegundos.
 *
 * En WhatsApp la gente escribe en pedazos ("hola" … "quiero ir a Perú"), y
 * responder a cada pedazo es a la vez caro y peor: el primer mensaje se
 * contesta sin saber lo que viene. Sol espera este tiempo y, si llega otro
 * mensaje, cede el turno al más reciente (ventana DESLIZANTE: el reloj se
 * reinicia con cada mensaje nuevo).
 *
 * 10 s por decisión del usuario. Medido sobre 698 mensajes reales de la
 * cuenta: la pausa mediana entre mensajes seguidos es de 10,9 s, así que esta
 * ventana atrapa cerca de la mitad de las ráfagas de forma directa y bastantes
 * más al deslizarse. Poner 0 desactiva el agrupamiento.
 *
 * Restaurada a 10 s en la auditoría de seguridad (2026-09-02): estuvo en 0
 * de forma temporal desde el 2026-08-06 y cada mensaje suelto costaba una
 * llamada al modelo. `AGENTE_RAFAGA_MS` en Vercel manda sobre el default.
 */
export const RAFAGA_MS = Number(process.env.AGENTE_RAFAGA_MS ?? 10_000)

/**
 * Tope de seguimientos sin respuesta (§5 del diseño: decaimiento y corte).
 * Al agotarlos el contacto pasa a `dormido` y Sol no vuelve a escribirle por
 * iniciativa propia — si el cliente escribe, la conversación revive sola.
 */
export const MAX_INTENTOS_SEGUIMIENTO = 3

/**
 * Sol v2: el seguimiento lo agenda el CÓDIGO, no la IA (en v2 el modelo casi
 * nunca lo programaba en su último turno: 14 de 17 leads quedaban sin
 * seguimiento). Días hábiles desde el envío anterior, índice = intentos ya
 * hechos: al día siguiente, al 3.º y al 7.º día desde que dejó de contestar.
 * El intento 3 es una despedida fija con la ficha del producto (sin IA).
 */
export const DIAS_SEGUIMIENTO_V2 = [1, 2, 4] as const

/** Horario de atención de la agencia (America/Bogota), para fijar expectativas. */
export const HORARIO = {
  zona: 'America/Bogota',
  semana: { desde: 9, hasta: 17 }, // L-V 9:00-17:00
  sabado: { desde: 9, hasta: 13 }, // Sáb 9:00-13:00
  domingoCerrado: true,
} as const
