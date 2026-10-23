/**
 * Pruebas directas de la revisión de mensajes (lib/agente/guardas.ts
 * `revisarMensaje`): funciones puras, sin red ni modelo, en segundos.
 * Cada falsa alarma corregida lleva su caso y el caso que debe seguir atrapado.
 *
 * Correr:   npm run test:guardas
 */
import { revisarMensaje } from '@/lib/agente/guardas'

const ahora = new Date('2026-10-22T15:00:00-05:00')
const equipo = ['Juan Camilo Gomez', 'Sofia Solorzano', 'Juanita Sue Cardenas']

type Caso = { nombre: string; mensaje: string; textoCliente?: string; fechas?: string; atrapa: RegExp | null }

const casos: Caso[] = [
  // ── Fechas sin año (21-oct: «En julio» de 2027 marcado como vencido) ──
  {
    nombre: '«en julio» cuando el cliente dijo julio de 2027 → no marca',
    mensaje: 'En julio están en pleno verano europeo: clima cálido y días largos.',
    textoCliente: 'Quiero irme a Europa en julio de 2027 con mi mamá',
    atrapa: null,
  },
  {
    nombre: '«15 de julio» con julio 2027 en las fechas anotadas → no marca',
    mensaje: 'Podemos mirar salida el 15 de julio, ¿te sirve?',
    fechas: 'julio 2027',
    atrapa: null,
  },
  {
    nombre: '«salida el 4 de octubre» sin contexto → sigue marcando',
    mensaje: 'Tenemos salida el 4 de octubre, ¿te animas?',
    atrapa: /fecha que ya paso/,
  },
  {
    nombre: '«en julio» con el cliente hablando de julio de 2026 → sigue marcando',
    mensaje: 'En julio tenemos cupos para San Andrés.',
    textoCliente: 'quería ir en julio de 2026',
    atrapa: /fecha que ya paso/,
  },
  {
    nombre: '«marzo de 2026» (con año vencido) → sigue marcando aunque el cliente diga 2027',
    mensaje: 'El crucero sale en marzo de 2026.',
    textoCliente: 'lo quiero para marzo de 2027',
    atrapa: /fecha que ya paso/,
  },
  // ── Nombres del equipo dentro de lugares (21-oct: «Reina Sofía») ──
  {
    nombre: '«Museo Reina Sofía» → no marca a Sofía',
    mensaje: 'En Madrid son imperdibles el Museo del Prado, el Reina Sofía y el Retiro.',
    atrapa: null,
  },
  {
    nombre: '«San Juan» (Puerto Rico) → no marca a Juan Camilo',
    mensaje: 'Ese crucero sale desde San Juan, Puerto Rico, el 8 de enero de 2027.',
    atrapa: null,
  },
  {
    nombre: '«Sofía te envía la cotización» → sigue marcando',
    mensaje: 'Listo, Sofía te envía la cotización por aquí.',
    atrapa: /nombras a .sofia/,
  },
  {
    nombre: '«Juan Camilo te escribe» → sigue marcando',
    mensaje: 'Perfecto, Juan Camilo te escribe para darte los precios.',
    atrapa: /nombras a .juan/,
  },
]

let fallas = 0
for (const c of casos) {
  const problemas = revisarMensaje(c.mensaje, {
    equipo,
    textoCliente: c.textoCliente,
    previos: c.fechas ? { fechas: c.fechas } : undefined,
    ahora,
  })
  const texto = problemas.join(' | ').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const ok = c.atrapa ? c.atrapa.test(texto) : problemas.length === 0
  if (!ok) fallas++
  console.log(`${ok ? '✓' : '✗'} ${c.nombre}${ok ? '' : `\n    problemas: ${problemas.join(' | ') || '(ninguno)'}`}`)
}
console.log(`\n${casos.length - fallas}/${casos.length} correctos`)
process.exit(fallas ? 1 : 0)
