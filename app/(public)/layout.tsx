import Link from "next/link";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { getPublicSettings } from "@/services/settings";
import { MobileNav } from "@/components/public/mobile-nav";
import { JsonLd } from "@/components/public/json-ld";
import { MetaPixel } from "@/components/public/meta-pixel";
import { LogoMark } from "@/components/brand/logo-mark";
import { instagramDmUrl, instagramUsernameFromUrl } from "@/lib/inquiry";
import { siteUrl } from "@/lib/site";

const NAV_LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/vende-tu-reloj", label: "Vendé tu reloj" },
  { href: "/autenticidad-y-garantia", label: "Garantía" },
  { href: "/sobre-nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
] as const;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();
  const instagramUsername = instagramUsernameFromUrl(settings.instagramUrl);
  const base = siteUrl(settings.siteUrl);

  // Datos del negocio para buscadores (ficha local en Google).
  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: settings.businessName,
    url: base,
    logo: `${base}/logo.png`,
    image: `${base}/logo.png`,
    ...(settings.seoDescription ? { description: settings.seoDescription } : {}),
    address: {
      "@type": "PostalAddress",
      ...(settings.address ? { streetAddress: settings.address } : {}),
      addressLocality: "Montevideo",
      addressRegion: "Montevideo",
      addressCountry: "UY",
    },
    areaServed: "UY",
    currenciesAccepted: "USD, UYU",
    ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
    ...(settings.whatsappNumber ? { telephone: `+${settings.whatsappNumber}` } : {}),
    ...(settings.instagramUrl ? { sameAs: [settings.instagramUrl] } : {}),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={storeJsonLd} />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20">
          <Link
            href="/catalogo"
            className="flex items-center gap-2.5"
            aria-label={`${settings.businessName} — ir al catálogo`}
          >
            <LogoMark size={40} invert />
            <span className="font-serif text-lg tracking-wide lg:text-xl">
              {settings.businessName}
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-base text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline hover:decoration-gold"
              >
                {link.label}
              </Link>
            ))}
            {instagramUsername ? (
              <a
                href={instagramDmUrl(instagramUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-base text-primary-foreground hover:bg-primary/90"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Escribinos
              </a>
            ) : (
              settings.whatsappNumber && (
                <a
                  href={`https://wa.me/${settings.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-base text-primary-foreground hover:bg-primary/90"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
              )
            )}
          </nav>

          <MobileNav
            links={[...NAV_LINKS]}
            whatsappNumber={settings.whatsappNumber}
            instagramUsername={instagramUsername}
            businessName={settings.businessName}
          />
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-serif text-xl">{settings.businessName}</p>
            {settings.footerText && (
              <p className="mt-3 text-base leading-relaxed text-primary-foreground/75">
                {settings.footerText}
              </p>
            )}
            {settings.address && (
              <p className="mt-3 flex items-start gap-2 text-base text-primary-foreground/75">
                <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                {settings.address}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-foreground/80">
              Navegación
            </p>
            <ul className="mt-4 space-y-2.5 text-base">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-primary-foreground/75 hover:text-primary-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/privacidad"
                  className="text-primary-foreground/75 hover:text-primary-foreground hover:underline"
                >
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/terminos"
                  className="text-primary-foreground/75 hover:text-primary-foreground hover:underline"
                >
                  Términos y condiciones
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-foreground/80">
              Contacto
            </p>
            <ul className="mt-4 space-y-2.5 text-base">
              {settings.instagramUrl && (
                <li>
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary-foreground/75 hover:text-primary-foreground hover:underline"
                  >
                    <Instagram className="h-4 w-4" aria-hidden="true" />
                    {instagramUsername ? `@${instagramUsername}` : "Instagram"}
                  </a>
                </li>
              )}
              {settings.whatsappNumber && (
                <li>
                  <a
                    href={`https://wa.me/${settings.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary-foreground/75 hover:text-primary-foreground hover:underline"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="inline-flex items-center gap-2 text-primary-foreground/75 hover:text-primary-foreground hover:underline"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {settings.contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <p className="text-sm text-primary-foreground/60">
              © {new Date().getFullYear()} {settings.businessName}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
      {/* Medición de campañas: solo en el sitio público, nunca en el panel. */}
      <MetaPixel />
    </div>
  );
}
