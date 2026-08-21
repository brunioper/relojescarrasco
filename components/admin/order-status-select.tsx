"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrderStatusAction } from "@/app/admin/pedidos/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderRequestStatus } from "@/types/supabase";

const OPTIONS: { value: OrderRequestStatus; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
];

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderRequestStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={async (value) => {
        setPending(true);
        const result = await updateOrderStatusAction(orderId, value);
        setPending(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Estado actualizado.");
        router.refresh();
      }}
    >
      <SelectTrigger className="h-8 w-36 text-sm" aria-label="Cambiar estado del pedido">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
