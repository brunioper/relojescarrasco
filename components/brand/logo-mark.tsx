import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marca de Relojes Carrasco (isologo real, public/logo.png).
 *
 * El archivo es blanco sobre transparente: sobre fondos claros se
 * invierte a negro con `invert` para que siga siendo legible.
 */
export function LogoMark({
  className,
  size = 24,
  invert = false,
}: {
  className?: string;
  size?: number;
  invert?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Relojes Carrasco"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", invert && "invert", className)}
    />
  );
}
