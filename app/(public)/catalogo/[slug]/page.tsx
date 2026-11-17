import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { CataloguePrice } from "@/components/products/catalogue-price";
import { ProductCard } from "@/components/products/product-card";
import {
  InstagramInquiryButton,
  ProductViewTracker,
  WhatsAppInquiryButton,
} from "@/components/products/inquiry-buttons";
import { VariantInquiry } from "@/components/products/variant-inquiry";
import { ProductGallery } from "@/components/public/product-gallery";
import { TrustPoints } from "@/components/public/trust-points";
import { JsonLd } from "@/components/public/json-ld";
import {
  fetchAccessories,
  fetchCompatibleAccessories,
  fetchProductBySlug,
  fetchRelatedProducts,
} from "@/services/catalogue";
import { compatibilityLabel, readCompatibility, readPublicVariants } from "@/lib/variants";
import { getCatalogueRate, getPublicSettings } from "@/services/settings";
import { CURRENCY_DISCLAIMER, formatUsd } from "@/lib/formatting/currency";
import { buildInquiryMessage, instagramUsernameFromUrl } from "@/lib/inquiry";
import { siteUrl } from "@/lib/site";
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

  const title = [product.name, product.reference_number ? `ref. ${product.reference_number}` : null]
    .filter(Boolean)
    .join(" ");
  const summary = product.public_description.replace(/\s+/g, " ").trim().slice(0, 130);
  const description = `${product.name} en venta en Montevideo: ${formatUsd(product.price_usd)}.${
    summary ? ` ${summary}` : ""
  }`;
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

