"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createExpenseCategoryAction } from "@/app/admin/categorias/actions";
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
import type { Enums } from "@/types/supabase";

const NEW_CATEGORY_VALUE = "__nueva_categoria__";

/**
 * Select de categoría con opción de crear una nueva sin salir del formulario.
 * Reutilizado por costos de producto, gastos generales y gastos de venta.
 */
export function CategorySelect({
  kind,
  categories,
  value,
  onChange,
  label = "Categoría",
  required = true,
}: {
  kind: Enums<"expense_category_kind">;
  categories: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const createCategory = async () => {
    const name = newName.trim();
    if (name.length < 2) {
      toast.error("Ingrese un nombre para la categoría (mínimo 2 caracteres).");
      return;
    }
    setSaving(true);
    const result = await createExpenseCategoryAction(name, kind);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Categoría "${result.data.name}" lista.`);
    onChange(result.data.id);
    setNewName("");
    setCreating(false);
    router.refresh();
  };

  if (creating) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la nueva categoría…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createCategory();
              }
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <Button type="button" size="sm" onClick={() => void createCategory()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && "*"}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === NEW_CATEGORY_VALUE) {
            setCreating(true);
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar…" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_CATEGORY_VALUE}>
            <span className="flex items-center gap-1.5 text-gold">
              <Plus className="h-3.5 w-3.5" /> Nueva categoría…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
