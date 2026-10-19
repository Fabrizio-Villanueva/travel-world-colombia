#!/usr/bin/env node
/**
 * Conversión real (19-oct-2026): GHL calcula la conversión por pipeline, y como
 * la venta ganada se MUDA de 🎯 Leads a 🗂️ Reservaciones, Leads queda con ~0 %
 * de ganadas. Para medirla bien, cada venta que viene de un lead se marca en la
 * OPORTUNIDAD (carpeta Generales del Viaje):
 *   - Origen de la venta (SINGLE_OPTIONS: Pipeline Leads)
 *   - Fecha de venta     (DATE)
 * Desde ahora los llena /api/agente/reservacion al mudar la tarjeta. Este script
 * crea los campos y marca las ventas de octubre que ya se mudaron. Idempotente.
 *
 *   node scripts/ghl-campos-origen-venta.mjs            # dry-run
 *   node scripts/ghl-campos-origen-venta.mjs --execute  # crea campos + marca
 *
 * Cómo se reconoce una venta mudada sin marca: está ganada en Reservaciones y
 * su tarjeta nació más de 10 min antes de ganarse (vivió antes en Leads). Las
 * creadas directo en Reservaciones nacen ya ganadas. Solo desde el 1-oct: el
 * 29/30-sep se consolidaron pipelines viejos y esas fechas no dicen nada.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const PIPELINE_RESERVACIONES = 'Jq7CxjuirY9Gu44el0bs'
const CARPETA_GENERALES = 'aGzAJLExX8oWxzEejEEg' // scripts/ghl-carpetas-oportunidad.json
const DESDE = '2026-10-01T05:00:00Z' // 1-oct 00:00 Bogotá
const MARGEN_MS = 10 * 60 * 1000
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

const CAMPOS = [
  { name: 'Origen de la venta', dataType: 'SINGLE_OPTIONS', options: ['Pipeline Leads'] },
  { name: 'Fecha de venta', dataType: 'DATE' },
]

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const existentes = new Map(customFields.filter(f => f.model === 'opportunity').map(f => [f.name.trim(), f]))
const ids = {}
for (const c of CAMPOS) {
  const ya = existentes.get(c.name)
  if (ya) {
    ids[c.name] = ya.id
    console.log(`  = ${c.name} (${ya.id}, ${ya.fieldKey})`)
    continue
  }
  if (!execute) {
    console.log(`  [dry-run] ${c.name} (${c.dataType}) → Generales del Viaje`)
    continue
  }
  const r = await ghl('POST', `/locations/${LOCATION_ID}/customFields`, {
    name: c.name,
    dataType: c.dataType,
    ...(c.options ? { options: c.options } : {}),
    model: 'opportunity',
    placeholder: '',
    parentId: CARPETA_GENERALES,
  })
  const f = r.customField ?? r
  ids[c.name] = f.id
  console.log(`  ✓ ${c.name} (${f.id}, ${f.fieldKey})`)
}

// Ventas de octubre ya mudadas, sin marca.
const reservas = []
for (let pagina = 1; pagina <= 20; pagina++) {
  const r = await ghl(
    'GET',
    `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${PIPELINE_RESERVACIONES}&status=won&limit=100&page=${pagina}`
  )
  reservas.push(...(r.opportunities ?? []))
  if ((r.opportunities ?? []).length < 100) break
}
const idOrigen = ids['Origen de la venta']
const fechaBogota = iso => new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 10)
const porMarcar = reservas.filter(o => {
  if (/prueba|ejemplo|capacitaci/i.test(o.name ?? '')) return false
  if (!o.lastStatusChangeAt || o.lastStatusChangeAt < DESDE) return false
  if (Date.parse(o.lastStatusChangeAt) - Date.parse(o.createdAt) <= MARGEN_MS) return false
  return !(idOrigen && (o.customFields ?? []).some(f => f.id === idOrigen && f.fieldValueString))
})
console.log(`\n${porMarcar.length} ventas mudadas desde Leads sin marca (de ${reservas.length} ganadas en Reservaciones):`)
for (const o of porMarcar) {
  const fecha = fechaBogota(o.lastStatusChangeAt)
  console.log(`  ${fecha}  ${o.id}  ${o.name}`)
  if (!execute) continue
  await ghl('PUT', `/opportunities/${o.id}`, {
    customFields: [
      { id: ids['Origen de la venta'], field_value: 'Pipeline Leads' },
      { id: ids['Fecha de venta'], field_value: fecha },
    ],
  })
}
if (!execute) console.log('\n[dry-run] nada cambió. Agrega --execute para aplicar.')
else console.log(`\n✓ listo. IDs: ${JSON.stringify(ids)}`)
