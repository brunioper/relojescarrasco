import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CataloguePrice } from "@/components/products/catalogue-price";
import { ProductCard } from "@/components/products/product-card";
import { ProductGallery } from "@/components/public/product-gallery";
import { WhatsAppButton, buildProductInquiryMessage } from "@/components/products/whatsapp-button";
import { fetchProductBySlug, fetchRelatedProducts } from "@/services/catalogue";
import { getCatalogueRate, getPublicSettings } from "@/services/settings";
import { catalogueUyuApprox } from "@/services/finance/currency";
import { CURRENCY_DISCLAIMER, formatUsd } from "@/lib/formatting/currency";
import { productImageUrl } from "@/lib/storage";

export const revalidate = 120;

const MOVEMENT_LABELS: Record<string, string> = {
  automatico: "Automático",
  manual: "Manual (cuerda)",
  cuarzo: "Cuarzo",
  solar: "Solar",
  otro: "Otro",
};

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);
  if (!product) return { title: "Reloj no encontrado" };

  const title = `${product.brand} ${product.model} — ${product.name}`;
  const description = `${product.name} en venta: ${formatUsd(product.price_usd)}. ${product.public_description.slice(0, 140)}`;
  const image = productImageUrl(product.cover_image_path);

  return {
    title,
    description,
    alternates: { canonical: `/catalogo/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, settings, rate] = await Promise.all([
    fetchProductBySlug(slug),
    getPublicSettings(),
    getCatalogueRate(),
  ]);

  if (!product) notFound();

  const related = await fetchRelatedProducts(product.brand, product.id, 4);
  const images = Array.isArray(product.images)
    ? (product.images as { path: string; alt: string }[])
    : [];

  const specs: Array<[string, string | null]> = [
    ["Marca", product.brand],
    ["Modelo", product.model || null],
    ["Referencia", product.reference_number],
    ["Año aproximado", product.year_approx ? String(product.year_approx) : null],
    ["Movimiento", MOVEMENT_LABELS[product.movement] ?? product.movement],
    ["Material de caja", product.case_material],
    ["Material de correa", product.strap_material],
    ["Diámetro", product.diameter_mm ? `${product.diameter_mm} mm` : null],
    ["Resistencia al agua", product.water_resistance],
    ["Género", product.gender],
  ];

  const uyuApprox = settings.showUyuConversion
    ? catalogueUyuApprox(product.price_usd, rate)
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    model: product.model || undefined,
    description: product.public_description,
    ...(productImageUrl(product.cover_image_path)
      ? { image: productImageUrl(product.cover_image_path) }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price_usd,
      availability:
        product.status === "disponible"
          ? "https://schema.org/InStock"
          : "https://schema.org/LimitedAvailability",
      itemCondition: "https://schema.org/UsedCondition",
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Miga de pan">
        <Link href="/catalogo" className="hover:text-foreground">
          Catálogo
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={images.map((img) => ({
            url: productImageUrl(img.path)!,
            alt: img.alt || product.name,
          }))}
          productName={product.name}
        />

        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-muted-foreground">{product.brand}</p>
              <h1 className="mt-1 font-serif text-3xl leading-tight">{product.name}</h1>
              {product.model && <p className="mt-1 text-muted-foreground">{product.model}</p>}
            </div>
            {product.status === "reservado" ? (
              <Badge variant="warning">Reservado</Badge>
            ) : (
              <Badge variant="success">Disponible</Badge>
            )}
          </div>

          <div className="mt-6">
            <CataloguePrice
              priceUsd={product.price_usd}
              catalogueRate={settings.showUyuConversion ? rate : null}
              size="lg"
            />
            {uyuApprox !== null && (
              <p className="mt-2 text-xs text-muted-foreground">{CURRENCY_DISCLAIMER}</p>
            )}
          </div>

          {settings.whatsappNumber && (
            <div className="mt-6">
              <WhatsAppButton
                phoneNumber={settings.whatsappNumber}
                message={buildProductInquiryMessage(product.name, product.model)}
              />
            </div>
          )}

          {product.public_description && (
            <>
              <Separator className="my-8" />
              <div>
                <h2 className="font-medium">Descripción</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.public_description}
                </p>
              </div>
            </>
          )}

          <Separator className="my-8" />

          <div>
            <h2 className="font-medium">Especificaciones</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {specs
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              {product.includes_box ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground/50" />
              )}
              {product.includes_box ? "Incluye caja" : "Sin caja"}
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              {product.includes_documentation ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground/50" />
              )}
              {product.includes_documentation ? "Incluye documentación" : "Sin documentación"}
            </div>
          </div>

          {product.condition && (
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm">
              <span className="font-medium">Estado de conservación: </span>
              <span className="text-muted-foreground">{product.condition}</span>
            </div>
          )}

          {product.includes_accessories && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Accesorios: </span>
              {product.includes_accessories}
            </p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-2xl">También te puede interesar</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((rel) => (
              <ProductCard
                key={rel.id}
                product={rel}
                catalogueRate={rate}
                showUyu={settings.showUyuConversion}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
