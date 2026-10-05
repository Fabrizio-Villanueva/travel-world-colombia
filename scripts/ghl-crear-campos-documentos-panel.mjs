#!/usr/bin/env node
/**
 * Portal de documentos v2 (05-oct): crea en la OPORTUNIDAD los 8 campos de
 * texto `P1 - Documentos (panel)` … `P8 - Documentos (panel)` en la carpeta
 * 👥 Pasajeros. El servidor escribe ahí el enlace a la página del panel con las
 * fotos del viajero (frente y reverso): pide sesión del equipo, firma las fotos
 * por 5 minutos y queda en la bitácora. Las imágenes NO se suben a GHL (los
 * campos de archivo de GHL dan enlaces públicos que no se pueden revocar).
 *
 * También crea `P1 - Tipo de documento` … `P8` (lista: CC / TI / RC / Pasaporte /
 * CE / PPT), que el servidor llena al confirmar cada documento. Las opciones
 * deben ser idénticas a OPCIONES_TIPO_DOCUMENTO_GHL (lib/documentos/config.ts).
 *
 * No van en ghl-campos-oportunidad.catalog.json a propósito: el Generador los
 * mostraría como campos editables. Idempotente: si ya existen, no hace nada.
 *
 *   node scripts/ghl-crear-campos-documentos-panel.mjs            # dry-run
 *   node scripts/ghl-crear-campos-documentos-panel.mjs --execute  # crea
 */
import fs from 'node:fs'

const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_PASAJEROS = 'KrCqDUA3pVWAnWh3WCIF' // scripts/ghl-carpetas-oportunidad.json
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
const existentes = new Set(customFields.filter(f => f.model === 'opportunity').map(f => f.name.trim()))
// Copia de OPCIONES_TIPO_DOCUMENTO_GHL (lib/documentos/config.ts): mantener iguales.
const OPCIONES_TIPO = [
  'Cédula de ciudadanía (CC)',
  'Tarjeta de identidad (TI)',
  'Registro civil (RC)',
  'Pasaporte (PA)',
  'Cédula de extranjería (CE)',
  'Permiso de protección temporal (PPT)',
]
const campos = Array.from({ length: 8 }, (_, i) => [
  { name: `P${i + 1} - Documentos (panel)`, dataType: 'TEXT' },
  { name: `P${i + 1} - Tipo de documento`, dataType: 'SINGLE_OPTIONS', options: OPCIONES_TIPO },
]).flat()
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
  await new Promise(r => setTimeout(r, 200))
}
if (!execute && pendientes.length) console.log('\nDry-run: nada creado. Ejecuta con --execute para crear.')
