"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { saveGeneralExpenseAction } from "@/app/admin/gastos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

type ExpenseDefaults = {
  id: string;
  expense_date: string;
  category_id: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate: number;
  supplier_id: string | null;
  payment_method: string | null;
  due_date: string | null;
  is_recurring: boolean;
} | null;

export function ExpenseDialog({
  categories,
  suppliers,
  activeRate,
  today,
  expense,
  trigger,
}: {
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  activeRate: number | null;
  today: string;
  expense?: ExpenseDefaults;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>(expense?.currency ?? "UYU");
  const [categoryId, setCategoryId] = React.useState(expense?.category_id ?? categories[0]?.id ?? "");
  const [supplierId, setSupplierId] = React.useState(expense?.supplier_id ?? "ninguno");
  const [recurring, setRecurring] = React.useState(expense?.is_recurring ?? false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await saveGeneralExpenseAction(expense?.id ?? null, {
      expense_date: fd.get("expense_date"),
      category_id: categoryId,
      description: fd.get("description"),
      amount: fd.get("amount"),
      currency,
      exchange_rate: fd.get("exchange_rate"),
      supplier_id: supplierId === "ninguno" ? null : supplierId,
      payment_method: fd.get("payment_method") || null,
      due_date: fd.get("due_date") || null,
      is_recurring: recurring,
      notes: null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(expense ? "Gasto actualizado." : "Gasto registrado.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Nuevo gasto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar gasto" : "Nuevo gasto general"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Fecha *</Label>
            <Input
              id="exp-date"
              name="expense_date"
              type="date"
              required
              defaultValue={expense?.expense_date ?? today}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="exp-desc">Descripción *</Label>
            <Input
              id="exp-desc"
              name="description"
              required
              minLength={2}
              defaultValue={expense?.description ?? ""}
              placeholder="Publicidad Instagram agosto…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Importe *</Label>
            <Input
              id="exp-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              inputMode="decimal"
              defaultValue={expense?.amount ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda *</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UYU">UYU — pesos</SelectItem>
                <SelectItem value="USD">USD — dólares</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-rate">Cotización UYU/USD *</Label>
            <Input
              id="exp-rate"
              name="exchange_rate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              inputMode="decimal"
              defaultValue={expense?.exchange_rate ?? activeRate ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
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
            <Label htmlFor="exp-method">Método de pago</Label>
            <Input
              id="exp-method"
              name="payment_method"
              defaultValue={expense?.payment_method ?? ""}
              placeholder="Efectivo, tarjeta…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-due">Vencimiento</Label>
            <Input id="exp-due" name="due_date" type="date" defaultValue={expense?.due_date ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(Boolean(v))} />
            Gasto recurrente (se repite todos los meses)
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar gasto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
