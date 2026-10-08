import { GHL } from '@/lib/agente/config'

/**
 * El equipo de la agencia (usuarios de la subcuenta de GHL), para que Sol sepa
 * quién es quién.
 *
 * Existe por un caso real (06-oct-2026): una clienta abrió con "Juan Camilo
 * buenas tardes" y Sol la llamó Juan Camilo; luego preguntó si él estaba
 * disponible y Sol volvió a preguntarle si ese era su nombre. Muchos clientes
 * saludan a su asesor por el nombre: sin la lista, Sol no distingue "me llamo
 * X" de "busco a X".
 *
 * La lista sale de la API (no se mantiene a mano): una asesora nueva aparece
 * sola. Se cachea en memoria por instancia; un fallo de la API no tumba el
 * turno, Sol sigue sin la lista.
 */

export interface MiembroEquipo {
  id: string
  nombre: string
  /** Se le puede asignar un cliente que pregunta por ella/él. */
  asignable: boolean
}

/**
 * Usuarios que siguen en GHL pero no deben recibir clientes: Sol los reconoce
 * como del equipo (no confunde su nombre con el del cliente), pero la escalada
 * va a la dueña del contacto.
 */
const NO_ASIGNABLES = new Set([
  'hmeFAKEBi0ceNb1QVgFe', // Maria Pilar Copete — salió el 05-oct-2026 (sus leads pasaron a Ginna)
  'GD0MuNI9ecpKYcK28siv', // Mauricio de Marketing — no atiende clientes
])

const TTL_MS = 60 * 60 * 1000
let cache: { hasta: number; equipo: MiembroEquipo[] } | null = null

export async function equipo(): Promise<MiembroEquipo[]> {
  if (cache && cache.hasta > Date.now()) return cache.equipo
  try {
    const t = process.env.GHL_TWC_PIT
    if (!t) throw new Error('Falta GHL_TWC_PIT')
    const res = await fetch(`${GHL.api}/users/?locationId=${GHL.locationId}`, {
      headers: { Authorization: `Bearer ${t}`, Version: GHL.version, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`GHL /users respondió ${res.status}`)
    const r = (await res.json()) as {
      users?: { id: string; name?: string; firstName?: string; lastName?: string; deleted?: boolean }[]
    }
    const lista = (r.users ?? [])
      .filter(u => !u.deleted)
      .map(u => ({
        id: u.id,
        nombre: (u.name?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ').trim()),
        asignable: !NO_ASIGNABLES.has(u.id),
      }))
      .filter(u => u.nombre)
    cache = { hasta: Date.now() + TTL_MS, equipo: lista }
    return lista
  } catch (err) {
    console.error('equipo de GHL no disponible:', (err as Error).message)
    // Último dato bueno si lo hay; si no, Sol trabaja sin la lista.
    return cache?.equipo ?? []
  }
}

/**
 * Línea para la situación del prompt (v1 y v2). Null si no hay lista.
 * En modo respaldo el chat ya lo lleva una asesora y es normal que el cliente
 * la salude por su nombre: ahí solo se evita la confusión, sin escalar por eso.
 */
export function lineaEquipo(miembros: MiembroEquipo[], respaldo = false): string | null {
  if (miembros.length === 0) return null
  const partes = [
    `Personas del equipo de la agencia: ${miembros.map(m => m.nombre).join(', ')}.`,
    'Si el cliente nombra a una de ellas (aunque sea solo el nombre de pila, p. ej. "Juan Camilo buenas tardes" o "¿está Johana?"), le está hablando o preguntando por esa persona: ese NO es el nombre del cliente.',
  ]
  if (!respaldo) {
    partes.push(
      'Si pide a alguien del equipo o le escribe como si ya lo atendiera, usa "escalar" desde ese mismo mensaje (esto manda sobre lo del primer mensaje), pon su nombre en `asesor_pedido` y dile que ya le avisas a esa persona para que le escriba muy pronto, p. ej. "¡Hola! Ya le aviso a Juan Camilo que le escribiste para que te responda muy pronto 😊". NUNCA digas que esa persona no está, no está disponible o ya no atiende, ni hables de horarios. Si aún no sabes cómo se llama el cliente, pregúntaselo en ese mismo mensaje. No le ofrezcas destinos: ya lo atiende alguien.'
    )
  }
  return partes.join(' ')
}

/** Quita tildes y mayúsculas para comparar nombres. */
function normalizar(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-zñ]+/)
    .filter(Boolean)
}

/**
 * Resuelve el nombre que dio Sol a un miembro del equipo. Todas las palabras
 * del nombre pedido deben estar en el nombre completo ("Juan Camilo" →
 * "Juan Camilo Gomez"). Si hay más de un candidato (dos "Cardenas"), se
 * prefiere el que coincide en el nombre de pila; si sigue ambiguo, null: mejor
 * dejarlo a la dueña del contacto que asignar a la persona equivocada.
 */
export function buscarMiembro(miembros: MiembroEquipo[], pedido: string): MiembroEquipo | null {
  const palabras = normalizar(pedido)
  if (palabras.length === 0) return null
  const candidatos = miembros.filter(m => {
    const completo = normalizar(m.nombre)
    return palabras.every(p => completo.includes(p))
  })
  if (candidatos.length === 1) return candidatos[0]
  const porPila = candidatos.filter(m => normalizar(m.nombre)[0] === palabras[0])
  return porPila.length === 1 ? porPila[0] : null
}
