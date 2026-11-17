"use client";

import * as React from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, Watch, X } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string };

/**
 * Galería de producto: imagen principal, miniaturas y vista ampliada.
 *
 * - Tocar la imagen abre la vista ampliada a pantalla completa.
 * - En la vista ampliada: flechas (o teclado ← →) para cambiar de foto y
 *   un toque/clic para acercar al detalle (2×). En el celular también
 *   funciona el gesto de pellizcar.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [active, setActive] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [zoomed, setZoomed] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);

  const count = images.length;
  const go = React.useCallback(
    (delta: number) => {
      setZoomed(false);
      setActive((i) => (i + delta + count) % count);
    },
    [count]
  );

  if (count === 0) {
    return (
      <div
        className="flex aspect-[4/5] w-full items-center justify-center rounded-sm bg-muted text-muted-foreground/40"
        role="img"
        aria-label={`${productName} — sin fotografías`}
      >
        <Watch className="h-24 w-24" strokeWidth={1} />
      </div>
    );
  }

  const current = images[Math.min(active, count - 1)]!;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches.length === 1 ? e.touches[0]!.clientX : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || count < 2 || zoomed) return;
    const delta = e.changedTouches[0]!.clientX - touchStartX.current;
    if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <div className="min-w-0">
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setZoomed(false);
        }}
      >
        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-muted"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <DialogPrimitive.Trigger
            className="group absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={`Ampliar fotografía ${active + 1} de ${count} de ${productName}`}
          >
            <Image
              src={current.url}
              alt={current.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-sm bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
              <Expand className="h-3.5 w-3.5" aria-hidden="true" />
              Ampliar
            </span>
          </DialogPrimitive.Trigger>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Fotografía anterior"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Fotografía siguiente"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="absolute bottom-3 left-3 rounded-sm bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
                {active + 1} / {count}
              </span>
            </>
          )}
        </div>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex flex-col focus:outline-none"
            onKeyDown={onKeyDown}
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between px-4 py-3 text-white">
              <DialogPrimitive.Title className="truncate pr-4 text-sm">
                {productName} — {active + 1} / {count}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Cerrar vista ampliada"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            <div
              className={cn(
                "relative flex-1 touch-pinch-zoom",
                zoomed ? "overflow-auto" : "overflow-hidden"
              )}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-label={zoomed ? "Alejar" : "Acercar al detalle"}
                className={cn(
                  "relative block focus-visible:outline-none",
                  zoomed ? "h-[200%] w-[200%] cursor-zoom-out" : "h-full w-full cursor-zoom-in"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt={current.alt}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </button>
            </div>

            {count > 1 && (
              <div className="flex items-center justify-center gap-6 px-4 py-4 text-white">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Fotografía anterior"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <span className="text-sm text-white/80">Tocá la foto para acercar</span>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Fotografía siguiente"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {count > 1 && (
        <div
          className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:thin]"
          role="group"
          aria-label={`Fotografías de ${productName}`}
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              aria-current={i === active}
              aria-label={`Ver fotografía ${i + 1} de ${count}`}
              onClick={() => {
                setZoomed(false);
                setActive(i);
              }}
              className={cn(
                "relative aspect-square w-[4.5rem] shrink-0 overflow-hidden rounded-sm bg-muted transition-opacity sm:w-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === active ? "ring-2 ring-gold" : "opacity-60 hover:opacity-100"
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
