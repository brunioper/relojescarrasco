import Image from "next/image";
import Link from "next/link";
import { Watch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CataloguePrice } from "@/components/products/catalogue-price";
import { productImageUrl } from "@/lib/storage";
import type { CatalogueCard } from "@/services/catalogue";

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

  return (
    <Link
      href={`/catalogo/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.cover_image_alt ?? `${title} — ${product.name}`}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-muted-foreground/40"
            aria-label={`${title} — sin fotografía`}
          >
            <Watch className="h-16 w-16" strokeWidth={1} />
          </div>
        )}
        {product.status === "reservado" && (
          <Badge variant="warning" className="absolute left-3 top-3">
            Reservado
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{product.brand}</p>
        <h3 className="font-serif text-base leading-snug">{product.name}</h3>
        {product.model && <p className="text-sm text-muted-foreground">{product.model}</p>}
        <div className="mt-auto pt-3">
          <CataloguePrice
            priceUsd={product.price_usd}
            catalogueRate={catalogueRate}
            showUyu={showUyu}
            size="sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {product.status === "disponible" ? "Disponible" : "Reservado"}
          </p>
        </div>
      </div>
    </Link>
  );
}
