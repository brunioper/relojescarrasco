import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/products/product-card";
import { CatalogueFilters } from "@/components/public/catalogue-filters";
import { TrustPoints } from "@/components/public/trust-points";
import { Button } from "@/components/ui/button";
import { fetchCataloguePage, fetchCatalogueFacets } from "@/services/catalogue";
import { getCatalogueRate, getPublicSettings } from "@/services/settings";
import { parseCatalogueParams } from "@/lib/catalogue-params";
import { CURRENCY_DISCLAIMER } from "@/lib/formatting/currency";

export const revalidate = 120;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const filters = parseCatalogueParams(await searchParams);

  if (filters.category === "accesorio") {
    return {
      title: "Correas y accesorios para relojes",
      description:
        "Correas, hebillas y accesorios para relojes en Relojes Carrasco, Montevideo. Stock disponible y precios en dólares.",
      alternates: { canonical: "/catalogo?tipo=accesorio" },
    };
  }

  const brand = filters.brand;
  return {
    title: brand ? `Relojes ${brand} en Uruguay` : "Relojes suizos nuevos y usados en Uruguay",
    description: brand
      ? `Relojes ${brand} originales disponibles en Relojes Carrasco, Montevideo. Autenticidad verificada, garantía y local en Carrasco.`
      : "Catálogo de relojes suizos nuevos y usados en Montevideo: autenticidad verificada, garantía y local en Carrasco. Precios en dólares.",
    alternates: {
      canonical: brand ? `/catalogo?marca=${encodeURIComponent(brand)}` : "/catalogo",
    },
  };
}

export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseCatalogueParams(params);

  const [settings, rate, facets, result] = await Promise.all([
    getPublicSettings(),
    getCatalogueRate(),
    fetchCatalogueFacets(),
    fetchCataloguePage(filters),
  ]);

  const buildPageHref = (page: number) => {
    const url = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value !== "") url.set(key, value);
    }
    url.set("pagina", String(page));
    return `/catalogo?${url.toString()}`;
  };

  const heading =
    filters.category === "accesorio"
      ? "Correas y accesorios"
      : filters.brand
        ? `Relojes ${filters.brand}`
        : "Catálogo";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 md:pt-14">
      <header className="mb-10 max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-gold-deep">
          Relojes Carrasco · Montevideo
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{heading}</h1>
        {settings.catalogueIntro && (
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {settings.catalogueIntro}
          </p>
        )}
      </header>

      <CatalogueFilters
        brands={facets.brands}
        materials={facets.materials}
        showCategoryTabs={facets.hasAccessories}
      />

      {result.products.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-sm border border-dashed px-4 py-20 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.5} />
          <div>
            <p className="text-lg font-medium">No encontramos productos con esos filtros</p>
            <p className="mt-2 text-base text-muted-foreground">
              Probá quitar algún filtro. Si buscás un modelo en particular, escribinos: podemos
              conseguirlo.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/catalogo">Ver todo el catálogo</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contacto">Pedir un modelo</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
            {result.total} {result.total === 1 ? "producto" : "productos"}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8 md:gap-y-14 xl:grid-cols-4">
            {result.products.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                catalogueRate={rate}
                showUyu={settings.showUyuConversion}
                priority={i < 4}
              />
            ))}
          </div>

          {result.pageCount > 1 && (
            <nav className="mt-14 flex items-center justify-center gap-3" aria-label="Paginación">
              {result.page > 1 && (
                <Button asChild variant="outline" size="lg">
                  <Link href={buildPageHref(result.page - 1)}>← Anterior</Link>
                </Button>
              )}
              <span className="px-3 text-base text-muted-foreground">
                Página {result.page} de {result.pageCount}
              </span>
              {result.page < result.pageCount && (
                <Button asChild variant="outline" size="lg">
                  <Link href={buildPageHref(result.page + 1)}>Siguiente →</Link>
                </Button>
              )}
            </nav>
          )}
        </>
      )}

      <TrustPoints className="mt-20 border-t pt-12" />

      {settings.showUyuConversion && rate !== null && (
        <p className="mt-10 text-sm text-muted-foreground">{CURRENCY_DISCLAIMER}</p>
      )}
    </div>
  );
}
