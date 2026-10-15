#!/usr/bin/env node
/**
 * Euros en la divisa (pedido del cliente, 15-oct-2026): agrega la opción EUR
 * a "Pago 1–4 - Divisa" y "Cuota 1–6 - Divisa" de la OPORTUNIDAD y al
 * catálogo del Generador (scripts/ghl-campos-oportunidad.catalog.json).
 * Conserva las opciones que ya tenga cada campo. Idempotente.
 *
 *   node scripts/ghl-divisa-euros.mjs            # dry-run
 *   node scripts/ghl-divisa-euros.mjs --execute  # actualiza GHL + catálogo
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const OPCIONES = ['COP', 'USD', 'EUR']
const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
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

const nombres = [
  ...[1, 2, 3, 4].map(n => `Pago ${n} - Divisa`),
  ...[1, 2, 3, 4, 5, 6].map(n => `Cuota ${n} - Divisa`),
]

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const porNombre = new Map(customFields.filter(f => f.model === 'opportunity').map(f => [f.name.trim(), f]))

for (const nombre of nombres) {
  const campo = porNombre.get(nombre)
  if (!campo) throw new Error(`No existe en GHL: ${nombre}`)
  const actuales = (campo.picklistOptions ?? campo.options ?? []).map(o => (typeof o === 'string' ? o : o.label ?? o.key))
  const nuevas = [...actuales, ...OPCIONES.filter(o => !actuales.includes(o))]
  if (nuevas.length === actuales.length) {
    console.log(`= ${nombre}: ya tiene ${actuales.join(', ')}`)
    continue
  }
  console.log(`${execute ? '✓' : '·'} ${nombre}: ${actuales.join(', ')} → ${nuevas.join(', ')}`)
  if (execute) await ghl('PUT', `/locations/${LOCATION_ID}/customFields/${campo.id}`, { name: campo.name, options: nuevas })
}

const catalogo = JSON.parse(readFileSync(CATALOGO, 'utf8'))
let cambios = 0
for (const c of catalogo) {
  if (!nombres.includes(c.name)) continue
  const faltan = OPCIONES.filter(o => !(c.options ?? []).includes(o))
  if (faltan.length) {
    c.options = [...(c.options ?? []), ...faltan]
    cambios++
  }
}
if (execute && cambios) writeFileSync(CATALOGO, JSON.stringify(catalogo, null, 1) + '\n')
console.log(`Catálogo: ${cambios} campo(s) ${execute ? 'actualizados' : 'por actualizar'}.`)
if (!execute) console.log('Dry-run: agrega --execute para aplicar.')
