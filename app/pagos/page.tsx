import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { DollarSign, ShieldCheck, MessageCircle, ExternalLink } from 'lucide-react'
import { SectionTag } from '@/components/ui/SectionTag'
import { BotonCopiar } from '@/components/ui/BotonCopiar'
import { NuevaPestana } from '@/components/ui/NuevaPestana'
import { WHATSAPP } from '@/lib/site'

/**
 * Página de pagos, rescatada del WordPress viejo (snapshot Wayback 2026-06-14):
 * botón PSE (portal de pagos Davivienda del comercio Vamos Por Más SAS), pago
 * con tarjeta (datáfono virtual de Prix, +5%), consignación nacional
 * (Bancolombia / Davivienda) y pagos en dólares: en línea desde Colombia (Prix)
 * o desde EE. UU. (Zelle / Chase).
 */

export const metadata: Metadata = {
  title: 'Pagos',
  description:
    'Paga tu viaje de forma segura: PSE sin costo, tarjeta de crédito, consignación en Bancolombia o Davivienda, y pagos en dólares desde Colombia o por Zelle y Chase desde Estados Unidos.',
  alternates: { canonical: '/pagos' },
}

const PSE_URL = 'https://portalpagos.davivienda.com/#/comercio/9012/VAMOS%20POR%20MAS%20SAS'
const TARJETA_URL = 'https://app.prix.la/pay/3fa8934a281d1d399913c69f18e5b0a9c9c3726e6e2123dc3bb421d73ea67265'
/** Datáfono virtual de Prix para cobrar en dólares a clientes en Colombia. */
const DOLARES_COLOMBIA_URL = 'https://app.prix.la/pay/ac7c4d06d8e3b3902b80c58f32758166550a396ff8492bb74169dbe4a2365676'

/** Logos de los medios de pago (en /public/img/pagos, recortados a 160 px de alto). */
const LOGOS = {
  pse: { src: '/img/pagos/pse.png', w: 160, h: 160 },
  visa: { src: '/img/pagos/visa.png', w: 492, h: 160 },
  mastercard: { src: '/img/pagos/mastercard.png', w: 206, h: 160 },
  amex: { src: '/img/pagos/amex.png', w: 219, h: 160 },
  bancolombia: { src: '/img/pagos/bancolombia.png', w: 680, h: 160 },
  davivienda: { src: '/img/pagos/davivienda.png', w: 800, h: 74 },
  zelle: { src: '/img/pagos/zelle.png', w: 303, h: 160 },
  chase: { src: '/img/pagos/chase.png', w: 855, h: 160 },
} as const

const TARJETAS = [
  { logo: LOGOS.visa, alt: 'Visa' },
  { logo: LOGOS.mastercard, alt: 'Mastercard' },
  { logo: LOGOS.amex, alt: 'American Express' },
]

const CUENTAS_COLOMBIA = [
  { banco: 'Bancolombia', tipo: 'Cuenta de ahorros', numero: '264-133178-51', logo: LOGOS.bancolombia },
  { banco: 'Davivienda', tipo: 'Cuenta corriente', numero: '406-169997292', logo: LOGOS.davivienda },
]

const CUENTAS_USA = [
  { banco: 'Zelle', tipo: 'Referencia de pago', numero: 'vamospormasusa@gmail.com', logo: LOGOS.zelle },
  { banco: 'Chase Bank', tipo: 'Cuenta corriente', numero: '53-18-59-687', logo: LOGOS.chase },
]

const whatsappComprobante = `https://wa.me/${WHATSAPP.principal}?text=${encodeURIComponent(
  'Hola! Acabo de realizar un pago y quiero enviar mi comprobante 🧾'
)}`

