#!/usr/bin/env node
/**
 * Contrato para 12 personas (07-oct): crea en la OPORTUNIDAD los 10 campos de
 * P9, P10, P11 y P12 (40 en total) en la carpeta 👥 Pasajeros, con los mismos
 * nombres y tipos que P1–P8, y amplía las opciones de
 * `Contrato - Numero de Pasajeros` de 1–8 a 1–12.
 *
 * Los 8 campos "de catálogo" de cada pasajero también se agregan a
 * ghl-campos-oportunidad.catalog.json (el Generador los muestra); los de
 * `Documentos (panel)` y `Tipo de documento` los llena el servidor (ver
 * ghl-crear-campos-documentos-panel.mjs). Idempotente.
 *
 *   node scripts/ghl-ampliar-pasajeros-12.mjs            # dry-run
 *   node scripts/ghl-ampliar-pasajeros-12.mjs --execute  # crea
 */
import fs from 'node:fs'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_PASAJEROS = 'KrCqDUA3pVWAnWh3WCIF' // scripts/ghl-carpetas-oportunidad.json
const NUM_PASAJEROS = 'Contrato - Numero de Pasajeros'
const execute = process.argv.includes('--execute')

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)
const PIT = env.GHL_TWC_PIT
if (!PIT) throw new Error('Falta GHL_TWC_PIT en .env.local')

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
const existentes = new Set(opp.map(f => f.name.trim()))

// Copia de OPCIONES_TIPO_DOCUMENTO_GHL (lib/documentos/config.ts): mantener iguales.
const OPCIONES_TIPO = [
  'Cédula de ciudadanía (CC)',
  'Tarjeta de identidad (TI)',
  'Registro civil (RC)',
  'Pasaporte (PA)',
  'Cédula de extranjería (CE)',
  'Permiso de protección temporal (PPT)',
]
const POR_PASAJERO = [
  ['Nombre y Apellido', 'TEXT'],
  ['Documento', 'TEXT'],
  ['Fecha de Nacimiento', 'DATE'],
  ['Pasaporte', 'TEXT'],
  ['Vencimiento Pasaporte', 'DATE'],
  ['Telefono', 'PHONE'],
  ['Visa Número', 'TEXT'],
  ['Visa Vencimiento', 'DATE'],
  ['Documentos (panel)', 'TEXT'],
  ['Tipo de documento', 'SINGLE_OPTIONS'],
]
const campos = [9, 10, 11, 12].flatMap(n =>
  POR_PASAJERO.map(([sufijo, dataType]) => ({
    name: `P${n} - ${sufijo}`,
    dataType,
    ...(dataType === 'SINGLE_OPTIONS' ? { options: OPCIONES_TIPO } : {}),
  }))
)
const pendientes = campos.filter(c => !existentes.has(c.name))
console.log(`Ya existen: ${campos.length - pendientes.length} · por crear: ${pendientes.length}`)

for (const { name, dataType, options } of pendientes) {
  if (!execute) {
    console.log(`  [dry-run] ${name} (${dataType}) → 👥 Pasajeros`)
    continue
  }
  await ghl('POST', `/locations/${LOCATION_ID}/customFields`, {
    name,
    dataType,
    model: 'opportunity',
    placeholder: '',
    parentId: CARPETA_PASAJEROS,
    ...(options ? { options } : {}),
  })
  console.log(`  ✓ ${name}`)
}

// Opciones 1–12 en "Contrato - Numero de Pasajeros".
const num = opp.find(f => f.name.trim() === NUM_PASAJEROS)
if (!num) throw new Error(`No existe "${NUM_PASAJEROS}"`)
const actuales = num.picklistOptions ?? []
const deseadas = Array.from({ length: 12 }, (_, i) => String(i + 1))
if (deseadas.every(o => actuales.includes(o))) {
  console.log(`"${NUM_PASAJEROS}" ya tiene 1–12`)
} else if (!execute) {
  console.log(`  [dry-run] "${NUM_PASAJEROS}": [${actuales.join(', ')}] → [${deseadas.join(', ')}]`)
} else {
  await ghl('PUT', `/locations/${LOCATION_ID}/customFields/${num.id}`, {
    name: num.name,
    options: deseadas,
  })
  console.log(`  ✓ "${NUM_PASAJEROS}" → 1–12`)
}
