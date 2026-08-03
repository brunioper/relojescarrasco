"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeStatusAction } from "@/app/admin/productos/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductStatus } from "@/types/supabase";

const EDITABLE_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "disponible", label: "Disponible" },
  { value: "reservado", label: "Reservado" },
  { value: "en_reparacion", label: "En reparación" },
  { value: "no_publicado", label: "No publicado" },
];

/**
 * Selector de estado visible y directo en la página del producto.
 * Cambiar a "Disponible" o "Reservado" es lo que habilita el botón Publicar
 * (un producto "no publicado" o "en reparación" no puede publicarse).
 * No se usa para "vendido" (requiere el flujo de venta) ni "archivado"
 * (acción separada, con confirmación).
 */
export function ProductStatusSelect({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (status === "vendido" || status === "archivado") return null;

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={async (value) => {
        setPending(true);
        const result = await changeStatusAction(productId, value);
        setPending(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Estado actualizado.");
        router.refresh();
      }}
    >
      <SelectTrigger className="h-8 w-44 text-sm" aria-label="Cambiar estado del producto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EDITABLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
