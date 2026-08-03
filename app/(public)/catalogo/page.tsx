import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/products/product-card";
import { CatalogueFilters } from "@/components/public/catalogue-filters";
import { Button } from "@/components/ui/button";
import {
  fetchCataloguePage,
  fetchCatalogueBrands,
  type CatalogueSort,
} from "@/services/catalogue";
import { getCatalogueRate, getPublicSettings } from "@/services/settings";
import { CURRENCY_DISCLAIMER } from "@/lib/formatting/currency";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Catálogo de relojes",
  description:
    "Catálogo de relojes de colección y usados disponibles en Relojes Carrasco. Precios en dólares con conversión aproximada a pesos uruguayos.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const sortParam = readParam(params, "orden");
  const sort: CatalogueSort = (
    ["newest", "oldest", "price_asc", "price_desc", "updated"] as const
  ).includes(sortParam as CatalogueSort)
    ? (sortParam as CatalogueSort)
    : "newest";

  const filters = {
    q: readParam(params, "q"),
    brand: readParam(params, "marca"),
    movement: readParam(params, "movimiento"),
    minPrice: readParam(params, "min") ? Number(readParam(params, "min")) : undefined,
    maxPrice: readParam(params, "max") ? Number(readParam(params, "max")) : undefined,
    box: readParam(params, "caja") === "1" ? true : undefined,
    docs: readParam(params, "papeles") === "1" ? true : undefined,
    status: readParam(params, "estado") as "disponible" | "reservado" | undefined,
    sort,
    page: readParam(params, "pagina") ? Math.max(1, Number(readParam(params, "pagina"))) : 1,
  };

  const [settings, rate, brands, result] = await Promise.all([
    getPublicSettings(),
    getCatalogueRate(),
    fetchCatalogueBrands(),
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl">Catálogo</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {settings.catalogueIntro}
        </p>
      </header>

      <CatalogueFilters brands={brands} />

      {result.products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.5} />
          <div>
            <p className="font-medium">No encontramos relojes con esos filtros</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Probá quitar filtros o ver el catálogo completo.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/catalogo">Ver todo el catálogo</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {result.total} {result.total === 1 ? "reloj" : "relojes"}
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
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
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginación">
              {result.page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(result.page - 1)}>← Anterior</Link>
                </Button>
              )}
              <span className="px-3 text-sm text-muted-foreground">
                Página {result.page} de {result.pageCount}
              </span>
              {result.page < result.pageCount && (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(result.page + 1)}>Siguiente →</Link>
                </Button>
              )}
            </nav>
          )}
        </>
      )}

      <p className="mt-12 text-xs text-muted-foreground">{CURRENCY_DISCLAIMER}</p>
    </div>
  );
}
