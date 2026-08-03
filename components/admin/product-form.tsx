"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { productSchema, type ProductInput } from "@/lib/validation/schemas";
import { createProductAction, updateProductAction } from "@/app/admin/productos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOVEMENTS = [
  { value: "automatico", label: "Automático" },
  { value: "manual", label: "Manual (cuerda)" },
  { value: "cuarzo", label: "Cuarzo" },
  { value: "solar", label: "Solar" },
  { value: "otro", label: "Otro" },
] as const;

export function ProductForm({
  productId,
  defaultValues,
}: {
  productId?: string;
  defaultValues?: Partial<ProductInput>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      brand: "",
      model: "",
      movement: "automatico",
      condition: "",
      public_description: "",
      includes_box: false,
      includes_documentation: false,
      is_featured: false,
      ...defaultValues,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = form;

  // Aviso de cambios sin guardar
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !submitting) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, submitting]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const result = productId
      ? await updateProductAction(productId, values)
      : await createProductAction(values);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(productId ? "Producto actualizado." : "Producto creado.");
    if (!productId && result.data && "id" in (result.data as object)) {
      router.push(`/admin/productos/${(result.data as { id: string }).id}`);
    } else {
      router.refresh();
    }
  });

  const err = (field: keyof ProductInput) =>
    errors[field] ? (
      <p className="text-xs text-destructive">{errors[field]?.message as string}</p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Nombre del reloj *</Label>
            <Input id="name" {...register("name")} placeholder="Omega Seamaster Automático" />
            {err("name")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand">Marca *</Label>
            <Input id="brand" {...register("brand")} placeholder="Omega" />
            {err("brand")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Modelo</Label>
            <Input id="model" {...register("model")} placeholder="Seamaster" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference_number">Número de referencia</Label>
            <Input id="reference_number" {...register("reference_number")} placeholder="166.032" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serial_number">Número de serie (privado)</Label>
            <Input id="serial_number" {...register("serial_number")} />
            <p className="text-xs text-muted-foreground">Nunca se muestra públicamente.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="year_approx">Año aproximado</Label>
            <Input
              id="year_approx"
              type="number"
              inputMode="numeric"
              {...register("year_approx", {
                setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
              })}
            />
            {err("year_approx")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles técnicos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo de movimiento</Label>
            <Select
              value={watch("movement")}
              onValueChange={(v) => setValue("movement", v as ProductInput["movement"], { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENTS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diameter_mm">Diámetro (mm)</Label>
            <Input
              id="diameter_mm"
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("diameter_mm", {
                setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
              })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case_material">Material de caja</Label>
            <Input id="case_material" {...register("case_material")} placeholder="Acero" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="strap_material">Material de correa</Label>
            <Input id="strap_material" {...register("strap_material")} placeholder="Cuero" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="water_resistance">Resistencia al agua</Label>
            <Input id="water_resistance" {...register("water_resistance")} placeholder="100 m" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Género / categoría</Label>
            <Input id="gender" {...register("gender")} placeholder="Hombre / Mujer / Unisex" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado y accesorios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="condition">Estado de conservación</Label>
            <Input
              id="condition"
              {...register("condition")}
              placeholder="Muy bueno — service reciente, mínimas marcas de uso"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={watch("includes_box")}
                onCheckedChange={(v) => setValue("includes_box", Boolean(v), { shouldDirty: true })}
              />
              Incluye caja
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={watch("includes_documentation")}
                onCheckedChange={(v) =>
                  setValue("includes_documentation", Boolean(v), { shouldDirty: true })
                }
              />
              Incluye documentación
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={watch("is_featured")}
                onCheckedChange={(v) => setValue("is_featured", Boolean(v), { shouldDirty: true })}
              />
              Destacado en la portada
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="includes_accessories">Accesorios incluidos</Label>
            <Input
              id="includes_accessories"
              {...register("includes_accessories")}
              placeholder="Eslabones adicionales, estuche de viaje…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="public_description">Descripción pública</Label>
            <Textarea
              id="public_description"
              rows={5}
              {...register("public_description")}
              placeholder="Descripción que verán los visitantes del catálogo…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="internal_notes">Notas internas (privadas)</Label>
            <Textarea id="internal_notes" rows={3} {...register("internal_notes")} />
            <p className="text-xs text-muted-foreground">Solo visibles en este panel.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {productId ? "Guardar cambios" : "Crear reloj"}
        </Button>
        {isDirty && !submitting && (
          <p className="text-sm text-amber-700">Hay cambios sin guardar</p>
        )}
      </div>
    </form>
  );
}
