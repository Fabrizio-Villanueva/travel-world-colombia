import fs from 'node:fs'
import path from 'node:path'
import { SITE } from '@/lib/site'

/**
 * PDF del contrato: un Chromium sin pantalla abre la página interna de
 * impresión (/contrato/imprimir/<id>, firmada por 5 minutos) y la imprime en
 * carta. Es el mismo HTML que ve el cliente, así que el PDF calca la pantalla.
 *
 * - En Vercel: @sparticuz/chromium (binario para funciones serverless).
 * - En local: CHROME_PATH o el Chromium que instala Playwright.
 */

/** Origen desde el que el Chromium del servidor abre la página de impresión. */
export function origenInterno(host?: string | null): string {
  if (process.env.VERCEL_ENV === 'production') return SITE.url
  // Vistas previas: la URL propia del despliegue (con el bypass de protección).
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return host ? `http://${host}` : 'http://localhost:3000'
}

function chromeLocal(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidatos: string[] = []
  const playwright = path.join(process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? '', '.cache'), 'ms-playwright')
  if (fs.existsSync(playwright)) {
    const dirs = fs.readdirSync(playwright).sort().reverse()
    // Primero el "headless shell": en Windows el chrome.exe completo de
    // Playwright puede no dejarse lanzar desde otro proceso (spawn UNKNOWN).
    for (const d of dirs.filter(d => d.startsWith('chromium_headless_shell-'))) {
      candidatos.push(
        path.join(playwright, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
        path.join(playwright, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
        path.join(playwright, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell')
      )
    }
    for (const d of dirs.filter(d => d.startsWith('chromium-'))) {
      candidatos.push(
        path.join(playwright, d, 'chrome-win64', 'chrome.exe'),
        path.join(playwright, d, 'chrome-linux', 'chrome'),
        path.join(playwright, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      )
    }
  }
  candidatos.push(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome'
  )
  const ruta = candidatos.find(c => fs.existsSync(c))
  if (!ruta) throw new Error('No hay Chrome local para generar el PDF: define CHROME_PATH.')
  return ruta
}

/** Pie de cada página: reserva, numeración y razón social (7 pt, gris). */
function pie(reserva: string): string {
  const r = reserva.replace(/[^\w-]/g, '')
  return `<div style="width:100%;font-family:Arial,sans-serif;font-size:7px;color:#626c7e;padding:0 36px;display:flex;justify-content:space-between">
<span>Contrato TW-${r} · VAMOS POR MÁS S.A.S. · NIT 900537199-7 · RNT 27287</span>
<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`
}

export async function pdfDeUrl(url: string, reserva: string): Promise<Buffer> {
  const puppeteer = (await import('puppeteer-core')).default
  let executablePath: string
  let args: string[] = []
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    executablePath = await chromium.executablePath()
    args = chromium.args
  } else {
    executablePath = chromeLocal()
  }

  const browser = await puppeteer.launch({ executablePath, args, headless: true })
  try {
    const page = await browser.newPage()
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (bypass && process.env.VERCEL_ENV !== 'production') {
      await page.setExtraHTTPHeaders({ 'x-vercel-protection-bypass': bypass })
    }
    const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 })
    if (!res?.ok()) throw new Error(`La página de impresión respondió ${res?.status() ?? 'sin respuesta'}`)
    await page.evaluate(() => document.fonts.ready)
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '10mm', bottom: '14mm', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: pie(reserva),
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
