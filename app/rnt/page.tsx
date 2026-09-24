import type { Metadata } from 'next'
import { LegalShell, LegalH2, LegalP, LegalList } from '@/components/legal/LegalShell'
import { SITE } from '@/lib/site'
import { NuevaPestana } from '@/components/ui/NuevaPestana'

export const metadata: Metadata = {
  title: 'Registro Nacional de Turismo',
  description: `${SITE.nombre} opera legalmente con Registro Nacional de Turismo: RNT ${SITE.rnt} (agencia de viajes y turismo) y RNT ${SITE.rntMayorista} (agencia de viajes mayorista).`,
  alternates: { canonical: '/rnt' },
}

export default function RntPage() {
  return (
    <LegalShell
      tag="Legalidad"
      titulo={
        <>
          Registro Nacional de <span style={{ color: 'var(--orange)' }}>Turismo</span>
        </>
      }
      intro="Somos una agencia legalmente constituida e inscrita en el Registro Nacional de Turismo de Colombia, requisito obligatorio para todos los prestadores de servicios turísticos del país."
    >
      <LegalH2>Nuestros registros</LegalH2>
      <LegalList
        items={[
          <>
            <strong style={{ color: 'var(--text-primary)' }}>RNT {SITE.rnt}</strong> — Agencia
            de viajes y turismo.
          </>,
          <>
            <strong style={{ color: 'var(--text-primary)' }}>RNT {SITE.rntMayorista}</strong> — Agencia de
            viajes mayorista.
          </>,
        ]}
      />

      <LegalP>
        Puedes verificar la vigencia de nuestros registros en el portal oficial del Registro
        Nacional de Turismo, administrado por las Cámaras de Comercio a través del RUES:{' '}
        <a
          href={SITE.rntVerificarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors hover:text-orange"
          style={{ color: 'var(--text-primary)' }}
        >
          rues.org.co/registro-nt
          <NuevaPestana />
        </a>
        .
      </LegalP>

      <LegalH2>¿Por qué importa?</LegalH2>
      <LegalP>
        El RNT es la garantía de que una agencia opera bajo la Ley General de Turismo
        (Ley 300 de 1996) y sus normas complementarias: responde ante las autoridades,
        cuenta con la inscripción mercantil al día y está sujeta a la vigilancia del
        Ministerio de Comercio, Industria y Turismo. Antes de comprar un plan turístico con
        cualquier empresa, verifica siempre que su RNT esté vigente.
      </LegalP>
    </LegalShell>
  )
}
