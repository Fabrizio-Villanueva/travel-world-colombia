#!/usr/bin/env node
/**
 * Abonos y estado de cuenta (17-oct-2026): el plan de pagos pasa de 4 a 10
 * pagos y la oportunidad lleva un resumen del estado de cuenta. Crea en la
 * OPORTUNIDAD, carpeta Plan de Pagos:
 *   - Pago 5..10 - Divisa · Medio de Pago · Fecha de Pago · TRM · Total Plan ·
 *     Abono · Saldo en Pesos (los mismos 7 campos que Pago 1..4)
 *   - Estado de cuenta - Enlace · Saldo pendiente · Último abono (texto)
 * Los llena el sistema desde el libro de abonos (lib/abonos/ghl.ts); el
 * Generador no los muestra como campos sueltos. Idempotente.
 *
 *   node scripts/ghl-crear-pagos-5-10.mjs            # dry-run
 *   node scripts/ghl-crear-pagos-5-10.mjs --execute  # crea en GHL
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_PLAN_DE_PAGOS = '7XXtfa8YpIMFoMfwDvYw' // scripts/ghl-carpetas-oportunidad.json
const execute = process.argv.includes('--execute')
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
for (let n = 5; n <= 10; n++) {
  CAMPOS.push(
    { name: `Pago ${n} - Divisa`, dataType: 'SINGLE_OPTIONS', options: ['COP', 'USD', 'EUR'] },
    { name: `Pago ${n} - Medio de Pago`, dataType: 'TEXT' },
    { name: `Pago ${n} - Fecha de Pago`, dataType: 'DATE' },
    { name: `Pago ${n} - TRM`, dataType: 'NUMERICAL' },
    { name: `Pago ${n} - Total Plan`, dataType: 'NUMERICAL' },
    { name: `Pago ${n} - Abono`, dataType: 'NUMERICAL' },
    { name: `Pago ${n} - Saldo en Pesos`, dataType: 'NUMERICAL' },
  )
}
CAMPOS.push(
  { name: 'Estado de cuenta - Enlace', dataType: 'TEXT' },
  { name: 'Estado de cuenta - Saldo pendiente', dataType: 'TEXT' },
  { name: 'Estado de cuenta - Último abono', dataType: 'TEXT' },
)

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const existentes = new Map(customFields.filter(f => f.model === 'opportunity').map(f => [f.name.trim(), f]))
let creados = 0
for (const c of CAMPOS) {
  if (existentes.has(c.name)) {
    console.log(`  = ${c.name}`)
    continue
  }
  if (!execute) {
    console.log(`  [dry-run] ${c.name} (${c.dataType})`)
    continue
  }
  const r = await ghl('POST', `/locations/${LOCATION_ID}/customFields`, {
    name: c.name,
    dataType: c.dataType,
    ...(c.options ? { options: c.options } : {}),
    model: 'opportunity',
    placeholder: '',
    parentId: CARPETA_PLAN_DE_PAGOS,
  })
  const f = r.customField ?? r
  creados++
  console.log(`  ✓ ${c.name} (${f.id})`)
}
if (!execute) console.log(`\n[dry-run] ${CAMPOS.filter(c => !existentes.has(c.name)).length} campos por crear. Agrega --execute para aplicar.`)
else console.log(`\n✓ listo: ${creados} campos creados en GHL`)
