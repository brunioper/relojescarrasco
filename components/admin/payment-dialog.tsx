"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { registerPaymentAction } from "@/app/admin/pagos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type PendingItem = {
  transactionType: "venta" | "compra" | "costo_producto" | "gasto_general" | "gasto_venta";
  transactionId: string;
  label: string;
  currency: CurrencyCode;
  outstanding: number;
};

const TYPE_LABEL: Record<PendingItem["transactionType"], string> = {
  venta: "Cobro de venta",
  compra: "Pago de compra",
  costo_producto: "Pago de costo",
  gasto_general: "Pago de gasto",
  gasto_venta: "Pago gasto de venta",
};

export function PaymentDialog({
  pendingItems,
  cashAccounts,
  activeRate,
  today,
}: {
  pendingItems: PendingItem[];
  cashAccounts: { id: string; name: string; currency: CurrencyCode }[];
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState<string>("");
  const [accountId, setAccountId] = React.useState("ninguna");
  const [amount, setAmount] = React.useState("");

  const selected = pendingItems.find(
    (i) => `${i.transactionType}:${i.transactionId}` === selectedKey
  );
  const accountsForCurrency = selected
    ? cashAccounts.filter((a) => a.currency === selected.currency)
    : [];

  React.useEffect(() => {
    if (selected) {
      setAmount(String(selected.outstanding));
      setAccountId("ninguna");
    }
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) {
      toast.error("Seleccione el comprobante a pagar/cobrar.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await registerPaymentAction({
      transaction_type: selected.transactionType,
      transaction_id: selected.transactionId,
      payment_date: fd.get("payment_date"),
      amount,
      currency: selected.currency,
      exchange_rate: fd.get("exchange_rate"),
      payment_method: fd.get("payment_method") || null,
      cash_account_id: accountId === "ninguna" ? null : accountId,
      notes: fd.get("notes") || null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Pago registrado.");
      setOpen(false);
      setSelectedKey("");
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Registrar pago / cobro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago o cobro</DialogTitle>
          <DialogDescription>
            Se admiten pagos parciales: el saldo y el estado se recalculan automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Comprobante *</Label>
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar comprobante con saldo…" />
              </SelectTrigger>
              <SelectContent>
                {pendingItems.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No hay comprobantes con saldo pendiente.
                  </div>
                )}
                {pendingItems.map((item) => (
                  <SelectItem
                    key={`${item.transactionType}:${item.transactionId}`}
                    value={`${item.transactionType}:${item.transactionId}`}
                  >
                    {TYPE_LABEL[item.transactionType]} — {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Saldo pendiente: {selected.currency === "USD" ? "US$" : "$"} {selected.outstanding}{" "}
                {selected.currency}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Fecha *</Label>
              <Input id="pay-date" name="payment_date" type="date" required defaultValue={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">
                Importe {selected ? `(${selected.currency})` : ""} *
              </Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-rate">Cotización UYU/USD *</Label>
              <Input
                id="pay-rate"
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
              <Label>Cuenta de caja</Label>
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
              <Label htmlFor="pay-method">Método</Label>
              <Input id="pay-method" name="payment_method" placeholder="Efectivo…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-notes">Nota</Label>
              <Input id="pay-notes" name="notes" placeholder="Cuota 2 de 3…" />
            </div>
          </div>

          <Button type="submit" disabled={saving || !selected} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
