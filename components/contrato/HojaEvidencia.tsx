import type { EventoContrato } from '@/lib/contratos/registro'
import s from './HojaEvidencia.module.css'

/**
 * Hoja de evidencia de la firma electrónica: va al final del PDF firmado.
 * Reúne quién, cuándo, desde dónde y cómo se verificó, más la huella del
 * contenido firmado (SHA-256 de la foto congelada del contrato).
 */

export interface DatosEvidencia {
  id: string
  reserva: string | null
  titular: string | null
  datos_sha256: string
  creado_por: string
  creado_en: string
  firmado_en: string | null
  firmante_nombre: string | null
  firmante_documento: string | null
  firma_ip: string | null
  firma_ua: string | null
  eventos: EventoContrato[]
}

const ETIQUETA: Record<EventoContrato['tipo'], string> = {
  creado: 'Contrato emitido',
  codigo_enviado: 'Código de acceso enviado',
  verificado: 'Código verificado',
  visto: 'Contrato abierto por el titular',
  firmado: 'Contrato firmado',
  pdf: 'PDF generado',
  anulado: 'Contrato anulado',
  descargado: 'PDF descargado',
  copia_reenviada: 'Copia firmada reenviada',
}

function hora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'medium',
  }) + ' (hora de Colombia)'
}

export function HojaEvidencia({ c }: { c: DatosEvidencia }) {
  const eventos = c.eventos.filter(e => e.tipo !== 'pdf' && e.tipo !== 'descargado' && e.tipo !== 'copia_reenviada')
  return (
    <section className={s.hoja} lang="es">
      <p className={s.eyebrow}>Travel World Colombia · VAMOS POR MÁS S.A.S.</p>
      <h2 className={s.titulo}>Hoja de evidencia de firma electrónica</h2>
      <p className={s.intro}>
        Este registro forma parte integral del contrato de la reserva TW-{c.reserva}. Resume cómo el
        titular accedió al documento, se identificó y lo firmó.
      </p>

      <table className={s.tabla}>
        <tbody>
          <tr><th>Contrato</th><td>Reserva TW-{c.reserva} · ID <span className={s.mono}>{c.id}</span></td></tr>
          <tr><th>Firmante</th><td>{c.firmante_nombre} · {c.firmante_documento}</td></tr>
          <tr><th>Titular registrado</th><td>{c.titular}</td></tr>
          <tr><th>Fecha y hora de la firma</th><td>{hora(c.firmado_en)}</td></tr>
          <tr><th>Dirección IP</th><td className={s.mono}>{c.firma_ip}</td></tr>
          <tr><th>Dispositivo / navegador</th><td className={s.mono}>{c.firma_ua}</td></tr>
          <tr><th>Emitido por</th><td>{c.creado_por} · {hora(c.creado_en)}</td></tr>
          <tr>
            <th>Huella del contenido firmado (SHA-256)</th>
            <td className={s.mono}>{c.datos_sha256}</td>
          </tr>
        </tbody>
      </table>

      <h3 className={s.subtitulo}>Registro de eventos</h3>
      <table className={s.tabla}>
        <tbody>
          {eventos.map((e, i) => (
            <tr key={i}>
              <th>{ETIQUETA[e.tipo]}</th>
              <td>
                {hora(e.en)}
                {e.detalle ? ` · ${e.detalle}` : ''}
                {e.ip ? ` · IP ${e.ip}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={s.legal}>
        Firma electrónica realizada conforme a la Ley 527 de 1999 y al Decreto 2364 de 2012 (compilado en el
        Decreto 1074 de 2015). El titular se identificó con un código de un solo uso enviado a su WhatsApp o
        correo registrado, leyó el contrato completo, aceptó expresamente sus condiciones y trazó su firma. La
        huella SHA-256 permite comprobar que el contenido no fue modificado después de emitido; la huella del
        PDF final queda registrada en el sistema de la agencia.
      </p>
    </section>
  )
}
