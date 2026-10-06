// Campos de OPORTUNIDAD para Sol v2 (docs/plan-sol-vendedora.md §11-§12).
// Nacen en la carpeta "⭐ Calificación (Sol)" de oportunidad. Reemplazan a los
// sol_* del CONTACTO (menos sol_idioma, que se queda en el contacto) y suman los
// nuevos del método de venta (estado comercial, señal de compra, compromiso…).
//
// Uso:
//   node scripts/ghl-campos-sol-v2.mjs             # dry-run
//   node scripts/ghl-campos-sol-v2.mjs --execute   # crea los que falten (idempotente por nombre)

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_CALIFICACION_SOL = 'x2Jw8uhopfBq1Or1zH2y' // ⭐ Calificación (Sol), oportunidad
const API = 'https://services.leadconnectorhq.com'

const env = readFileSync(resolve('.env.local'), 'utf8')
const pit = env.match(/^GHL_TWC_PIT=(.+)$/m)?.[1]?.trim()
if (!pit) throw new Error('No se encontró GHL_TWC_PIT en .env.local')
const execute = process.argv.includes('--execute')

export const CAMPOS = [
  { name: 'Estado comercial', dataType: 'SINGLE_OPTIONS', options: ['conversando', 'explorando', 'falta_informacion', 'objecion', 'consultando_decisor', 'listo_para_reservar', 'nutrir', 'calificado', 'escalado', 'dormido', 'no_interesado', 'fuera_de_alcance'], desde: 'contact.sol_estado' },
  { name: 'Temperatura', dataType: 'SINGLE_OPTIONS', options: ['caliente', 'tibio', 'frio', 'no_interesado'], desde: 'contact.sol_temperatura' },
  { name: 'Resumen de Sol', dataType: 'LARGE_TEXT', desde: 'contact.sol_resumen' },
  { name: 'Objeción principal', dataType: 'SINGLE_OPTIONS', options: ['precio', 'fechas', 'decisor', 'confianza', 'forma_de_pago', 'comparando', 'documentos_visa', 'solo_mirando', 'otra'] },
  { name: 'Detalle de la objeción', dataType: 'LARGE_TEXT', desde: 'contact.sol_objeciones' },
  { name: 'Confianza de los datos', dataType: 'SINGLE_OPTIONS', options: ['alta', 'media', 'baja'], desde: 'contact.sol_confianza' },
  { name: 'Canal de la conversación', dataType: 'SINGLE_OPTIONS', options: ['whatsapp', 'instagram', 'facebook', 'widget'], desde: 'contact.sol_canal' },
  { name: 'Última interacción de Sol', dataType: 'DATE', desde: 'contact.sol_ultima_interaccion' },
  { name: 'Próximo seguimiento de Sol', dataType: 'DATE', desde: 'contact.sol_proximo_seguimiento' },
  { name: 'Intentos de seguimiento', dataType: 'NUMERICAL', desde: 'contact.sol_intentos_seguimiento' },
  { name: 'Motivo de cierre (Sol)', dataType: 'TEXT', desde: 'contact.sol_motivo_cierre' },
  { name: 'Señal de compra', dataType: 'TEXT' },
  { name: 'Respuesta al compromiso', dataType: 'SINGLE_OPTIONS', options: ['si', 'todavia_no', 'no', 'no_preguntada'] },
  { name: 'Quién decide', dataType: 'TEXT' },
  { name: 'Rango de referencia dado', dataType: 'TEXT' },
  { name: 'Canal de cierre preferido', dataType: 'SINGLE_OPTIONS', options: ['whatsapp', 'llamada', 'oficina'] },
  { name: 'Borrador de cotización', dataType: 'LARGE_TEXT' },
]

const headers = { Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json', 'User-Agent': 'twc-scripts/1.0' }
async function ghl(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('ghl-campos-sol-v2.mjs')) {
  const existentes = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
  const porNombre = new Map((existentes.customFields ?? []).map(f => [f.name, f]))
  const faltan = CAMPOS.filter(c => !porNombre.has(c.name))
  console.log(`Campos de oportunidad: ${porNombre.size} · catálogo Sol v2: ${CAMPOS.length} · por crear: ${faltan.length}`)

  for (const c of faltan) {
    if (!execute) {
      console.log(`  [dry-run] ${c.name} (${c.dataType})`)
      continue
    }
    const body = { name: c.name, dataType: c.dataType, model: 'opportunity', placeholder: '', parentId: CARPETA_CALIFICACION_SOL }
    if (c.options) body.options = c.options
    try {
      const r = await ghl('POST', `/locations/${LOCATION_ID}/customFields`, body)
      console.log(`  ✓ ${c.name} → ${r.customField?.id} (${r.customField?.fieldKey})`)
    } catch (e) {
      console.error(`  ✗ ${c.name}: ${e.message}`)
      process.exitCode = 1
    }
    await new Promise(r => setTimeout(r, 250))
  }

  // Mapa final nombre → id/fieldKey (para lib/agente/config.ts).
  const final = await ghl('GET', `/locations/${LOCATION_ID}/customFields?model=opportunity`)
  for (const c of CAMPOS) {
    const f = (final.customFields ?? []).find(x => x.name === c.name)
    console.log(`${f ? '•' : '✗'} ${c.name}: ${f?.id ?? 'NO EXISTE'} ${f?.fieldKey ?? ''} carpeta=${f?.parentId ?? '-'}`)
  }
}