function Fact({ label, included }: { label: string; included: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-base">
      {included ? (
        <Check className="h-5 w-5 text-emerald-700" aria-hidden="true" />
      ) : (
        <Minus className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
      )}
      <span className={included ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, settings, rate] = await Promise.all([
    fetchProductBySlug(slug),
    getPublicSettings(),
    getCatalogueRate(),
  ]);

  if (!product) notFound();

  const isAccessory = product.category === "accesorio";
  const [related, compatibleStraps, latestAccessories] = await Promise.all([
    fetchRelatedProducts(product.brand, product.id, product.category, 4),
    isAccessory ? Promise.resolve([]) : fetchCompatibleAccessories(product.brand, 4),
    isAccessory ? Promise.resolve([]) : fetchAccessories(4),
  ]);
  // En la ficha de un reloj: primero las correas compatibles con su marca.
  const hasCompatibleStraps = compatibleStraps.length > 0;
  const accessories = hasCompatibleStraps ? compatibleStraps : latestAccessories;

  const variants = isAccessory ? readPublicVariants(product.variants) : [];
  const compatibility = isAccessory ? readCompatibility(product.compatibility) : [];
  // "catalogo": se muestra sin botones. "comprar" usa la consulta hasta que
  // el pago online esté activo (Etapa 5).
  const showInquiry = product.sale_mode !== "catalogo";
  const isNew = product.is_new === true;

  const images = Array.isArray(product.images)
    ? (product.images as { path: string; alt: string }[])
    : [];
  const galleryImages = images
    .map((img) => ({ url: productImageUrl(img.path), alt: img.alt || product.name }))
    .filter((img): img is { url: string; alt: string } => img.url !== null);

  const specs: Array<[string, string | null]> = isAccessory
    ? [
        ["Marca", product.brand],
        ["Modelo", product.model || null],
        ["Material", product.strap_material],
      ]
    : [
        ["Marca", product.brand],
        ["Modelo", product.model || null],
        ["Referencia", product.reference_number],
        ["Año aproximado", product.year_approx ? String(product.year_approx) : null],
        ["Movimiento", MOVEMENT_LABELS[product.movement] ?? product.movement],
        ["Material de caja", product.case_material],
        ["Correa / brazalete", product.strap_material],
        ["Condición", isNew ? "Nuevo" : null],
        ["Diámetro", product.diameter_mm ? `${product.diameter_mm} mm` : null],
        ["Resistencia al agua", product.water_resistance],
        [
          "Género",
          product.gender ? product.gender.charAt(0).toUpperCase() + product.gender.slice(1) : null,
        ],
      ];

  const base = siteUrl(settings.siteUrl);
  const productUrl = `${base}/catalogo/${product.slug}`;
  const inquiryMessage = buildInquiryMessage(
    {
      brand: product.brand,
      name: product.name,
      model: product.model,
      referenceNumber: product.reference_number,
    },
    productUrl
  );
  const instagramUsername = instagramUsernameFromUrl(settings.instagramUrl);
  const tracked = {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    priceUsd: product.price_usd,
  };

  const lowStock =
    isAccessory && product.stock_quantity !== null && product.stock_quantity <= 2;
  const availability = isAccessory
    ? lowStock
      ? product.stock_quantity === 1
        ? "Última unidad"
        : `Últimas ${product.stock_quantity} unidades`
      : "En stock"
    : product.status === "reservado"
      ? "Reservado"
      : "Disponible";
  const looksNew = isNew || /\b(nuevo|nueva|sin uso)\b/i.test(product.condition);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: productUrl,
    brand: { "@type": "Brand", name: product.brand },
    ...(product.model ? { model: product.model } : {}),
    ...(product.reference_number ? { mpn: product.reference_number } : {}),
    ...(product.public_description ? { description: product.public_description } : {}),
    ...(galleryImages.length > 0 ? { image: galleryImages.map((img) => img.url) } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "USD",
      price: product.price_usd,
      availability:
        isAccessory || product.status === "disponible"
          ? "https://schema.org/InStock"
          : "https://schema.org/LimitedAvailability",
      itemCondition:
        isAccessory || looksNew
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      seller: { "@type": "Organization", name: settings.businessName },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Catálogo", item: `${base}/catalogo` },
      {
        "@type": "ListItem",
        position: 2,
        name: product.brand,
        item: `${base}/catalogo?marca=${encodeURIComponent(product.brand)}`,
      },
      { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
    ],
  };

  const subtitle = [
    product.model && !product.name.toLowerCase().includes(product.model.toLowerCase())
      ? product.model
      : null,
    product.reference_number ? `Ref. ${product.reference_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pt-10 lg:pb-16">
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <ProductViewTracker product={tracked} />

      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Miga de pan">
        <Link href="/catalogo" className="underline-offset-4 hover:text-foreground hover:underline">
          Catálogo
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link
          href={`/catalogo?marca=${encodeURIComponent(product.brand)}`}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {product.brand}
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <ProductGallery images={galleryImages} productName={product.name} />
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold-deep">
              {product.brand}
            </p>
            <h1 className="mt-2 font-serif text-3xl leading-tight md:text-4xl">{product.name}</h1>
            {subtitle && <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>}

            <div className="mt-6">
              <CataloguePrice
                priceUsd={product.price_usd}
                catalogueRate={settings.showUyuConversion ? rate : null}
                size="lg"
              />
              <p className="mt-2 flex items-center gap-2 text-base">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    availability === "Reservado" ? "bg-amber-500" : "bg-emerald-600"
                  }`}
                  aria-hidden="true"
                />
                {availability}
              </p>
            </div>

            {variants.length > 0 && (
              <div className="mt-7">
                <VariantInquiry
                  variants={variants}
                  product={{
                    brand: product.brand,
                    name: product.name,
                    model: product.model,
                    referenceNumber: product.reference_number,
                  }}
                  tracked={tracked}
                  productUrl={productUrl}
                  instagramUsername={instagramUsername}
                  whatsappNumber={settings.whatsappNumber}
                  basePriceUsd={product.price_usd}
                  showButtons={showInquiry}
                />
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3">
              {showInquiry && variants.length === 0 && instagramUsername && (
                <InstagramInquiryButton
                  username={instagramUsername}
                  message={inquiryMessage}
                  product={tracked}
                />
              )}
              {showInquiry && variants.length === 0 && settings.whatsappNumber && (
                <WhatsAppInquiryButton
                  phoneNumber={settings.whatsappNumber}
                  message={inquiryMessage}
                  product={tracked}
                />
              )}
              <p className="text-sm text-muted-foreground">
                Te atendemos personalmente.{" "}
                <Link href="/contacto" className="underline underline-offset-4 hover:text-foreground">
                  Otras formas de contacto
                </Link>
              </p>
            </div>

            {!isAccessory && (
              <div className="mt-8 border-t pt-6">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Qué incluye
                </h2>
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Fact
                    label={product.includes_box ? "Caja original" : "Sin caja"}
                    included={product.includes_box}
                  />
                  <Fact
                    label={product.includes_documentation ? "Papeles" : "Sin papeles"}
                    included={product.includes_documentation}
                  />
                </ul>
                {product.includes_accessories && (
                  <p className="mt-3 text-base text-muted-foreground">
                    <span className="text-foreground">También incluye: </span>
                    {product.includes_accessories}
                  </p>
                )}
                {product.condition && (
                  <p className="mt-4 text-base leading-relaxed">
                    <span className="font-medium">Estado: </span>
                    <span className="text-muted-foreground">{product.condition}</span>
                  </p>
                )}
              </div>
            )}

            {compatibility.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Compatible con
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {compatibility.map((item) => (
                    <li
                      key={`${item.brand}-${item.model ?? ""}`}
                      className="rounded-md border px-3 py-1.5 text-base"
                    >
                      {compatibilityLabel(item)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <TrustPoints variant="stack" className="mt-8 border-t pt-6" />
          </div>
        </div>
      </div>

      <div className="mt-14 grid gap-12 border-t pt-12 lg:grid-cols-12 lg:gap-14">
        {product.public_description && (
          <section className="lg:col-span-7">
            <h2 className="font-serif text-2xl">Descripción</h2>
            <p className="mt-4 max-w-prose whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {product.public_description}
            </p>
          </section>
        )}

        <section className={product.public_description ? "lg:col-span-5" : "lg:col-span-7"}>
          <h2 className="font-serif text-2xl">Especificaciones</h2>
          <dl className="mt-4">
            {specs
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 border-b py-3 text-base">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
          </dl>
        </section>
      </div>

      {settings.showUyuConversion && rate !== null && (
        <p className="mt-10 text-sm text-muted-foreground">{CURRENCY_DISCLAIMER}</p>
      )}

      {accessories.length > 0 && (
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-serif text-2xl md:text-3xl">
              {hasCompatibleStraps ? `Correas para tu ${product.brand}` : "Correas y accesorios"}
            </h2>
            <Link
              href={
                hasCompatibleStraps
                  ? `/catalogo?tipo=accesorio&para=${encodeURIComponent(product.brand)}`
                  : "/catalogo?tipo=accesorio"
              }
              className="text-base underline decoration-gold underline-offset-4 hover:text-gold-deep"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-8">
            {accessories.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                catalogueRate={rate}
                showUyu={settings.showUyuConversion}
              />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-2xl md:text-3xl">También te puede interesar</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-8">
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

      {/* Barra fija en el celular: el botón de consulta siempre a mano. */}
      {showInquiry && variants.length === 0 && instagramUsername && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-4">
            <div className="min-w-0 shrink-0">
              <p className="text-xs text-muted-foreground">Precio</p>
              <p className="text-lg font-semibold leading-tight">{formatUsd(product.price_usd)}</p>
            </div>
            <InstagramInquiryButton
              username={instagramUsername}
              message={inquiryMessage}
              product={tracked}
              label="Consultar"
              className="flex-1"
            />
          </div>
        </div>
      )}

    </div>
  );
}
