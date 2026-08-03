"use client";

import * as React from "react";
import Image from "next/image";
import { Watch } from "lucide-react";
import { cn } from "@/lib/utils";

/** Galería accesible de imágenes de producto (miniaturas + imagen principal). */
export function ProductGallery({
  images,
  productName,
}: {
  images: { url: string; alt: string }[];
  productName: string;
}) {
  const [active, setActive] = React.useState(0);

  if (images.length === 0) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-xl border bg-muted text-muted-foreground/40"
        role="img"
        aria-label={`${productName} — sin fotografías`}
      >
        <Watch className="h-24 w-24" strokeWidth={1} />
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)]!;

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
        <Image
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div
          className="mt-3 grid grid-cols-5 gap-2"
          role="tablist"
          aria-label={`Fotografías de ${productName}`}
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              role="tab"
              aria-selected={i === active}
              aria-label={`Fotografía ${i + 1} de ${images.length}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg border bg-muted transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === active ? "ring-2 ring-gold" : "opacity-70 hover:opacity-100"
              )}
            >
              <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
