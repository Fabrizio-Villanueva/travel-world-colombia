#!/usr/bin/env node
/**
 * Alcance del viaje (23-oct-2026): la asistencia TRAVELKIT (emergencias en
 * destino y cancelación por multicausa) solo aplica a viajes internacionales.
 * Este campo de la OPORTUNIDAD (carpeta Contrato) decide si el contrato
 * imprime la cláusula TRAVELKIT y si al firmar se le envía al cliente el paso
 * a paso por WhatsApp. El Generador lo sugiere por el país del destino y no
 * deja enviar el contrato sin él. Idempotente.
 *
 *   node scripts/ghl-campo-alcance-viaje.mjs            # dry-run
 *   node scripts/ghl-campo-alcance-viaje.mjs --execute  # crea el campo
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_CONTRATO = 'qorGt3tT3dCmej1PgwR6' // scripts/ghl-carpetas-oportunidad.json
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

const CAMPO = { name: 'Alcance del viaje', dataType: 'SINGLE_OPTIONS', options: ['Nacional', 'Internacional'] }

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const ya = customFields.find(f => f.model === 'opportunity' && f.name.trim() === CAMPO.name)
if (ya) {
  console.log(`  = ${CAMPO.name} ya existe (${ya.id}, ${ya.fieldKey}) · opciones: ${(ya.picklistOptions ?? []).join(' / ')}`)
} else if (!execute) {
  console.log(`  [dry-run] ${CAMPO.name} (${CAMPO.dataType}: ${CAMPO.options.join(' / ')}) → carpeta Contrato`)
  console.log('\n[dry-run] nada cambió. Agrega --execute para crearlo.')
} else {
  const r = await ghl('POST', `/locations/${LOCATION_ID}/customFields`, {
    name: CAMPO.name,
    dataType: CAMPO.dataType,
    options: CAMPO.options,
    model: 'opportunity',
    placeholder: '',
    parentId: CARPETA_CONTRATO,
  })
  const f = r.customField ?? r
  console.log(`  ✓ ${CAMPO.name} (${f.id}, ${f.fieldKey})`)
}
