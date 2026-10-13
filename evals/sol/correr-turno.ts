/**
 * Corre UN turno de Sol (v1 o v2) sobre una conversación fija, igual que en
 * producción y en el laboratorio: modelo real + revisión automática con una
 * corrección (lib/agente/guardas.ts `conRevision`). Lo usa promptfoo
 * (evals/sol/proveedor.mjs) — no se llama desde la app.
 *
 * Entrada (stdin, JSON): { version: 'v1' | 'v2', chat: [{ de: 'cliente' | 'sol', texto }] }
 * Salida (stdout): una línea `@@RESULTADO@@{...}` con la decisión final, si
 * pasa el lead al equipo, lo que corrigió la revisión y lo que quedó sin
 * corregir. El resto del stdout (logs de la app) se ignora.
 */
import { decidir, type Decision } from '@/lib/agente/claude'
import { decidirV2 } from '@/lib/agente/v2/decidir'
import { cargarReglas } from '@/lib/agente/reglas'
import { equipo } from '@/lib/agente/equipo'
import { conRevision, revisarMensaje } from '@/lib/agente/guardas'
import { listoParaAsesora } from '@/lib/agente/crm'
import { enHorario } from '@/lib/agente/conversacion'
import type { MensajeGhl } from '@/lib/agente/ghl'

interface Entrada { version: 'v1' | 'v2'; chat: { de: 'cliente' | 'sol'; texto: string }[] }

async function leerStdin(): Promise<string> {
  let s = ''
  for await (const trozo of process.stdin) s += trozo
  return s
}

async function main() {
  const entrada = JSON.parse(await leerStdin()) as Entrada
  const ahora = Date.now()
  // Del más reciente al más antiguo, como los devuelve GHL; un minuto entre mensajes.
  const mensajes: MensajeGhl[] = entrada.chat
    .map((m, i) => ({
      id: `eval-${i}`,
      direction: m.de === 'cliente' ? 'inbound' : 'outbound',
      body: m.texto,
      messageType: 'TYPE_CUSTOM_SMS',
      dateAdded: new Date(ahora - (entrada.chat.length - i) * 60_000).toISOString(),
    }))
    .reverse()

  const primerContacto = !entrada.chat.some(m => m.de === 'sol')
  const [reglas, miembros] = await Promise.all([cargarReglas(), equipo()])
  const nombresEquipo = miembros.filter(m => m.asignable).map(m => m.nombre)
  const textoCliente = entrada.chat.filter(m => m.de === 'cliente').slice(-4).map(m => m.texto).join(' ')

  const turno = await conRevision(
    async extras => ({
      decision: entrada.version === 'v1'
        ? await decidir(mensajes, { canal: 'WhatsApp', enHorario: enHorario(), primerContacto, extras })
        : (await decidirV2(mensajes, { canal: 'WhatsApp', primerContacto, reglas, extras })).decision,
    }),
    {},
    nombresEquipo,
    mensajes
  )
  const decision: Decision = turno.decision
  const habla = decision.accion !== 'callar' && decision.mensaje.trim() !== ''
  const quedan = habla
    ? revisarMensaje(decision.mensaje, { equipo: nombresEquipo, textoCliente, nombreCliente: decision.datos?.nombre })
    : []

  const resultado = {
    accion: decision.accion,
    estado: decision.venta?.estado ?? null,
    pasa: decision.accion !== 'escalar' && listoParaAsesora(decision),
    mensaje: decision.mensaje,
    motivo: decision.motivo,
    datos: decision.datos,
    corregido: turno.nota ?? null,
    problemas: quedan,
  }
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(resultado)}\n`)
}

main().catch(err => {
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ error: (err as Error).message })}\n`)
  process.exit(1)
})
