"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { savePurchaseAction } from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyCode } from "@/types/supabase";

type PurchaseData = {
  purchase_date: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate: number;
  supplier_id: string | null;
  payment_method: string | null;
  notes: string | null;
} | null;

export function PurchaseForm({
  productId,
  purchase,
  suppliers,
  activeRate,
  today,
}: {
  productId: string;
  purchase: PurchaseData;
  suppliers: { id: string; name: string }[];
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>(purchase?.currency ?? "USD");
  const [supplierId, setSupplierId] = React.useState<string>(purchase?.supplier_id ?? "ninguno");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await savePurchaseAction({
      product_id: productId,
      purchase_date: fd.get("purchase_date"),
      amount: fd.get("amount"),
      currency,
      exchange_rate: fd.get("exchange_rate"),
      supplier_id: supplierId === "ninguno" ? null : supplierId,
      payment_method: fd.get("payment_method") || null,
      notes: fd.get("notes") || null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Compra guardada.");
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="purchase_date">Fecha de compra *</Label>
        <Input
          id="purchase_date"
          name="purchase_date"
          type="date"
          required
          defaultValue={purchase?.purchase_date ?? today}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Moneda *</Label>
        <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD — dólares</SelectItem>
            <SelectItem value="UYU">UYU — pesos uruguayos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Precio de compra *</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          inputMode="decimal"
          defaultValue={purchase?.amount ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exchange_rate">Cotización UYU por USD *</Label>
        <Input
          id="exchange_rate"
          name="exchange_rate"
          type="number"
          step="0.0001"
          min="0.0001"
          required
          inputMode="decimal"
          defaultValue={purchase?.exchange_rate ?? activeRate ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Se guarda con la operación y nunca se recalcula.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Proveedor / vendedor</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguno">Sin proveedor</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payment_method">Método de pago</Label>
        <Input
          id="payment_method"
          name="payment_method"
          placeholder="Efectivo, transferencia…"
          defaultValue={purchase?.payment_method ?? ""}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notas de la compra</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={purchase?.notes ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {purchase ? "Actualizar compra" : "Registrar compra"}
        </Button>
      </div>
    </form>
  );
}
