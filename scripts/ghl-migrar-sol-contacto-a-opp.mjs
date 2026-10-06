// Copia los campos sol_* del CONTACTO a los nuevos campos de la OPORTUNIDAD
// abierta del pipeline 🎯 Leads (docs/plan-sol-vendedora.md §12).
// NO borra nada del contacto: eso se hace al final, cuando se confirme que
// ningún workflow ni lista inteligente usa los campos viejos.
//
// Uso:
//   node scripts/ghl-migrar-sol-contacto-a-opp.mjs             # respaldo + dry-run
//   node scripts/ghl-migrar-sol-contacto-a-opp.mjs --execute   # respaldo + copia
//
// Respaldo: .respaldos-ghl/sol_contacto_<fecha>.json (fuera de git).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const LOC = 'RMFUo0i4KOVl7eZHEn7s'
const LEADS = 'MLoZOGIYvCBRUgQdYRA8'
const API = 'https://services.leadconnectorhq.com'
const env = readFileSync(resolve('.env.local'), 'utf8')
const pit = env.match(/^GHL_TWC_PIT=(.+)$/m)?.[1]?.trim()
const execute = process.argv.includes('--execute')
const headers = { Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'twc-scripts/1.0' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function ghl(method, path, body) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    if (res.status === 429) { await sleep(2000 * (i + 1)); continue }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
    return json
  }
  throw new Error(`429 persistente en ${path}`)
}

// contacto (id) → oportunidad (id), según los campos creados por ghl-campos-sol-v2.mjs
const MAPA = {
  ViQHLxaiqquWXN3C4g1R: 'n6qtOOZVHPfrRkMnvJ2m', // sol_estado → Estado comercial
  Pb7LLMKqnSaRNWeYXplh: 'AIB6Wb4WlkOH8p8MY8g9', // sol_temperatura → Temperatura
  UwiRAbz1hd52PZEnTN1I: 'oLiwj36D1LoF7yxAJzWk', // sol_resumen → Resumen de Sol
  ZWdjCHswoFSpXl86d9gR: 'Ep3LHWeDeit0RnJUAW4e', // sol_objeciones → Detalle de la objeción
  fwAJmk7Br9RB85UEFqmY: 'rD4JhweXYoo6NF9BlKaO', // sol_confianza → Confianza de los datos
  Xu5kJNEhfEq0VJE2VeNq: 'ASSlqf7RhIMH0lUSZPFi', // sol_canal → Canal de la conversación
  '3lFkVNxsnsEAem7o6BFB': 'VUOzlXgNaeLwF1vcpvyJ', // sol_ultima_interaccion → Última interacción de Sol
  SbW0fZvzaMlyrSljEsZs: '7pcMC3q1VTd2YvhllaZ8', // sol_proximo_seguimiento → Próximo seguimiento de Sol
  FzV3rBcYBNOTl0Dd7icw: 'j8YfrVRV0M4CU4zAfCKR', // sol_intentos_seguimiento → Intentos de seguimiento
  raDE38awjgeZkDz9nJPw: 'O8XevcDBHvvHkTEzsTIb', // sol_motivo_cierre → Motivo de cierre (Sol)
}

// 1) Todos los contactos (paginado completo, sin tope) y sus sol_*.
const conValores = []
let total = 0
let startAfterId, startAfter
for (;;) {
  const q = `/contacts/?locationId=${LOC}&limit=100${startAfterId ? `&startAfterId=${startAfterId}&startAfter=${startAfter}` : ''}`
  const r = await ghl('GET', q)
  const lote = r.contacts ?? []
  total += lote.length
  for (const c of lote) {
    const valores = (c.customFields ?? []).filter(f => MAPA[f.id] && f.value !== undefined && f.value !== null && f.value !== '')
    if (valores.length) conValores.push({ contactId: c.id, nombre: c.contactName ?? '', valores: valores.map(f => ({ id: f.id, value: f.value })) })
  }
  if (lote.length < 100) break
  startAfterId = r.meta?.startAfterId
  startAfter = r.meta?.startAfter
  if (!startAfterId) break
}
console.log(`Contactos leídos: ${total} · con algún sol_*: ${conValores.length}`)

mkdirSync(resolve('.respaldos-ghl'), { recursive: true })
const archivo = resolve(`.respaldos-ghl/sol_contacto_${new Date().toISOString().slice(0, 10)}.json`)
writeFileSync(archivo, JSON.stringify(conValores, null, 1))
console.log(`Respaldo: ${archivo}`)

// 2) Copiar a la oportunidad abierta de Leads (la más reciente).
let copiados = 0, sinOpp = 0, errores = 0
for (const c of conValores) {
  const r = await ghl('GET', `/opportunities/search?location_id=${LOC}&contact_id=${c.contactId}&pipeline_id=${LEADS}&status=open&limit=10`)
  const opp = (r.opportunities ?? []).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  if (!opp) { sinOpp++; continue }
  // Las fechas del contacto llegan como epoch en ms; la oportunidad las pide YYYY-MM-DD.
  const FECHAS = new Set(['3lFkVNxsnsEAem7o6BFB', 'SbW0fZvzaMlyrSljEsZs'])
  const customFields = c.valores.map(v => ({
    id: MAPA[v.id],
    field_value: FECHAS.has(v.id) && /^\d{10,}$/.test(String(v.value))
      ? new Date(Number(v.value)).toISOString().slice(0, 10)
      : v.value,
  }))
  if (!execute) { copiados++; continue }
  try {
    await ghl('PUT', `/opportunities/${opp.id}`, { customFields })
    copiados++
  } catch (e) {
    errores++
    console.error(`  ✗ ${c.contactId}: ${e.message}`)
  }
  await sleep(120)
}
console.log(`${execute ? 'Copiados' : '[dry-run] Se copiarían'}: ${copiados} · sin oportunidad abierta en Leads: ${sinOpp} · errores: ${errores}`)
