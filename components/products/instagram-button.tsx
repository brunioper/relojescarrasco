import { Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Extrae el usuario desde la URL de Instagram configurada en el admin
 * (application_settings.instagram_url). Devuelve null si no se puede
 * interpretar como un perfil de instagram.com.
 */
export function instagramUsernameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return null;
    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    return segment || null;
  } catch {
    return null;
  }
}

/**
 * Botón de consulta por Instagram. A diferencia de WhatsApp, Instagram
 * no soporta mensajes pre-cargados por link: ig.me/m/{usuario} abre
 * directamente el chat con la cuenta.
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
      <a href={`https://ig.me/m/${username}`} target="_blank" rel="noopener noreferrer">
        <Instagram className="h-5 w-5" />
        {label}
      </a>
    </Button>
  );
}
