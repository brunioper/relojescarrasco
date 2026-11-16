"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/formatting/currency";
import { buildInquiryMessage, type InquiryProduct } from "@/lib/inquiry";
import { variantLabel, type PublicVariant } from "@/lib/variants";
import type { TrackedProduct } from "@/lib/analytics";
import {
  InstagramInquiryButton,
  WhatsAppInquiryButton,
} from "@/components/products/inquiry-buttons";

/**
 * Selector de variante (ancho, material, color) + botones de consulta.
 * La consulta que se envía incluye la variante elegida, así el pedido
 * llega completo al chat.
 */
export function VariantInquiry({
  variants,
  product,
  tracked,
  productUrl,
  instagramUsername,
  whatsappNumber,
  basePriceUsd,
  showButtons,
}: {
  variants: PublicVariant[];
  product: InquiryProduct;
  tracked: TrackedProduct;
  productUrl: string;
  instagramUsername: string | null;
  whatsappNumber: string;
  basePriceUsd: number;
  showButtons: boolean;
}) {
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0] ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(firstAvailable?.id ?? null);
  const selected = variants.find((v) => v.id === selectedId) ?? null;

  const label = selected ? variantLabel(selected) : null;
  const message = buildInquiryMessage(product, productUrl, label);
  const price = selected?.price_usd ?? basePriceUsd;
  const priceDiffers = variants.some((v) => (v.price_usd ?? basePriceUsd) !== basePriceUsd);

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Elegí la variante
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {variants.map((variant) => {
            const out = variant.stock <= 0;
            const active = variant.id === selectedId;
            return (
              <label
                key={variant.id}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-base transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  active ? "border-foreground bg-primary text-primary-foreground" : "hover:bg-accent",
                  out && "cursor-not-allowed text-muted-foreground line-through opacity-60"
                )}
              >
                <input
                  type="radio"
                  name="variante"
                  value={variant.id}
                  checked={active}
                  disabled={out}
                  onChange={() => setSelectedId(variant.id)}
                  className="sr-only"
                />
                {variantLabel(variant)}
                {out && <span className="sr-only"> (sin stock)</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {selected && (
        <p className="mt-3 text-base text-muted-foreground" aria-live="polite">
          {priceDiffers && <span className="font-medium text-foreground">{formatUsd(price)} · </span>}
          {selected.stock <= 0
            ? "Sin stock por ahora"
            : selected.stock === 1
              ? "Última unidad"
              : selected.stock <= 3
                ? `Quedan ${selected.stock}`
                : "En stock"}
        </p>
      )}

      {showButtons && (
        <div className="mt-6 flex flex-col gap-3">
          {instagramUsername && (
            <InstagramInquiryButton
              username={instagramUsername}
              message={message}
              product={tracked}
            />
          )}
          {whatsappNumber && (
            <WhatsAppInquiryButton phoneNumber={whatsappNumber} message={message} product={tracked} />
          )}
        </div>
      )}
    </div>
  );
}
