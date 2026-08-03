"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setListingPriceAction } from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUsd, formatUyu } from "@/lib/formatting/currency";
import type { CurrencyCode } from "@/types/supabase";

export function ListingPriceForm({
  productId,
  current,
  activeRate,
  today,
}: {
  productId: string;
  current: {
    amount: number | null;
    currency: CurrencyCode | null;
    usd: number | null;
    uyu: number | null;
    rate: number | null;
  };
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>(current.currency ?? "USD");
  const [amount, setAmount] = React.useState(current.amount?.toString() ?? "");
  const [rate, setRate] = React.useState((current.rate ?? activeRate)?.toString() ?? "");

  const preview = React.useMemo(() => {
    const amt = Number(amount);
    const r = Number(rate);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(r) || r <= 0) return null;
    return currency === "USD"
      ? { usd: amt, uyu: amt * r }
      : { usd: amt / r, uyu: amt };
  }, [amount, rate, currency]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await setListingPriceAction({
      product_id: productId,
      amount,
      currency,
      exchange_rate: rate,
      rate_date: today,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Precio de lista actualizado (histórico registrado).");
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {current.usd !== null && (
        <div className="rounded-lg bg-secondary p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Precio actual: </span>
            <span className="font-medium">{formatUsd(current.usd)}</span>
            <span className="ml-2 text-muted-foreground">
              ({formatUyu(current.uyu ?? 0)} UYU · cotización {current.rate})
            </span>
          </p>
          {current.currency === "UYU" && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              El precio original fue ingresado en UYU; el público ve el equivalente en USD.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Moneda del precio *</Label>
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
          <Label htmlFor="listing-amount">Precio de lista *</Label>
          <Input
            id="listing-amount"
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="listing-rate">Cotización UYU/USD *</Label>
          <Input
            id="listing-rate"
            type="number"
            step="0.0001"
            min="0.0001"
            required
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
      </div>

      {preview && (
        <p className="text-sm text-muted-foreground">
          El catálogo mostrará:{" "}
          <span className="font-medium text-foreground">
            {formatUsd(preview.usd)} ({formatUyu(preview.uyu)} UYU aprox.)
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Cambiar el precio de lista no modifica compras, costos ni ventas históricas. Cada cambio
        queda registrado en el historial de precios.
      </p>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar precio
      </Button>
    </form>
  );
}
