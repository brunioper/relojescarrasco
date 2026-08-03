import type { Metadata } from "next";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { getPublicSettings } from "@/services/settings";
import { ContactForm } from "@/components/public/contact-form";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contactá a Relojes Carrasco por WhatsApp, Instagram o email.",
};

export default async function ContactPage() {
  const settings = await getPublicSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-serif text-3xl md:text-4xl">Contacto</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        La forma más rápida de contactarnos es por WhatsApp. Respondemos consultas sobre relojes del
        catálogo, tasaciones y compras.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          {settings.whatsappNumber && (
            <a
              href={`https://wa.me/${settings.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1fb958]">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-sm text-muted-foreground">Respuesta en el día</p>
              </div>
            </a>
          )}
          {settings.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Instagram className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">Instagram</p>
                <p className="text-sm text-muted-foreground">Novedades y relojes recién llegados</p>
              </div>
            </a>
          )}
          {settings.contactEmail && (
            <a
              href={`mailto:${settings.contactEmail}`}
              className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{settings.contactEmail}</p>
              </div>
            </a>
          )}
          {settings.address && (
            <div className="flex items-center gap-4 rounded-xl border p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">Ubicación</p>
                <p className="text-sm text-muted-foreground">{settings.address}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-medium">Envianos tu consulta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completá el formulario y abriremos WhatsApp con tu mensaje listo para enviar.
          </p>
          <ContactForm whatsappNumber={settings.whatsappNumber} />
        </div>
      </div>
    </div>
  );
}
