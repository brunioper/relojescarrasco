import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botón de consulta por WhatsApp. El número es configurable desde
 * la administración (application_settings.whatsapp_number).
 */
export function WhatsAppButton({
  phoneNumber,
  message,
  label = "Consultar por WhatsApp",
  size = "lg",
}: {
  phoneNumber: string;
  message: string;
  label?: string;
  size?: "default" | "lg" | "sm";
}) {
  if (!phoneNumber) return null;

  const href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild size={size} className="bg-[#25D366] text-white hover:bg-[#1fb958]">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-5 w-5" />
        {label}
      </a>
    </Button>
  );
}

export function buildProductInquiryMessage(productName: string, model: string): string {
  const detail = [productName, model].filter(Boolean).join(" ");
  return `Hola, estoy interesado en el ${detail} publicado en Relojes Carrasco. ¿Sigue disponible?`;
}
