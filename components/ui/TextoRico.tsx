import { Fragment } from 'react'

/**
 * Renderiza un texto editable del panel: los saltos de línea se respetan y lo
 * que va entre asteriscos (`*así*`) sale en el color de acento del tema.
 * Sin HTML: el texto viene de la base y nunca se inyecta como markup.
 */
export function TextoRico({ texto }: { texto: string }) {
  const lineas = texto.split('\n')
  return (
    <>
      {lineas.map((linea, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {conAcentos(linea)}
        </Fragment>
      ))}
    </>
  )
}

function conAcentos(linea: string) {
  return linea.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
    parte.length > 2 && parte.startsWith('*') && parte.endsWith('*') ? (
      <span key={i} style={{ color: 'var(--orange)' }}>
        {parte.slice(1, -1)}
      </span>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    )
  )
}
