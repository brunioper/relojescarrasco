import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Instagram, MapPin, MessageCircle } from "lucide-react";
import { CataloguePrice } from "@/components/products/catalogue-price";
import { ProductCard } from "@/components/products/product-card";
import { TrustPoints } from "@/components/public/trust-points";
import {
  fetchCatalogueFacets,
  fetchFeaturedProducts,
  fetchLatestProducts,
} from "@/services/catalogue";
import { getCatalogueRate, getPublicSettings } from "@/services/settings";
import { instagramDmUrl, instagramUsernameFromUrl } from "@/lib/inquiry";
import { productImageUrl } from "@/lib/storage";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const STEPS = [
  {
    title: "Elegimos pieza por pieza",
    text: "Un catálogo reducido de relojes originales, con movimientos en buen estado y una historia clara.",
  },
  {
    title: "Revisamos antes de publicar",
    text: "Verificamos referencias y números de serie, y evaluamos el estado estético y mecánico de cada reloj.",
  },
  {
    title: "Lo ves antes de decidir",
    text: "Coordinamos en persona en Montevideo. Te lo entregamos en funcionamiento y con garantía.",
  },
] as const;

const LIGHT_BUTTON =
  "inline-flex h-13 items-center gap-2 rounded-sm bg-background px-7 text-base font-medium text-foreground transition-colors hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

export default async function HomePage() {
  const [settings, rate, facets, featured, latest] = await Promise.all([
    getPublicSettings(),
    getCatalogueRate(),
    fetchCatalogueFacets(),
    fetchFeaturedProducts(1),
    fetchLatestProducts(9),
  ]);

  const watches = latest.filter((p) => p.category === "reloj");
  const hero =
    featured.find((p) => p.cover_image_path) ?? watches.find((p) => p.cover_image_path) ?? null;
  const heroImage = hero ? productImageUrl(hero.cover_image_path) : null;
  const arrivals = watches.filter((p) => p.id !== hero?.id).slice(0, 8);

  const instagramUsername = instagramUsernameFromUrl(settings.instagramUrl);

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_85%_10%,oklch(0.4_0.03_78),transparent)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="max-w-xl">
            <p className="rise text-xs font-medium uppercase tracking-[0.28em] text-gold-soft">
              Carrasco · Montevideo
            </p>
            <h1 className="rise rise-1 mt-5 font-serif text-[2.6rem] leading-[1.08] sm:text-6xl lg:text-[4.25rem]">
              Relojes con historia,{" "}
              <em className="font-normal italic text-gold-soft">elegidos uno por uno</em>
            </h1>
            <p className="rise rise-2 mt-6 text-lg leading-relaxed text-primary-foreground/80">
              Compra y venta de relojes suizos nuevos y usados. Cada pieza se revisa y se verifica
              antes de llegar al catálogo.
            </p>
            <div className="rise rise-3 mt-9 flex flex-wrap gap-3">
              <Link href="/catalogo" className={LIGHT_BUTTON}>
                Ver el catálogo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/vende-tu-reloj"
                className="inline-flex h-13 items-center rounded-sm border border-primary-foreground/35 px-7 text-base font-medium transition-colors hover:border-gold-soft hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                Vendé tu reloj
              </Link>
            </div>
          </div>

          {hero && heroImage && (
            <Link
              href={`/catalogo/${hero.slug}`}
              className="rise rise-2 group relative mx-auto block w-full max-w-md pb-10 pl-5 focus-visible:outline-none lg:mr-0 lg:max-w-[29rem] lg:pl-8"
            >
              <span
                aria-hidden="true"
                className="absolute bottom-6 left-0 right-4 top-4 border border-gold/50 lg:right-5 lg:top-5"
              />
              <div className="relative aspect-[4/5] overflow-hidden bg-primary-foreground/10">
                <Image
                  src={heroImage}
                  alt={hero.cover_image_alt ?? hero.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div className="absolute bottom-0 left-0 w-[min(88%,21rem)] bg-background p-5 text-foreground shadow-xl ring-2 ring-transparent group-focus-visible:ring-gold-soft">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-deep">
                  {hero.brand}
                </p>
                <p className="mt-1 font-serif text-xl leading-snug">{hero.name}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <CataloguePrice
                    priceUsd={hero.price_usd}
                    catalogueRate={rate}
                    showUyu={false}
                    size="md"
                  />
                  <span className="inline-flex items-center gap-1 text-sm underline decoration-gold underline-offset-4">
                    Ver reloj
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {facets.brands.length > 1 && (
        <section aria-label="Marcas en el catálogo" className="border-b">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 sm:px-6 md:flex-row md:items-center md:gap-10">
            <p className="shrink-0 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Marcas en catálogo
            </p>
            <ul className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {facets.brands.slice(0, 12).map((brand) => (
                <li key={brand}>
                  <Link
                    href={`/catalogo?marca=${encodeURIComponent(brand)}`}
                    className="font-serif text-lg uppercase tracking-[0.14em] text-foreground/75 underline-offset-8 transition-colors hover:text-foreground hover:underline hover:decoration-gold"
                  >
                    {brand}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {arrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
                En el catálogo
              </p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">Recién llegados</h2>
            </div>
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-2 text-base underline decoration-gold underline-offset-8 hover:text-gold-deep"
            >
              Ver todo el catálogo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-8 md:gap-y-14 lg:grid-cols-4">
            {arrivals.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                catalogueRate={rate}
                showUyu={settings.showUyuConversion}
              />
            ))}
          </div>
        </section>
      )}

      <section className="border-y bg-secondary/60">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
              Cómo trabajamos
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
              Preferimos vender menos relojes, pero venderlos bien
            </h2>
            <Link
              href="/autenticidad-y-garantia"
              className="mt-6 inline-flex items-center gap-2 text-base underline decoration-gold underline-offset-8 hover:text-gold-deep"
            >
              Autenticidad y garantía
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t border-gold/50 pt-5">
                <span className="font-serif text-4xl text-gold-deep" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 bg-primary p-8 text-primary-foreground md:p-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-soft">
              También compramos
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
              ¿Tenés un reloj para vender?
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-primary-foreground/80">
              Contanos la marca, el modelo y el estado. Lo evaluamos y te respondemos personalmente.
            </p>
          </div>
          <Link href="/vende-tu-reloj" className={`${LIGHT_BUTTON} w-fit`}>
            Vendé tu reloj
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-col justify-between gap-8 border p-8 md:p-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
              Atención personal
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
              Escribinos o vení a verlo
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Respondemos cada consulta personalmente. Si buscás un modelo en particular, también
              podemos conseguirlo.
            </p>
            {settings.address && (
              <p className="mt-5 flex items-start gap-2 text-base">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-gold-deep" aria-hidden="true" />
                {settings.address}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {instagramUsername && (
              <a
                href={instagramDmUrl(instagramUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-13 items-center gap-2 rounded-sm bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Instagram
              </a>
            )}
            {settings.whatsappNumber && (
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-13 items-center gap-2 rounded-sm border px-6 text-base font-medium transition-colors hover:border-foreground"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            )}
            <Link
              href="/contacto"
              className="inline-flex h-13 items-center px-2 text-base underline decoration-gold underline-offset-8 hover:text-gold-deep"
            >
              Otras formas de contacto
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <TrustPoints className="border-t pt-12" />
      </div>
    </>
  );
}
