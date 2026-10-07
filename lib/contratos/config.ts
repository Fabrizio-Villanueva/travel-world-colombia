/**
 * Contrato propio con firma electrónica: constantes compartidas.
 * Los IDs de GHL salen de scripts/ghl-crear-campos-contrato.mjs (carpeta
 * Contrato de la oportunidad) y de docs/ghl-twc-mapa.md (pipeline).
 */

/** Días que el enlace de firma sirve para firmar. */
export const DIAS_VIGENCIA_CONTRATO = 15
/** Horas que dura el acceso tras verificar el código (cookie firmada). */
export const HORAS_ACCESO_CONTRATO = 12
/** Bucket privado con los trazos de firma (PNG) y los PDF firmados. */
export const BUCKET_CONTRATOS = 'contratos'
/** Tope del PNG de la firma que manda el navegador. */
export const MAX_BYTES_FIRMA = 400_000

export const CAMPOS_CONTRATO = {
  link: 'Ypegk5NGJz2BxwPeDLvJ', //    Link del contrato
  estado: '7yL8JdhJSgDDtF7gdZpM', //  Estado del contrato (Enviado/Visto/Firmado/Anulado)
  pdf: 't8bIRDEiXjY3NdfJPhLA', //     Contrato firmado (PDF) — enlace del panel
  enviar: 'EdPNxTWoXR9j09mMkZjX', //  Enviar contrato al cliente (Enviar/Reenviar) → workflow
} as const

export type EstadoContratoGhl = 'Enviado' | 'Visto' | 'Firmado' | 'Anulado'

/** 🗂️ Reservaciones: el contrato mueve la tarjeta solo dentro de este pipeline. */
export const PIPELINE_RESERVACIONES = 'Jq7CxjuirY9Gu44el0bs'
export const ETAPA_CONTRATO_ENVIADO = '9c94de93-0e54-4925-9901-f6bf8c6f57b6' // 📤 Contrato Enviado
export const ETAPA_CONTRATO_FIRMADO = 'ecdf4a60-5ef6-4b21-b61c-0103fec0e146' // ✍️ Contrato Firmado

export function urlContrato(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/contrato/${token}`
}