function TarjetaCuenta({
  banco, tipo, numero, logo,
}: {
  banco: string
  tipo: string
  numero: string
  logo: { src: string; w: number; h: number }
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5"
      style={{ background: '#fff', border: '1px solid var(--border)' }}
    >
      <div className="flex min-w-0 items-center gap-4">
        {/* Caja fija + object-contain: los logos tienen proporciones muy distintas. */}
        <span className="relative h-10 w-24 shrink-0 sm:w-28">
          <Image src={logo.src} alt="" fill sizes="112px" className="object-contain object-left" />
        </span>
        <div className="min-w-0">
          <p className="font-inter text-xs" style={{ color: 'var(--text-dim)' }}>
            {banco} · {tipo}
          </p>
          <p className="mt-0.5 break-all font-plus-jakarta text-lg font-extrabold tracking-wide" style={{ color: 'var(--text-primary)' }}>
            {numero}
          </p>
        </div>
      </div>
      <BotonCopiar
        texto={numero}
        ariaLabel={numero.includes('@') ? `Copiar correo de ${banco}` : `Copiar número de cuenta ${banco}`}
      />
    </div>
  )
}

export default function PagosPage() {
  return (
    <div className="tema-claro">
      {/* ── Hero strip ── */}
      <section
        className="tema-oscuro relative overflow-hidden pt-32 pb-16 px-6"
        style={{ background: 'linear-gradient(to bottom, rgba(13, 30, 60,0.98), var(--navy))' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--orange) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-6xl">
          <SectionTag className="mb-4">Paga seguro</SectionTag>
          <h1 className="font-plus-jakarta text-4xl font-extrabold leading-tight sm:text-6xl" style={{ color: 'var(--text-primary)' }}>
            Pagos
          </h1>
          <p className="mt-5 max-w-lg font-inter text-sm leading-relaxed sm:text-base" style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
            Elige el medio que prefieras: pago en línea con PSE o tarjeta, consignación en
            Colombia, o pagos en dólares desde Colombia y Estados Unidos.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* ── Pagos en línea ── */}
        <section className="mb-14">
          <h2 className="mb-6 font-plus-jakarta text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            Paga en línea
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* PSE */}
            <div className="flex flex-col gap-4 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
              <Image
                src={LOGOS.pse.src}
                alt=""
                width={LOGOS.pse.w}
                height={LOGOS.pse.h}
                className="h-14 w-14 rounded-full"
              />
              <div className="flex-1">
                <h3 className="font-plus-jakarta text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Pagos con PSE
                </h3>
                <p className="mt-1.5 font-inter text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                  Paga desde cualquier banco en Colombia <strong>sin costo</strong> con el botón de
                  PSE, a través del portal de pagos de Davivienda.
                </p>
              </div>
              <a
                href={PSE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-plus-jakarta text-sm font-bold transition-transform duration-150 active:scale-[0.99]"
                style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
              >
                Haz tu pago aquí<span className="sr-only"> con PSE</span> <ExternalLink size={15} aria-hidden />
                <NuevaPestana />
              </a>
            </div>

            {/* Tarjeta de crédito */}
            <div className="flex flex-col gap-4 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
              <div className="flex h-14 items-center gap-2">
                {TARJETAS.map(t => (
                  <span
                    key={t.alt}
                    className="relative flex h-12 w-[4.25rem] items-center justify-center rounded-lg p-1.5"
                    style={{ background: '#fff', border: '1px solid var(--border)' }}
                  >
                    <span className="relative h-full w-full">
                      <Image src={t.logo.src} alt={t.alt} fill sizes="68px" className="object-contain" />
                    </span>
                  </span>
                ))}
              </div>
              <div className="flex-1">
                <h3 className="font-plus-jakarta text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Tarjeta de crédito
                </h3>
                <p className="mt-1.5 font-inter text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                  Paga con tu tarjeta a través de nuestro datáfono virtual. Este medio genera un
                  suplemento del <strong>5%</strong>, que se adiciona al momento de realizar la
                  transacción.
                </p>
              </div>
              <a
                href={TARJETA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-plus-jakarta text-sm font-bold transition-transform duration-150 active:scale-[0.99]"
                style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
              >
                Haz tu pago aquí<span className="sr-only"> con tarjeta de crédito</span> <ExternalLink size={15} aria-hidden />
                <NuevaPestana />
              </a>
            </div>
          </div>
        </section>

        {/* ── Consignación en Colombia ── */}
        <section className="mb-14">
          <h2 className="mb-2 font-plus-jakarta text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            Consignación en Colombia
          </h2>
          <p className="mb-6 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Consigna o transfiere a nuestras cuentas nacionales.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CUENTAS_COLOMBIA.map(c => (
              <TarjetaCuenta key={c.numero} {...c} />
            ))}
          </div>
        </section>

        {/* ── Pagos en dólares: desde Colombia (en línea) y desde Estados Unidos ── */}
        <section className="mb-14">
          <h2 className="mb-2 flex items-center gap-2.5 font-plus-jakarta text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            <DollarSign size={26} style={{ color: 'var(--orange)' }} aria-hidden />
            Pagos en dólares
          </h2>
          <p className="mb-8 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Paga en dólares en línea desde Colombia, o desde Estados Unidos por Zelle o Chase Bank.
          </p>

          <h3 className="mb-3 font-plus-jakarta text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Desde Colombia
          </h3>
          <div
            className="mb-10 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
            style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
              >
                <DollarSign size={22} aria-hidden />
              </span>
              <div>
                <p className="font-plus-jakarta text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Pago en dólares desde Colombia
                </p>
                <p className="mt-1 max-w-xl font-inter text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                  Si tu viaje está cotizado en dólares, págalo en línea desde Colombia a través de
                  nuestro datáfono virtual.
                </p>
              </div>
            </div>
            <a
              href={DOLARES_COLOMBIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-plus-jakarta text-sm font-bold transition-transform duration-150 active:scale-[0.99]"
              style={{ background: 'var(--orange)', color: 'var(--orange-contrast)' }}
            >
              Haz tu pago aquí<span className="sr-only"> en dólares desde Colombia</span> <ExternalLink size={15} aria-hidden />
              <NuevaPestana />
            </a>
          </div>

          <h3 className="mb-1 font-plus-jakarta text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Desde Estados Unidos
          </h3>
          <p className="mb-4 font-inter text-sm" style={{ color: 'var(--text-dim)' }}>
            Si estás en Estados Unidos, puedes pagar por Zelle o consignar en nuestra cuenta de
            Chase Bank.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CUENTAS_USA.map(c => (
              <TarjetaCuenta key={c.numero} {...c} />
            ))}
          </div>
        </section>

        {/* ── Aviso de seguridad + comprobante ── */}
        <section
          className="flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
          style={{ background: 'var(--navy)' }}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--gold)' }}>
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="font-plus-jakarta text-base font-bold text-white">
                Paga solo a las cuentas publicadas en esta página
              </p>
              <p className="mt-1 max-w-xl font-inter text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Nuestros únicos números autorizados para información, ventas y reservas son{' '}
                <strong className="text-white">320 489 1930</strong> y{' '}
                <strong className="text-white">300 569 3381</strong>. Después de pagar, envíanos tu
                comprobante por WhatsApp para confirmar tu reserva.
              </p>
            </div>
          </div>
          <a
            href={whatsappComprobante}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-plus-jakarta text-sm font-bold transition-transform duration-150 active:scale-[0.99]"
            style={{ background: 'var(--gold)', color: 'var(--navy)' }}
          >
            <MessageCircle size={17} aria-hidden />
            Enviar comprobante
            <NuevaPestana />
          </a>
        </section>

        {/* ── Aviso legal: pagar implica aceptar los términos de la agencia ── */}
        <p className="mt-6 font-inter text-xs leading-relaxed sm:text-sm" style={{ color: 'var(--text-dim)' }}>
          Al realizar un pago por cualquiera de los medios de esta página, declaras que conoces y
          aceptas nuestros{' '}
          <Link href="/terminos-y-condiciones" className="font-semibold underline underline-offset-2" style={{ color: 'var(--text-primary)' }}>
            Términos y condiciones
          </Link>
          , incluidas las condiciones de reserva, cambios, cancelaciones y reembolsos, y nuestra{' '}
          <Link href="/privacidad" className="font-semibold underline underline-offset-2" style={{ color: 'var(--text-primary)' }}>
            Política de privacidad
          </Link>
          . Si tienes dudas, escríbenos antes de pagar.
        </p>
      </div>
    </div>
  )
}
