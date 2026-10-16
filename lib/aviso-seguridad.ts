import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/publico'
import { SITE, WHATSAPP } from '@/lib/site'
import { numeroLegible, parsearNumeros } from './aviso-seguridad-numeros'

export { normalizarNumero, numeroLegible, parsearNumeros } from './aviso-seguridad-numeros'

/**
 * Aviso antisuplantación (16-oct-2026): estafadores mandan la web como
 * "prueba" de que son la agencia y escriben desde otro número. La franja de
 * todo el sitio, la página /verificar y la vista previa del enlace en
 * WhatsApp dicen cuál es el único número oficial.
 *
 * Editable en el panel ("Aviso de seguridad", tabla `aviso_seguridad`). Sin
 * fila guardada, o si la lectura falla, valen estos valores.
 */

export const EMAIL_OFICIAL = SITE.email

export interface AvisoSeguridad {
  activo: boolean
  /** Pop-up al entrar al sitio (public/images/aviso-canales-oficiales.webp). */
  popup: boolean
  mensaje: string
  /** Solo dígitos con indicativo: "573204891930". */
  numeros: string[]
}

export const AVISO_POR_DEFECTO: AvisoSeguridad = {
  activo: true,
  popup: true,
  mensaje: 'Cuidado con estafas: solo te atendemos por WhatsApp desde nuestro número oficial. Si te escriben desde otro número, no somos nosotros.',
  numeros: [WHATSAPP.principal, WHATSAPP.alterno],
}

/** Frase para la vista previa del enlace (WhatsApp, Facebook…): número primero, se corta poco. */
export const AVISO_VISTA_PREVIA = `⚠️ WhatsApp oficiales: ${numeroLegible(WHATSAPP.principal)} y ${numeroLegible(WHATSAPP.alterno)}. Si te escriben desde otro número, no somos nosotros.`

export const getAvisoSeguridad = cache(async function getAvisoSeguridad(): Promise<AvisoSeguridad> {
  try {
    const { data, error } = await createPublicClient()
      .from('aviso_seguridad')
      .select('activo, popup_activo, mensaje, numeros')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      console.error('getAvisoSeguridad error:', error.message)
      return AVISO_POR_DEFECTO
    }
    if (!data) return AVISO_POR_DEFECTO
    const numeros = parsearNumeros(data.numeros as string)
    return {
      activo: data.activo as boolean,
      popup: data.popup_activo as boolean,
      mensaje: (data.mensaje as string).trim() || AVISO_POR_DEFECTO.mensaje,
      numeros: numeros.length ? numeros : AVISO_POR_DEFECTO.numeros,
    }
  } catch (err) {
    console.error('getAvisoSeguridad excepción:', (err as Error).message)
    return AVISO_POR_DEFECTO
  }
})
