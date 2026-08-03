"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { markSoldAction } from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyCode } from "@/types/supabase";

/**
 * Registro de venta: llama a la RPC atómica mark_product_sold.
 * Si la fecha de venta es anterior a la compra, exige confirmación explícita.
 */
export function SellDialog({
  productId,
  productName,
  listingUsd,
  customers,
  cashAccounts,
  activeRate,
  today,
  purchaseDate,
}: {
  productId: string;
  productName: string;
  listingUsd: number | null;
  customers: { id: string; full_name: string }[];
  cashAccounts: { id: string; name: string; currency: CurrencyCode }[];
  activeRate: number | null;
  today: string;
  purchaseDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>("USD");
  const [customerId, setCustomerId] = React.useState("ninguno");
  const [accountId, setAccountId] = React.useState("ninguna");
  const [saleDate, setSaleDate] = React.useState(today);
  const [allowEarly, setAllowEarly] = React.useState(false);

  const dateBeforePurchase = purchaseDate !== null && saleDate < purchaseDate;
  const accountsForCurrency = cashAccounts.filter((a) => a.currency === currency);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (dateBeforePurchase && !allowEarly) {
      toast.error("La fecha de venta es anterior a la compra: confirme la excepción.");
      return;
    }

    setSaving(true);
    const result = await markSoldAction({
      product_id: productId,
      sale_date: saleDate,
      amount: fd.get("amount"),
      currency,
      exchange_rate: fd.get("exchange_rate"),
      customer_id: customerId === "ninguno" ? null : customerId,
      payment_method: fd.get("payment_method") || null,
      amount_received: fd.get("amount_received") || 0,
      cash_account_id: accountId === "ninguna" ? null : accountId,
      due_date: fd.get("due_date") || null,
      notes: fd.get("notes") || null,
      expenses: [],
      allow_date_before_purchase: allowEarly,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Venta registrada. El reloj salió del catálogo público.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ShoppingCart className="h-4 w-4" /> Registrar venta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Vender: {productName}</DialogTitle>
          <DialogDescription>
            La operación es atómica: crea la venta, el cobro inicial y saca el reloj del catálogo.
            {listingUsd !== null && ` Precio de lista actual: US$ ${listingUsd}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sale-date">Fecha de venta *</Label>
            <Input
              id="sale-date"
              type="date"
              required
              max={today}
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda *</Label>
            <Select
              value={currency}
              onValueChange={(v) => {
                setCurrency(v as CurrencyCode);
                setAccountId("ninguna");
              }}
            >
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
            <Label htmlFor="sale-amount">Precio real de venta *</Label>
            <Input
              id="sale-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              inputMode="decimal"
              defaultValue={currency === "USD" && listingUsd !== null ? listingUsd : ""}
            />
            <p className="text-xs text-muted-foreground">Puede diferir del precio de lista.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-rate">Cotización del día *</Label>
            <Input
              id="sale-rate"
              name="exchange_rate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              inputMode="decimal"
              defaultValue={activeRate ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin registrar</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-method">Método de pago</Label>
            <Input id="sale-method" name="payment_method" placeholder="Efectivo, transferencia…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-received">Importe cobrado ahora</Label>
            <Input
              id="sale-received"
              name="amount_received"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue="0"
            />
            <p className="text-xs text-muted-foreground">
              0 si aún no cobró nada; el saldo queda como cuenta por cobrar.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Cuenta de caja del cobro</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin registrar en caja</SelectItem>
                {accountsForCurrency.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-due">Vencimiento del saldo</Label>
            <Input id="sale-due" name="due_date" type="date" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sale-notes">Notas internas</Label>
            <Textarea id="sale-notes" name="notes" rows={2} />
          </div>

          {dateBeforePurchase && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
              <Checkbox
                checked={allowEarly}
                onCheckedChange={(v) => setAllowEarly(Boolean(v))}
                className="mt-0.5"
              />
              La fecha de venta es anterior a la fecha de compra registrada. Confirmo que es
              correcto.
            </label>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar venta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
