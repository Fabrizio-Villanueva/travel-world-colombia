// Proveedor de promptfoo para Sol: corre evals/sol/correr-turno.ts con tsx
// (alias @/ del tsconfig y variables de .env.local) y devuelve el resultado
// como JSON. Cada caso lleva `version` y `chat` en sus vars.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export default class ProveedorSol {
  id() {
    return 'sol'
  }

  async callApi(_prompt, context) {
    const { version = 'v2', chat = [] } = context?.vars ?? {}
    const salida = await new Promise((ok, falla) => {
      const p = spawn(
        'npx',
        ['-y', 'tsx@4.19.2', '--env-file=.env.local', '--tsconfig', './tsconfig.json', 'evals/sol/correr-turno.ts'],
        { cwd: raiz, shell: process.platform === 'win32' }
      )
      let out = ''
      let err = ''
      p.stdout.on('data', d => (out += d))
      p.stderr.on('data', d => (err += d))
      p.on('error', falla)
      p.on('close', () => ok({ out, err }))
      p.stdin.end(JSON.stringify({ version, chat }))
    })
    const linea = salida.out.split('\n').find(l => l.startsWith('@@RESULTADO@@'))
    if (!linea) return { error: `sin resultado: ${salida.err.slice(-500)}` }
    const r = JSON.parse(linea.slice('@@RESULTADO@@'.length))
    if (r.error) return { error: r.error }
    return { output: JSON.stringify(r, null, 2) }
  }
}
