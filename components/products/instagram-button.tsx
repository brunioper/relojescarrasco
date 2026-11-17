import { Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { instagramDmUrl, instagramUsernameFromUrl } from "@/lib/inquiry";

export { instagramUsernameFromUrl };

/**
 * Botón simple al chat de Instagram (sin mensaje). Para la ficha de
 * producto usar InstagramInquiryButton (components/products/inquiry-buttons.tsx),
 * que además copia la consulta con el modelo y el link.
 */
export function InstagramButton({
  instagramUrl,
  label = "Consultar por Instagram",
  size = "lg",
}: {
  instagramUrl: string;
  label?: string;
  size?: "default" | "lg" | "sm";
}) {
  const username = instagramUsernameFromUrl(instagramUrl);
  if (!username) return null;

  return (
    <Button asChild size={size} variant="outline">
      <a href={instagramDmUrl(username)} target="_blank" rel="noopener noreferrer">
        <Instagram className="h-5 w-5" />
        {label}
      </a>
    </Button>
  );
}
