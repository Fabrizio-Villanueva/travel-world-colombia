import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Mail, Clock, Lock } from 'lucide-react'
import { SITE, SOCIALS, WHATSAPP, NAV_LINKS, whatsappUrl } from '@/lib/site'
import { NuevaPestana, NUEVA_PESTANA } from '@/components/ui/NuevaPestana'

type IconProps = { size?: number }

function FacebookIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

function InstagramIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.35 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 002.12-1.38 5.86 5.86 0 001.38-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 00-1.38-2.12A5.86 5.86 0 0019.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zm0 10.16a4 4 0 110-8 4 4 0 010 8zm6.41-10.4a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
    </svg>
  )
}

function YoutubeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 00.5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 002.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 002.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
    </svg>
  )
}

function TikTokIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  )
}

const socialLinks = [
  { href: SOCIALS.facebook, label: 'Facebook', Icon: FacebookIcon },
  { href: SOCIALS.instagram, label: 'Instagram', Icon: InstagramIcon },
  { href: SOCIALS.youtube, label: 'YouTube', Icon: YoutubeIcon },
  { href: SOCIALS.tiktok, label: 'TikTok', Icon: TikTokIcon },
]

export function Footer() {
  return (
    <footer
      className="border-t"
      style={{ background: 'var(--dark)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        {/* Marca + redes */}
        <div className="md:col-span-2">
          <Image
            src="/images/travel-world-colombia-logo-blanco.png"
            alt={SITE.nombre}
            width={192}
            height={50}
            className="h-10 w-auto"
          />
          <p className="mt-4 max-w-sm font-inter text-[13px] leading-relaxed">
            Agencia de viajes en {SITE.ciudad}, {SITE.region}. Paquetes nacionales e
            internacionales todo incluido. Más de {SITE.familias} familias han viajado con nosotros.
          </p>
          <div className="mt-5 flex gap-3">
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label}${NUEVA_PESTANA}`}
                className="flex h-9 w-9 items-center justify-center rounded-sm border transition-all hover:border-orange hover:text-orange"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <Icon size={18} aria-hidden />
              </a>
            ))}
          </div>
        </div>

        {/* Navegación */}
        <div>
          <h3 className="font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase text-orange">
            Navegación
          </h3>
          <ul className="mt-4 space-y-2">
            {NAV_LINKS.map(link => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-inter text-[13px] transition-colors hover:text-orange"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contacto / NAP */}
        <div>
          <h3 className="font-plus-jakarta text-[11px] font-bold tracking-[0.12em] uppercase text-orange">
            Contacto
          </h3>
          <ul className="mt-4 space-y-3 font-inter text-[13px]">
            <li className="flex gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-orange" />
              <span>
                {SITE.nombre}<br />
                {SITE.direccion}<br />
                {SITE.ciudad}, {SITE.region}, {SITE.pais}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={16} className="shrink-0 text-orange" />
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-orange">
                {WHATSAPP.telefonoDisplay}
                <span className="sr-only"> por WhatsApp</span>
                <NuevaPestana />
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={16} className="shrink-0 text-orange" />
              <a href={`mailto:${SITE.email}`} className="hover:text-orange">{SITE.email}</a>
            </li>
            <li className="flex items-center gap-2">
              <Clock size={16} className="shrink-0 text-orange" />
              <span>{SITE.horario}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
        {/* Enlaces legales */}
        <nav
          aria-label="Enlaces legales"
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-6 pt-5 font-inter text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          {[
            { href: '/terminos-y-condiciones', label: 'Términos y condiciones' },
            { href: '/privacidad', label: 'Privacidad' },
            { href: '/sostenibilidad', label: 'Sostenibilidad' },
            { href: '/codigo-de-conducta', label: 'Turista responsable' },
          ].map(link => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-orange">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 font-inter text-[12px] md:flex-row">
          <p>© {new Date().getFullYear()} {SITE.nombre}. Todos los derechos reservados.</p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5" style={{ color: 'var(--text-muted)' }}>
            <Link href="/rnt" className="transition-colors hover:text-orange">
              Registro Nacional de Turismo · RNT {SITE.rnt}
            </Link>
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 transition-colors hover:text-orange"
            >
              <Lock size={12} />
              Iniciar sesión (personal)
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
