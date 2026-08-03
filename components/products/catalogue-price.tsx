import { catalogueUyuApprox } from "@/services/finance/currency";
import { formatUsd, formatUyu } from "@/lib/formatting/currency";
import { cn } from "@/lib/utils";

/**
 * ÚNICO componente de precio del catálogo público.
 *
 * Formato obligatorio en todo el sitio público:
 *   US$ 450 ($ 18.900 UYU aprox.)
 *
 * - El precio primario es SIEMPRE el USD de lista.
 * - La conversión UYU usa la cotización activa del catálogo y es
 *   aproximada (redondeada al peso).
 * - Si no hay cotización disponible o la conversión está deshabilitada,
 *   se muestra solo el USD.
 *
 * No duplicar esta lógica: usar este componente en tarjetas, detalle,
 * destacados, relacionados y resultados de búsqueda.
 */
export function CataloguePrice({
  priceUsd,
  catalogueRate,
  showUyu = true,
  size = "md",
  className,
}: {
  priceUsd: number;
  catalogueRate: number | null;
  showUyu?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const uyu = showUyu ? catalogueUyuApprox(priceUsd, catalogueRate) : null;

  const usdClass = {
    sm: "text-sm font-semibold",
    md: "text-lg font-semibold",
    lg: "text-2xl font-semibold",
  }[size];

  const uyuClass = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={usdClass}>{formatUsd(priceUsd)}</span>
      {uyu !== null && (
        <span className={cn("text-muted-foreground", uyuClass)}>
          ({formatUyu(uyu)} UYU aprox.)
        </span>
      )}
    </p>
  );
}
