"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import {
  createExchangeRateAction,
  setCatalogueRateModeAction,
  toggleRateActiveAction,
} from "@/app/admin/cotizaciones/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export function NewRateDialog({ today }: { today: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await createExchangeRateAction({
      rate: fd.get("rate"),
      buy_rate: fd.get("buy_rate") || null,
      sell_rate: fd.get("sell_rate") || null,
      rate_date: fd.get("rate_date"),
      source: "manual",
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Cotización registrada.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Nueva cotización
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cotización USD/UYU</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rate-date">Fecha *</Label>
            <Input id="rate-date" name="rate_date" type="date" required defaultValue={today} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-value">Cotización aplicada (UYU por USD) *</Label>
            <Input
              id="rate-value"
              name="rate"
              type="number"
              step="0.0001"
              min="0.0001"
              required
              inputMode="decimal"
              placeholder="40.50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-buy">Compra (opcional)</Label>
            <Input id="rate-buy" name="buy_rate" type="number" step="0.0001" min="0" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-sell">Venta (opcional)</Label>
            <Input id="rate-sell" name="sell_rate" type="number" step="0.0001" min="0" inputMode="decimal" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cotización
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FetchRateButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const fetchRate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/exchange-rate/refresh", { method: "POST" });
      const body = (await response.json()) as { ok: boolean; error?: string; rate?: number };
      if (!response.ok || !body.ok) {
        toast.error(body.error ?? "No se pudo obtener la cotización automática.");
      } else {
        toast.success(`Cotización obtenida: $ ${body.rate} por US$ 1.`);
        router.refresh();
      }
    } catch {
      toast.error("El servicio de cotizaciones no está disponible. Cargue la cotización manualmente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={() => void fetchRate()} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Obtener automática
    </Button>
  );
}

export function RateActiveSwitch({ rateId, isActive }: { rateId: string; isActive: boolean }) {
  const router = useRouter();
  return (
    <Switch
      checked={isActive}
      aria-label={isActive ? "Desactivar cotización" : "Activar cotización"}
      onCheckedChange={async (checked) => {
        const result = await toggleRateActiveAction(rateId, checked);
        if (!result.ok) toast.error(result.error);
        else router.refresh();
      }}
    />
  );
}

export function CatalogueRateModeForm({
  mode,
  fixedValue,
}: {
  mode: "latest" | "fixed";
  fixedValue: number | null;
}) {
  const router = useRouter();
  const [currentMode, setCurrentMode] = React.useState<"latest" | "fixed">(mode);
  const [value, setValue] = React.useState(fixedValue?.toString() ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const result = await setCatalogueRateModeAction({
      mode: currentMode,
      value: currentMode === "fixed" ? Number(value) : null,
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Cotización del catálogo actualizada.");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label>Modo</Label>
        <Select value={currentMode} onValueChange={(v) => setCurrentMode(v as "latest" | "fixed")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Última cotización activa</SelectItem>
            <SelectItem value="fixed">Valor fijo manual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {currentMode === "fixed" && (
        <div className="space-y-1.5">
          <Label htmlFor="fixed-rate">Valor fijo (UYU por USD)</Label>
          <Input
            id="fixed-rate"
            type="number"
            step="0.0001"
            min="0.0001"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-40"
          />
        </div>
      )}
      <Button onClick={() => void save()} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </div>
  );
}
