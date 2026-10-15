import type { ReactNode } from 'react'
import { LegalH2, LegalList, LegalP } from './LegalShell'

/**
 * Texto de las páginas del pie de página (lib/paginas-info.ts), escrito en el
 * panel con un formato sencillo:
 *
 *   ## Subtítulo
 *   Párrafo (una línea en blanco separa párrafos; un salto simple se respeta).
 *   - Punto de una lista
 *   **negrita** · los correos y enlaces (https://…) se vuelven clic.
 *
 * Se arma con elementos de React (nunca HTML crudo): lo que se escribe en el
 * panel no puede meter scripts en la web.
 */

const ENLACE = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g

function enLinea(texto: string): ReactNode[] {
  return texto.split(ENLACE).map((t, i) => {
    if (!t) return null
    if (t.startsWith('**') && t.endsWith('**') && t.length > 4) {
      return <strong key={i} style={{ color: 'var(--text-primary)' }}>{t.slice(2, -2)}</strong>
    }
    if (/^https?:\/\//.test(t)) {
      return (
        <a key={i} href={t} target="_blank" rel="noopener noreferrer" className="break-all underline hover:text-orange">
          {t.replace(/^https?:\/\//, '')}
        </a>
      )
    }
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(t)) {
      return <a key={i} href={`mailto:${t}`} className="break-all underline hover:text-orange">{t}</a>
    }
    return t
  })
}

/** Respeta los saltos de línea simples dentro de un párrafo. */
function conSaltos(lineas: string[]): ReactNode[] {
  return lineas.flatMap((l, i) => (i === 0 ? enLinea(l) : [<br key={`br${i}`} />, ...enLinea(l)]))
}

export function TextoFormateado({ texto }: { texto: string }) {
  const bloques: ReactNode[] = []
  let parrafo: string[] = []
  let lista: string[] = []
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push(<LegalP key={bloques.length}>{conSaltos(parrafo)}</LegalP>)
    parrafo = []
  }
  const cerrarLista = () => {
    if (lista.length) bloques.push(<LegalList key={bloques.length} items={lista.map(l => enLinea(l))} />)
    lista = []
  }

  for (const cruda of texto.replace(/\r\n/g, '\n').split('\n')) {
    const linea = cruda.trim()
    if (!linea) {
      cerrarParrafo()
      cerrarLista()
    } else if (/^#{1,3}\s+/.test(linea)) {
      cerrarParrafo()
      cerrarLista()
      bloques.push(<LegalH2 key={bloques.length}>{enLinea(linea.replace(/^#{1,3}\s+/, ''))}</LegalH2>)
    } else if (/^[-•*]\s+/.test(linea)) {
      cerrarParrafo()
      lista.push(linea.replace(/^[-•*]\s+/, ''))
    } else {
      cerrarLista()
      parrafo.push(linea)
    }
  }
  cerrarParrafo()
  cerrarLista()
  return <>{bloques}</>
}
