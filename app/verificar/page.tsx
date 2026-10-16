import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, LegalH2, LegalP, LegalList, LegalAviso } from '@/components/legal/LegalShell'
import { SITE } from '@/lib/site'
import { AVISO_VISTA_PREVIA, EMAIL_OFICIAL, getAvisoSeguridad, numeroLegible } from '@/lib/aviso-seguridad'
import { Verificador } from './Verificador'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Verifica que hablas con nosotros',
  description: `Cómo reconocer a ${SITE.nombre} y evitar estafas: único WhatsApp oficial, correo, cuentas de pago y qué hacer si te contactan desde otro número.`,
  alternates: { canonical: '/verificar' },
  openGraph: {
    title: 'Verifica que hablas con Travel World Colombia',
    description: AVISO_VISTA_PREVIA,
  },
}

/** Página antisuplantación (16-oct-2026): a ella lleva la franja de alerta de todo el sitio. */
export default async function VerificarPage() {
  const aviso = await getAvisoSeguridad()
  const numeros = aviso.numeros.map(numeroLegible)

  return (
    <LegalShell
      tag="Seguridad"
      titulo={<>Verifica que hablas <span style={{ color: 'var(--orange)' }}>con nosotros</span></>}
      intro="Hay personas que se hacen pasar por nuestra agencia y envían este sitio web como prueba. Antes de pagar o enviar tus datos, confirma aquí que de verdad hablas con Travel World Colombia."
    >
      <LegalAviso>
        <strong style={{ color: 'var(--text-primary)' }}>
          {numeros.length === 1 ? 'Nuestro único WhatsApp oficial es ' : 'Nuestros únicos WhatsApp oficiales son '}
          {numeros.join(' y ')}.
        </strong>{' '}
        Si alguien te escribe desde otro número diciendo que es de Travel World Colombia, no somos nosotros.
      </LegalAviso>

      <LegalH2>¿Te escribieron desde otro número? Verifícalo</LegalH2>
      <LegalP>Escribe el número que te contactó y te decimos si es nuestro.</LegalP>
      <Verificador oficiales={aviso.numeros} />

      <LegalH2>Nuestros canales oficiales</LegalH2>
      <LegalList
        items={[
          <>WhatsApp: <strong style={{ color: 'var(--text-primary)' }}>{numeros.join(' · ')}</strong></>,
          <>Correo: <a href={`mailto:${EMAIL_OFICIAL}`} className="underline hover:text-orange">{EMAIL_OFICIAL}</a></>,
          <>Sitio web: <strong style={{ color: 'var(--text-primary)' }}>travelworldcolombia.com</strong> (revisa que la dirección sea exactamente esta)</>,
          <>Oficina: {SITE.direccion}, {SITE.ciudad}, {SITE.region}</>,
          <>Registro Nacional de Turismo: RNT {SITE.rnt} — <a href={SITE.rntVerificarUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-orange">verifícalo en el registro oficial</a></>,
        ]}
      />

      <LegalH2>Cómo pagar de forma segura</LegalH2>
      <LegalP>
        Solo recibimos pagos en las cuentas a nombre de <strong style={{ color: 'var(--text-primary)' }}>Vamos Por Más S.A.S.</strong> o
        de Travel World Colombia que aparecen en nuestra página de{' '}
        <Link href="/pagos" className="underline hover:text-orange">Pagos</Link>. Nunca te pediremos consignar a la cuenta de una
        persona natural ni a un Nequi o Daviplata personal.
      </LegalP>

      <LegalH2>Señales de que puede ser una estafa</LegalH2>
      <LegalList
        items={[
          'Te escriben desde un número distinto al oficial, aunque usen nuestro logo, fotos o este sitio web.',
          'El precio es mucho más bajo que el de cualquier agencia, o te ofrecen un “cupo de última hora”.',
          'Te presionan para pagar ya, “antes de que se acabe la promoción”.',
          'Te piden consignar a una persona, a un Nequi o Daviplata personal, o a una cuenta que no está en Pagos.',
          'Te piden códigos que te llegan por mensaje de texto o WhatsApp.',
        ]}
      />

      <LegalH2>Si crees que te están estafando</LegalH2>
      <LegalList
        items={[
          <>No envíes dinero ni fotos de tus documentos.</>,
          <>Escríbenos a nuestro WhatsApp oficial ({numeros.join(' o ')}) para confirmar la oferta.</>,
          <>Denuncia en el <a href="https://caivirtual.policia.gov.co" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange">CAI Virtual de la Policía Nacional</a> y reporta el número en WhatsApp.</>,
        ]}
      />
    </LegalShell>
  )
}
