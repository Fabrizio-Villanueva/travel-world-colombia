#!/usr/bin/env node
/**
 * Completa las opciones de los campos de oportunidad "Inclusiones" y
 * "No incluye" (carpeta Inclusiones) con lo que pidió el cliente el
 * 08-oct-2026: se conservan las opciones que ya existían y se agregan al
 * final las que faltaban. Deja el catálogo local al día.
 *
 *   node scripts/ghl-opciones-inclusiones.mjs            # dry-run
 *   node scripts/ghl-opciones-inclusiones.mjs --execute  # aplica en GHL
 *
 * Las opciones anteriores quedan en el historial de git del catálogo
 * (scripts/ghl-campos-oportunidad.catalog.json) para poder revertir.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const execute = process.argv.includes('--execute')
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGO = resolve(raiz, 'scripts/ghl-campos-oportunidad.catalog.json')
const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'

const env = Object.fromEntries(
  readFileSync(resolve(raiz, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)
const PIT = env.GHL_TWC_PIT
if (!PIT) throw new Error('Falta GHL_TWC_PIT en .env.local')

// Opciones que ya existían en GHL (08-oct-2026). Se conservan tal cual, con sus
// textos originales, para que las oportunidades viejas sigan coincidiendo.
const INCLUSIONES_ORIGINALES = [
  '✈️ Tiquetes aéreos ida y regreso', // antes '✈️ boleto aéreo' (vocabulario colombiano, Ginna 08-oct)
  '💺asignación de sillas de manera aleatoria por la aerolínea',
  '💺asignación de sillas preferida para cada pasajero',
  '💺asignación de sillas preferida',
  // '🎒  Un Articulo perssonal que no exeda las medidas 35 x 45 x 20' → ELIMINADO 08-oct
  //   por pedido del cliente (duplicado del artículo personal 10 kg, abajo).
  '🧳 Equipaje de mano con ruedas que no exceda las medidas 45 x 35 x 25 cm',
  '🧳  Maleta para enviar por Bodega de 23 Kg. que lo exceda 158 cm lineales.',
  '🚑 Seguro de asistencia en médica en viajes',
  '🚑 Seguro de cancelación de viaje',
  '📄Impuestos y tasas.',
]

// Lo que faltaba de la lista del cliente (solo se agrega, no se quita nada).
const INCLUSIONES_NUEVAS = [
  '🎒 Artículo personal 10 kg con medidas que no excedan los 45 x 25 x 35 centímetros',
  '🚙 Traslado Aeropuerto – Hotel – Aeropuerto',
  '🚐 Traslados entre hoteles',
  '🏨 Alojamiento en el hotel seleccionado en las fechas previstas',
  '🍛 Alimentación: Desayunos de acuerdo a las noches tomadas',
  '🍛 Alimentación: Desayunos y cenas de acuerdo a las noches tomadas',
  '🍛 Alimentación: Desayunos, almuerzos y cenas de acuerdo a las noches tomadas',
  '🍕🍨🍹 Snacks, bebidas y licores ilimitados en horarios establecidos por el hotel',
  // 09-oct: pedido del cliente.
  '🚌 Traslado en bus durante todo el recorrido',
  '🧑‍✈️ Coordinador de viaje',
]

const NO_INCLUYE_ORIGINALES = [
  '💺asignación de sillas preferida para cada pasajero',
  '🧳 Equipaje de mano con ruedas que no exceda las medidas 45 x 35 x 25 cm',
  '🧳  Maleta para enviar por Bodega de 23 Kg. que lo exceda 158 cm lineales.',
  '🚑 Seguro de asistencia en médica en viajes',
  '🚑 Seguro de cancelación de viaje',
]

const NO_INCLUYE_NUEVAS = [
  '🧳 Equipaje de mano que excede las medidas 45 x 35 x 25 cm',
  '🙋🏻 Servicios de índole personal: propinas de guías, conductores, lavandería, spa, peluquería, llamadas telefónicas, fotografías, internet, manejo de equipaje, excesos de equipaje',
  '✖️ Gastos no especificados: ningún servicio que NO esté claramente especificado como incluido en el programa del cliente',
  '🏝️ Tarjeta de entrada a la isla',
  '🚌 Excursiones o visitas definidas como opcionales o que no se hayan especificado como incluidas',
]

const INCLUSIONES = [...INCLUSIONES_ORIGINALES, ...INCLUSIONES_NUEVAS]
const NO_INCLUYE = [...NO_INCLUYE_ORIGINALES, ...NO_INCLUYE_NUEVAS]

const CAMBIOS = [
  { name: 'Inclusiones', options: INCLUSIONES },
  { name: 'No incluye', options: NO_INCLUYE },
]

async function ghl(method, path, body) {
  const r = await fetch(`https://services.leadconnectorhq.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${texto.slice(0, 300)}`)
  return texto ? JSON.parse(texto) : {}
}

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const opp = customFields.filter(f => f.model === 'opportunity')
// Las carpetas no vienen en customFields: se identifica por el id de la carpeta Inclusiones.
const CARPETA_INCLUSIONES = 'etzaPtC7VEJMEjTo6gew'

for (const { name, options } of CAMBIOS) {
  const candidatos = opp.filter(f => f.name.trim() === name && f.parentId === CARPETA_INCLUSIONES)
  if (candidatos.length !== 1) throw new Error(`Se esperaba 1 campo "${name}" en la carpeta Inclusiones, hay ${candidatos.length}`)
  const campo = candidatos[0]
  const actuales = campo.picklistOptions ?? []
  const igual = actuales.length === options.length && actuales.every((o, i) => o === options[i])
  if (igual) {
    console.log(`"${name}" ya tiene las ${options.length} opciones nuevas`)
    continue
  }
  console.log(`\n"${name}" (${campo.id}): ${actuales.length} → ${options.length} opciones`)
  for (const o of actuales.filter(o => !options.includes(o))) console.log(`  - ${o}`)
  for (const o of options.filter(o => !actuales.includes(o))) console.log(`  + ${o}`)
  if (!execute) continue
  const res = await ghl('PUT', `/locations/${LOCATION_ID}/customFields/${campo.id}`, { name: campo.name, options })
  const quedaron = res.customField?.picklistOptions ?? res.picklistOptions ?? []
  const ok = quedaron.length === options.length && quedaron.every((o, i) => o === options[i])
  if (!ok) throw new Error(`"${name}": GHL devolvió ${quedaron.length} opciones, se esperaban ${options.length}`)
  console.log(`  ✓ aplicado`)
}

if (execute) {
  const catalogo = JSON.parse(readFileSync(CATALOGO, 'utf8'))
  for (const { name, options } of CAMBIOS) {
    const c = catalogo.find(x => x.folder === 'Inclusiones' && x.name === name)
    if (c) c.options = options
  }
  writeFileSync(CATALOGO, JSON.stringify(catalogo, null, 1) + '\n')
  console.log('\n✓ catálogo local actualizado')
} else {
  console.log('\n[dry-run] nada cambió. Agrega --execute para aplicar.')
}
