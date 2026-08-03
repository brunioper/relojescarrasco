import Link from "next/link";
import { ArrowRight, BadgeCheck, Search, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { WhatsAppButton } from "@/components/products/whatsapp-button";
import { fetchFeaturedProducts, fetchLatestProducts } from "@/services/catalogue";
import { getCatalogueRate, getPublicSettings } from "@/services/settings";

export const revalidate = 300; // catálogo público cacheado 5 minutos

export default async function HomePage() {
  const [settings, rate, featured, latest] = await Promise.all([
    getPublicSettings(),
    getCatalogueRate(),
    fetchFeaturedProducts(4),
    fetchLatestProducts(8),
  ]);

  const latestFiltered = latest
    .filter((p) => !featured.some((f) => f.id === p.id))
    .slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:py-28">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Relojes de colección · Uruguay</p>
          <h1 className="max-w-2xl font-serif text-4xl leading-tight md:text-5xl">
            Relojes con historia, elegidos uno a uno.
          </h1>
          <p className="max-w-xl text-primary-foreground/70">
            {settings.catalogueIntro ||
              "Compra y venta de relojes de colección y usados, revisados y garantizados."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/catalogo">
                Ver catálogo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {settings.whatsappNumber && (
              <WhatsAppButton
                phoneNumber={settings.whatsappNumber}
                message={`Hola, quiero hacer una consulta sobre los relojes de ${settings.businessName}.`}
                label="Escribinos"
              />
            )}
          </div>
        </div>
      </section>

      {/* Destacados */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-2xl md:text-3xl">Relojes destacados</h2>
              <p className="mt-1 text-sm text-muted-foreground">Piezas seleccionadas de la colección</p>
            </div>
            <Link href="/catalogo" className="text-sm text-muted-foreground hover:text-foreground">
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {featured.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                catalogueRate={rate}
                showUyu={settings.showUyuConversion}
                priority={i < 2}
              />
            ))}
          </div>
        </section>
      )}

      {/* Últimos ingresos */}
      {latestFiltered.length > 0 && (
        <section className="border-t bg-secondary/50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mb-8">
              <h2 className="font-serif text-2xl md:text-3xl">Últimos ingresos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Recién llegados al catálogo</p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {latestFiltered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  catalogueRate={rate}
                  showUyu={settings.showUyuConversion}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Confianza */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-serif text-2xl md:text-3xl">Por qué comprar en {settings.businessName}</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Search className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <h3 className="font-medium">Selección cuidadosa</h3>
            <p className="text-sm text-muted-foreground">
              Cada reloj se elige personalmente por su estado, originalidad e historia. No trabajamos con
              volumen: trabajamos con criterio.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Wrench className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <h3 className="font-medium">Revisados y en funcionamiento</h3>
            <p className="text-sm text-muted-foreground">
              Los relojes se entregan revisados por relojeros de confianza, con service o reparación cuando
              lo necesitan.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <h3 className="font-medium">Trato directo y transparente</h3>
            <p className="text-sm text-muted-foreground">
              Coordinamos personalmente cada entrega en Montevideo. Lo que ves en las fotos es lo que
              recibís.
            </p>
          </div>
        </div>
        <div className="mt-12 flex justify-center">
          <div className="flex max-w-xl items-start gap-3 rounded-xl border bg-card p-5">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <p className="text-sm text-muted-foreground">
              ¿Buscás un modelo en particular o querés vender tu reloj? Escribinos: también compramos
              relojes de colección y gestionamos búsquedas específicas.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
