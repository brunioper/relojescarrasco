import type { Metadata } from "next";
import { SellWatchForm } from "@/components/public/sell-watch-form";
import { getPublicSettings } from "@/services/settings";
import { instagramUsernameFromUrl } from "@/lib/inquiry";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Vendé tu reloj",
  description:
    "¿Tenés un reloj para vender? Compramos relojes en Montevideo. Contanos marca, modelo y estado y te respondemos con una valoración inicial.",
  alternates: { canonical: "/vende-tu-reloj" },
};

const STEPS = [
  [
    "Contanos qué reloj tenés",
    "Completá el formulario con la marca, el modelo y el estado. Lleva dos minutos.",
  ],
  [
    "Envianos las fotos",
    "En el mismo chat, adjuntá fotos del frente, el fondo, la corona y el brazalete o la correa.",
  ],
  [
    "Recibí una valoración inicial",
    "Con esos datos te damos una primera valoración. El valor final se confirma al revisar el reloj en persona.",
  ],
] as const;

export default async function SellYourWatchPage() {
  const settings = await getPublicSettings();
  const instagramUsername = instagramUsernameFromUrl(settings.instagramUrl);
  const hasChannel = Boolean(instagramUsername || settings.whatsappNumber);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
          Compramos relojes
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Vendé tu reloj</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Compramos relojes de calidad, con o sin caja y papeles. Contanos qué tenés y te respondemos
          personalmente.
        </p>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-5 lg:gap-16">
        <section className="lg:col-span-2" aria-label="Cómo funciona">
          <h2 className="font-serif text-2xl">Cómo funciona</h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 font-serif text-base text-gold-deep"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 border-t pt-6 text-base leading-relaxed text-muted-foreground">
            Tratamos tu consulta con reserva. No publicamos ni compartimos los datos de tu reloj.
          </p>
        </section>

        <section className="lg:col-span-3" aria-label="Datos de tu reloj">
          <div className="rounded-sm border bg-card p-6 sm:p-8">
            <h2 className="font-serif text-2xl">Datos de tu reloj</h2>
            {hasChannel ? (
              <div className="mt-6">
                <SellWatchForm
                  instagramUsername={instagramUsername}
                  whatsappNumber={settings.whatsappNumber}
                />
              </div>
            ) : (
              <p className="mt-4 text-base text-muted-foreground">
                En este momento el formulario no está disponible. Escribinos desde la página de
                contacto.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
