import Image from "next/image";
import Link from "next/link";
import { Watch } from "lucide-react";
import { CataloguePrice } from "@/components/products/catalogue-price";
import { productImageUrl } from "@/lib/storage";
import type { CatalogueCard } from "@/services/catalogue";

/** Datos breves bajo el nombre: "Ref. 16233 · 36 mm · Caja y papeles". */
function cardDetails(product: CatalogueCard): string {
  const details: string[] = [];
  if (product.reference_number) details.push(`Ref. ${product.reference_number}`);
  if (product.diameter_mm) details.push(`${product.diameter_mm} mm`);
  if (product.includes_box && product.includes_documentation) details.push("Caja y papeles");
  else if (product.includes_box) details.push("Con caja");
  else if (product.includes_documentation) details.push("Con papeles");
  return details.join(" · ");
}

/** Tarjeta de producto del catálogo público. */
export function ProductCard({
  product,
  catalogueRate,
  showUyu,
  priority = false,
}: {
  product: CatalogueCard;
  catalogueRate: number | null;
  showUyu: boolean;
  priority?: boolean;
}) {
  const imageUrl = productImageUrl(product.cover_image_path);
  const title = `${product.brand} ${product.model}`.trim();
  const isAccessory = product.category === "accesorio";
  const details = isAccessory ? "" : cardDetails(product);
  const lowStock =
    isAccessory && product.stock_quantity !== null && product.stock_quantity <= 2;

  return (
    <Link
      href={`/catalogo/${product.slug}`}
      className="group flex flex-col rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.cover_image_alt ?? `${title} — ${product.name}`}
            fill
            priority={priority}
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-muted-foreground/40"
            aria-label={`${title} — sin fotografía`}
          >
            <Watch className="h-16 w-16" strokeWidth={1} />
          </div>
        )}
        {!isAccessory && product.status === "reservado" && (
          <span className="absolute left-3 top-3 rounded-sm bg-background/95 px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-foreground shadow-sm">
            Reservado
          </span>
        )}
        {lowStock && (
          <span className="absolute left-3 top-3 rounded-sm bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
            {product.stock_quantity === 1 ? "Última unidad" : `Últimas ${product.stock_quantity}`}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-deep">
          {product.brand}
        </p>
        <h3 className="mt-1.5 font-serif text-lg leading-snug text-foreground group-hover:underline group-hover:decoration-gold group-hover:underline-offset-4">
          {product.name}
        </h3>
        {details && <p className="mt-1 text-sm text-muted-foreground">{details}</p>}
        <div className="mt-auto pt-3">
          <CataloguePrice
            priceUsd={product.price_usd}
            catalogueRate={catalogueRate}
            showUyu={showUyu}
            size="md"
          />
        </div>
      </div>
    </Link>
  );
}
