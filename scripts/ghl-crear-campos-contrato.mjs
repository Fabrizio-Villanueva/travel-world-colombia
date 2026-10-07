#!/usr/bin/env node
/**
 * Contrato propio (oct-2026): crea en la OPORTUNIDAD, carpeta Contrato, los
 * campos del flujo de firma:
 *   - Link del contrato            → enlace /contrato/<token> que recibe el cliente
 *   - Estado del contrato          → Enviado / Visto / Firmado / Anulado
 *   - Contrato firmado (PDF)       → enlace del panel al PDF firmado (pide sesión)
 *   - Enviar contrato al cliente   → Enviar / Reenviar: disparador del workflow
 *                                    de GHL que manda el enlace por WhatsApp/correo
 * Idempotente.
 *
 *   node scripts/ghl-crear-campos-contrato.mjs            # dry-run
 *   node scripts/ghl-crear-campos-contrato.mjs --execute  # crea
 */
import fs from 'node:fs'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_CONTRATO = 'qorGt3tT3dCmej1PgwR6' // scripts/ghl-carpetas-oportunidad.json
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

const CAMPOS = [
  { name: 'Link del contrato', dataType: 'TEXT' },
  { name: 'Estado del contrato', dataType: 'SINGLE_OPTIONS', options: ['Enviado', 'Visto', 'Firmado', 'Anulado'] },
  { name: 'Contrato firmado (PDF)', dataType: 'TEXT' },
  { name: 'Enviar contrato al cliente', dataType: 'SINGLE_OPTIONS', options: ['Enviar', 'Reenviar'] },
]

const { customFields } = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
const existentes = new Map(customFields.filter(f => f.model === 'opportunity').map(f => [f.name.trim(), f]))
for (const c of CAMPOS) {
  const ya = existentes.get(c.name)
  if (ya) {
    console.log(`  = ${c.name} (${ya.id}, ${ya.fieldKey})`)
    continue
  }
  if (!execute) {
    console.log(`  [dry-run] ${c.name} (${c.dataType}) → Contrato`)
    continue
  }
  const r = await ghl('POST', `/locations/${LOCATION_ID}/customFields`, {
    name: c.name,
    dataType: c.dataType,
    model: 'opportunity',
    placeholder: '',
    parentId: CARPETA_CONTRATO,
    ...(c.options ? { options: c.options } : {}),
  })
  const f = r.customField ?? r
  console.log(`  ✓ ${c.name} (${f.id}, ${f.fieldKey})`)
}
