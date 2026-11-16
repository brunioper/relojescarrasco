"use client";

import * as React from "react";
import { Instagram, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { instagramDmUrl } from "@/lib/inquiry";
import { trackContact, trackViewContent, type TrackedProduct } from "@/lib/analytics";

/**
 * Botones de consulta de la ficha de producto.
 *
 * - Instagram es el canal principal (las ventas se cierran por DM). Como
 *   Instagram no permite pre-cargar el texto de un DM, al tocar el botón
 *   se copia el mensaje (con el modelo y el link) y se abre el chat.
 * - WhatsApp queda como alternativa, con el mensaje ya cargado.
 *
 * Son links reales (<a href>): funcionan aunque falle JavaScript.
 */

const BASE =
  "inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md px-6 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function InstagramInquiryButton({
  username,
  message,
  product,
  label = "Consultar por Instagram",
  className,
}: {
  username: string;
  message: string;
  product?: TrackedProduct;
  label?: string;
  className?: string;
}) {
  const handleClick = () => {
    trackContact("instagram", product);
    // Sin await: el link debe abrirse dentro del mismo gesto del usuario.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message).then(
        () =>
          toast.success("Copiamos tu consulta", {
            description: "Pegala en el chat de Instagram que se abrió y enviala.",
            duration: 8000,
          }),
        () => undefined
      );
    }
  };

  return (
    <a
      href={instagramDmUrl(username)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn(BASE, "bg-primary text-primary-foreground shadow hover:bg-primary/90", className)}
    >
      <Instagram className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  );
}

export function WhatsAppInquiryButton({
  phoneNumber,
  message,
  product,
  label = "Consultar por WhatsApp",
  className,
}: {
  phoneNumber: string;
  message: string;
  product?: TrackedProduct;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact("whatsapp", product)}
      className={cn(BASE, "border border-input bg-transparent hover:bg-accent", className)}
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  );
}

/** Registra la vista de la ficha (Meta Pixel). No renderiza nada. */
export function ProductViewTracker({ product }: { product: TrackedProduct }) {
  const { id, name, brand, category, priceUsd } = product;
  React.useEffect(() => {
    trackViewContent({ id, name, brand, category, priceUsd });
  }, [id, name, brand, category, priceUsd]);
  return null;
}
