#!/usr/bin/env node
/**
 * Opciones del campo de oportunidad "Tipo de Contrato" (carpeta Contrato),
 * según lo pidió el equipo el 08-oct-2026 (Ginna): vocabulario colombiano
 * ("tiquetes", no "ticketes"), sin el "Solo", y con "Paquete Turístico".
 *
 *   node scripts/ghl-opciones-tipo-contrato.mjs            # dry-run
 *   node scripts/ghl-opciones-tipo-contrato.mjs --execute  # aplica en GHL + catálogo
 *
 * Ojo: el Generador decide qué pasos no aplican según este valor
 * (PASOS_NO_APLICAN en app/admin/reservas/[id]/Wizard.tsx): al renombrar una
 * opción hay que agregar el nombre nuevo ahí (los viejos se conservan para
 * las oportunidades que ya lo tenían guardado).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const execute = process.argv.includes('--execute')
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGO = resolve(raiz, 'scripts/ghl-campos-oportunidad.catalog.json')
const LOCATION_ID = 'RMFUo0i4KOVl7eZHEn7s'
const CARPETA_CONTRATO = 'qorGt3tT3dCmej1PgwR6'
const NOMBRE = 'Tipo de Contrato'

// Antes: Ticketes Aéreos · Plan Todo Incluido · Solo Asistencia · Solo Excursiones · Ticketes & Asistencia
const OPCIONES = [
  'Tiquetes Aéreos',
  'Paquete Turístico',
  'Plan Todo Incluido',
  'Asistencia en Viajes',
  'Excursiones',
  'Tiquetes Aéreos y Asistencia en Viajes',
]

const env = Object.fromEntries(
  readFileSync(resolve(raiz, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
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
const candidatos = customFields.filter(f => f.model === 'opportunity' && f.name.trim() === NOMBRE && f.parentId === CARPETA_CONTRATO)
if (candidatos.length !== 1) throw new Error(`Se esperaba 1 campo "${NOMBRE}" en la carpeta Contrato, hay ${candidatos.length}`)
const campo = candidatos[0]
const actuales = campo.picklistOptions ?? []
const igual = actuales.length === OPCIONES.length && actuales.every((o, i) => o === OPCIONES[i])
if (igual) {
  console.log(`"${NOMBRE}" ya tiene las ${OPCIONES.length} opciones`)
} else {
  console.log(`"${NOMBRE}" (${campo.id}): ${actuales.length} → ${OPCIONES.length} opciones`)
  for (const o of actuales.filter(o => !OPCIONES.includes(o))) console.log(`  - ${o}`)
  for (const o of OPCIONES.filter(o => !actuales.includes(o))) console.log(`  + ${o}`)
  if (execute) {
    const res = await ghl('PUT', `/locations/${LOCATION_ID}/customFields/${campo.id}`, { name: campo.name, options: OPCIONES })
    const quedaron = res.customField?.picklistOptions ?? res.picklistOptions ?? []
    const ok = quedaron.length === OPCIONES.length && quedaron.every((o, i) => o === OPCIONES[i])
    if (!ok) throw new Error(`GHL devolvió ${quedaron.length} opciones, se esperaban ${OPCIONES.length}`)
    console.log('  ✓ aplicado')
  }
}

if (execute) {
  const catalogo = JSON.parse(readFileSync(CATALOGO, 'utf8'))
  const c = catalogo.find(x => x.folder === 'Contrato' && x.name === NOMBRE)
  if (c) c.options = OPCIONES
  writeFileSync(CATALOGO, JSON.stringify(catalogo, null, 1) + '\n')
  console.log('✓ catálogo local actualizado')
} else {
  console.log('\n[dry-run] nada cambió. Agrega --execute para aplicar.')
}
