import type { Metadata } from "next";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { getPublicSettings } from "@/services/settings";
import { ContactForm } from "@/components/public/contact-form";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contactá a Relojes Carrasco por Instagram, WhatsApp o email. Local en Carrasco, Montevideo.",
  alternates: { canonical: "/contacto" },
};

export default async function ContactPage() {
  const settings = await getPublicSettings();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 md:pt-14">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
        Atención personal
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Contacto</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        La forma más rápida de contactarnos es por mensaje directo de Instagram. Respondemos consultas
        sobre relojes del catálogo, tasaciones y compras.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          {settings.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-sm border p-5 transition-colors hover:bg-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Instagram className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-medium">Instagram</p>
                <p className="text-base text-muted-foreground">Mensaje directo y relojes recién llegados</p>
              </div>
            </a>
          )}
          {settings.whatsappNumber && (
            <a
              href={`https://wa.me/${settings.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-sm border p-5 transition-colors hover:bg-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1fb958]">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-medium">WhatsApp</p>
                <p className="text-base text-muted-foreground">Respuesta en el día</p>
              </div>
            </a>
          )}
          {settings.contactEmail && (
            <a
              href={`mailto:${settings.contactEmail}`}
              className="flex items-center gap-4 rounded-sm border p-5 transition-colors hover:bg-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-medium">Email</p>
                <p className="text-base text-muted-foreground">{settings.contactEmail}</p>
              </div>
            </a>
          )}
          {settings.address && (
            <div className="flex items-center gap-4 rounded-sm border p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-medium">Ubicación</p>
                <p className="text-base text-muted-foreground">{settings.address}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-sm border bg-card p-6 md:p-8">
          <h2 className="font-serif text-2xl">Envianos tu consulta</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Completá el formulario y abriremos Instagram con tu mensaje copiado, listo para pegar.
          </p>
          <ContactForm instagramUrl={settings.instagramUrl} />
        </div>
      </div>
    </div>
  );
}
