"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, Plus } from "lucide-react";
import {
  createCashMovementAction,
  createTransferAction,
  createCashAccountAction,
} from "@/app/admin/liquidez/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

type Account = { id: string; name: string; currency: CurrencyCode };

const MOVEMENT_TYPES = [
  { value: "aporte_dueno", label: "Aporte del dueño (entrada)" },
  { value: "otro_ingreso", label: "Otro ingreso (entrada)" },
  { value: "ajuste_positivo", label: "Ajuste positivo (entrada)" },
  { value: "retiro_dueno", label: "Retiro del dueño (salida)" },
  { value: "otro_egreso", label: "Otro egreso (salida)" },
  { value: "ajuste_negativo", label: "Ajuste negativo (salida)" },
] as const;

export function CashMovementDialog({
  accounts,
  activeRate,
  today,
}: {
  accounts: Account[];
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [type, setType] = React.useState<(typeof MOVEMENT_TYPES)[number]["value"]>("aporte_dueno");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await createCashMovementAction({
      account_id: accountId,
      transaction_date: fd.get("transaction_date"),
      type,
      amount: fd.get("amount"),
      exchange_rate: fd.get("exchange_rate"),
      description: fd.get("description"),
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Movimiento registrado.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" /> Movimiento manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento de caja</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cuenta *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-date">Fecha *</Label>
            <Input id="mov-date" name="transaction_date" type="date" required defaultValue={today} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-amount">Importe (moneda de la cuenta) *</Label>
            <Input
              id="mov-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-rate">Cotización UYU/USD *</Label>
            <Input
              id="mov-rate"
              name="exchange_rate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              inputMode="decimal"
              defaultValue={activeRate ?? ""}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mov-desc">Descripción *</Label>
            <Input id="mov-desc" name="description" required minLength={2} placeholder="Aporte inicial…" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar movimiento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransferDialog({
  accounts,
  activeRate,
  today,
}: {
  accounts: Account[];
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [fromId, setFromId] = React.useState(accounts[0]?.id ?? "");
  const [toId, setToId] = React.useState(accounts[1]?.id ?? "");
  const [amountFrom, setAmountFrom] = React.useState("");
  const [rate, setRate] = React.useState(activeRate?.toString() ?? "");

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const crossCurrency = from && to && from.currency !== to.currency;

  const suggestedTo = React.useMemo(() => {
    const amt = Number(amountFrom);
    const r = Number(rate);
    if (!from || !to || !Number.isFinite(amt) || amt <= 0) return "";
    if (!crossCurrency) return String(amt);
    if (!Number.isFinite(r) || r <= 0) return "";
    return from.currency === "USD" ? (amt * r).toFixed(2) : (amt / r).toFixed(2);
  }, [amountFrom, rate, from, to, crossCurrency]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await createTransferAction({
      from_account: fromId,
      to_account: toId,
      transaction_date: fd.get("transaction_date"),
      amount_from: amountFrom,
      amount_to: fd.get("amount_to"),
      exchange_rate: rate,
      description: fd.get("description") ?? "",
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Transferencia registrada.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="h-4 w-4" /> Transferencia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferencia entre cuentas</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Desde *</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Hacia *</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== fromId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-date">Fecha *</Label>
            <Input id="tr-date" name="transaction_date" type="date" required defaultValue={today} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-rate">Cotización UYU/USD *</Label>
            <Input
              id="tr-rate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-from">Sale ({from?.currency}) *</Label>
            <Input
              id="tr-from"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
              value={amountFrom}
              onChange={(e) => setAmountFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-to">Entra ({to?.currency}) *</Label>
            <Input
              id="tr-to"
              name="amount_to"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
              defaultValue={suggestedTo}
              key={suggestedTo}
            />
            {crossCurrency && (
              <p className="text-xs text-muted-foreground">
                Cambio de moneda: verifique el importe recibido real.
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tr-desc">Descripción</Label>
            <Input id="tr-desc" name="description" placeholder="Cambio USD a UYU…" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar transferencia
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>("USD");
  const [type, setType] = React.useState("efectivo");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await createCashAccountAction({
      name: fd.get("name"),
      currency,
      account_type: type,
      initial_balance: fd.get("initial_balance") || 0,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Cuenta creada.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Plus className="h-4 w-4" /> Nueva cuenta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta de caja</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="acc-name">Nombre *</Label>
            <Input id="acc-name" name="name" required minLength={2} placeholder="Caja chica UYU" />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda *</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="UYU">UYU</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="banco">Banco</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="acc-initial">Saldo inicial</Label>
            <Input
              id="acc-initial"
              name="initial_balance"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue="0"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear cuenta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
