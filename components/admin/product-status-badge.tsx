import { Badge } from "@/components/ui/badge";
import type { ProductStatus } from "@/types/supabase";

const CONFIG: Record<ProductStatus, { label: string; variant: "success" | "warning" | "info" | "secondary" | "outline" | "destructive" }> = {
  disponible: { label: "Disponible", variant: "success" },
  reservado: { label: "Reservado", variant: "warning" },
  vendido: { label: "Vendido", variant: "info" },
  en_reparacion: { label: "En reparación", variant: "secondary" },
  no_publicado: { label: "No publicado", variant: "outline" },
  archivado: { label: "Archivado", variant: "destructive" },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { label, variant } = CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
