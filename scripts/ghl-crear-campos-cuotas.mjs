#!/usr/bin/env node
/**
 * Plan de pagos por cuotas (pedido del cliente, 08-oct-2026): crea en la
 * OPORTUNIDAD, carpeta Plan de Pagos, los campos de las cuotas pendientes:
 *   - Cuota N - Importe               (NUMERICAL)
 *   - Cuota N - Fecha de vencimiento  (DATE)
 * para N = 1..MAX_CUOTAS, y los agrega al catálogo del Generador
 * (scripts/ghl-campos-oportunidad.catalog.json). Idempotente.
 *
 *   node scripts/ghl-crear-campos-cuotas.mjs            # dry-run
 *   node scripts/ghl-crear-campos-cuotas.mjs --execute  # crea en GHL + catálogo
 *
 * Para ampliar el tope: subir MAX_CUOTAS aquí y en lib/contratos/armar.ts
 * (MAX_CUOTAS) y volver a correr con --execute.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const MAX_CUOTAS = 6
const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_PLAN_DE_PAGOS = '7XXtfa8YpIMFoMfwDvYw' // scripts/ghl-carpetas-oportunidad.json
const execute = process.argv.includes('--execute')
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGO = resolve(raiz, 'scripts/ghl-campos-oportunidad.catalog.json')

const env = Object.fromEntries(
  readFileSync(resolve(raiz, '.env.local'), 'utf8')
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

const CAMPOS = []
for (let n = 1; n <= MAX_CUOTAS; n++) {
  CAMPOS.push({ name: `Cuota ${n} - Importe`, dataType: 'NUMERICAL' })
  CAMPOS.push({ name: `Cuota ${n} - Fecha de vencimiento`, dataType: 'DATE' })
}

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const existentes = new Map(customFields.filter(f => f.model === 'opportunity').map(f => [f.name.trim(), f]))
let creados = 0
for (const c of CAMPOS) {
  const ya = existentes.get(c.name)
  if (ya) {
    console.log(`  = ${c.name} (${ya.id}, ${ya.fieldKey})`)
    continue
  }
  if (!execute) {
    console.log(`  [dry-run] ${c.name} (${c.dataType}) → Plan de Pagos`)
    continue
  }
  const r = await ghl('POST', `/locations/${LOCATION_ID}/customFields`, {
    name: c.name,
    dataType: c.dataType,
    model: 'opportunity',
    placeholder: '',
    parentId: CARPETA_PLAN_DE_PAGOS,
  })
  const f = r.customField ?? r
  creados++
  console.log(`  ✓ ${c.name} (${f.id}, ${f.fieldKey})`)
}

// Catálogo del Generador: el wizard y el contrato leen los campos por nombre.
const catalogo = JSON.parse(readFileSync(CATALOGO, 'utf8'))
const nombres = new Set(catalogo.map(c => c.name))
const faltan = CAMPOS.filter(c => !nombres.has(c.name))
if (faltan.length === 0) {
  console.log('\n= catálogo ya tiene las cuotas')
} else if (!execute) {
  console.log(`\n[dry-run] se agregarían ${faltan.length} campos al catálogo (carpeta Plan de Pagos)`)
} else {
  // Van justo después del último campo de Plan de Pagos para mantener el orden por carpeta.
  let ultimo = -1
  catalogo.forEach((c, i) => { if (c.folder === 'Plan de Pagos') ultimo = i })
  const nuevos = faltan.map(c => ({ folder: 'Plan de Pagos', name: c.name, dataType: c.dataType }))
  catalogo.splice(ultimo + 1, 0, ...nuevos)
  writeFileSync(CATALOGO, JSON.stringify(catalogo, null, 1) + '\n')
  console.log(`\n✓ catálogo: +${faltan.length} campos (carpeta Plan de Pagos)`)
}
if (!execute) console.log('\n[dry-run] nada cambió. Agrega --execute para aplicar.')
else console.log(`\n✓ listo: ${creados} campos creados en GHL`)
