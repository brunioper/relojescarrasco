import Link from "next/link";
import { Instagram, MessageCircle, Watch } from "lucide-react";
import { getPublicSettings } from "@/services/settings";
import { CURRENCY_DISCLAIMER } from "@/lib/formatting/currency";
import { MobileNav } from "@/components/public/mobile-nav";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/sobre-nosotros", label: "Sobre nosotros" },
  { href: "/contacto", label: "Contacto" },
] as const;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Logo provisorio de Relojes Carrasco */}
          <Link href="/" className="flex items-center gap-2" aria-label={settings.businessName}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/60 text-gold">
              <Watch className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span className="font-serif text-lg tracking-wide">{settings.businessName}</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {settings.whatsappNumber && (
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </nav>

          <MobileNav
            links={[...NAV_LINKS]}
            whatsappNumber={settings.whatsappNumber}
            businessName={settings.businessName}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
          <div>
            <p className="font-serif text-lg">{settings.businessName}</p>
            <p className="mt-2 text-sm text-primary-foreground/70">{settings.footerText}</p>
            {settings.address && (
              <p className="mt-2 text-sm text-primary-foreground/70">{settings.address}</p>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/80">
              Navegación
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary-foreground/70 hover:text-primary-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/privacidad" className="text-primary-foreground/70 hover:text-primary-foreground">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link href="/terminos" className="text-primary-foreground/70 hover:text-primary-foreground">
                  Términos y condiciones
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/80">
              Contacto
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {settings.whatsappNumber && (
                <li>
                  <a
                    href={`https://wa.me/${settings.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </li>
              )}
              {settings.instagramUrl && (
                <li>
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground"
                  >
                    <Instagram className="h-4 w-4" /> Instagram
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="text-primary-foreground/70 hover:text-primary-foreground"
                  >
                    {settings.contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/10">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <p className="text-xs leading-relaxed text-primary-foreground/50">{CURRENCY_DISCLAIMER}</p>
            <p className="mt-2 text-xs text-primary-foreground/50">
              © {new Date().getFullYear()} {settings.businessName}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
