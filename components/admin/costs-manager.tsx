"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addProductCostAction, deleteProductCostAction } from "@/app/admin/productos/actions";
import { CategorySelect } from "@/components/admin/category-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatUsd } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import type { CurrencyCode, PaymentStatus } from "@/types/supabase";

type Cost = {
  id: string;
  category_id: string;
  description: string;
  cost_date: string;
  amount: number;
  currency: CurrencyCode;
  amount_usd: number;
  payment_status: PaymentStatus;
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  parcial: "Parcial",
  pendiente: "Pendiente",
  cancelado: "Cancelado",
};

export function CostsManager({
  productId,
  costs,
  categories,
  suppliers,
  activeRate,
  today,
}: {
  productId: string;
  costs: Cost[];
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  activeRate: number | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [currency, setCurrency] = React.useState<CurrencyCode>("UYU");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [supplierId, setSupplierId] = React.useState("ninguno");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error("Seleccione o cree una categoría para el costo.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await addProductCostAction({
      product_id: productId,
      category_id: categoryId,
      description: fd.get("description") ?? "",
      cost_date: fd.get("cost_date"),
      amount: fd.get("amount"),
      currency,
      exchange_rate: fd.get("exchange_rate"),
      supplier_id: supplierId === "ninguno" ? null : supplierId,
      payment_method: fd.get("payment_method") || null,
      due_date: fd.get("due_date") || null,
      notes: null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Costo agregado.");
      setOpen(false);
      router.refresh();
    }
  };

  const remove = async (costId: string) => {
    const result = await deleteProductCostAction(costId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Costo eliminado.");
      router.refresh();
    }
  };

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reparaciones, service y otros costos directos del reloj.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Agregar costo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo costo del producto</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CategorySelect
                  kind="costo_producto"
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost_date">Fecha *</Label>
                <Input id="cost_date" name="cost_date" type="date" required defaultValue={today} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-amount">Importe *</Label>
                <Input
                  id="cost-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda *</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">UYU — pesos uruguayos</SelectItem>
                    <SelectItem value="USD">USD — dólares</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-rate">Cotización UYU/USD *</Label>
                <Input
                  id="cost-rate"
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
                <Label>Taller / proveedor</Label>
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
                <Label htmlFor="cost-desc">Descripción</Label>
                <Input id="cost-desc" name="description" placeholder="Service completo…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-due">Vencimiento (si queda pendiente)</Label>
                <Input id="cost-due" name="due_date" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-method">Método de pago</Label>
                <Input id="cost-method" name="payment_method" placeholder="Efectivo…" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar costo
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-right">USD</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Sin costos registrados.
                </TableCell>
              </TableRow>
            )}
            {costs.map((cost) => (
              <TableRow key={cost.id}>
                <TableCell className="text-sm">{formatDate(cost.cost_date)}</TableCell>
                <TableCell className="text-sm">{categoryName(cost.category_id)}</TableCell>
                <TableCell className="text-sm">{cost.description || "—"}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatAmount(cost.amount, cost.currency)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatUsd(cost.amount_usd)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      cost.payment_status === "pagado"
                        ? "success"
                        : cost.payment_status === "parcial"
                          ? "warning"
                          : cost.payment_status === "cancelado"
                            ? "outline"
                            : "destructive"
                    }
                  >
                    {PAYMENT_LABEL[cost.payment_status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {cost.payment_status === "pendiente" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => void remove(cost.id)}
                      aria-label="Eliminar costo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
