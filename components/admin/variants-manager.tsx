"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import {
  saveCompatibilityAction,
  saveVariantsAction,
} from "@/app/admin/productos/variantes-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  compatibilityLabel,
  findDuplicateVariant,
  generateVariantCombos,
  parseList,
  parseWidths,
  variantLabel,
  type Compatibility,
} from "@/lib/variants";

type Row = {
  key: string;
  id: string | null;
  width: string;
  material: string;
  color: string;
  stock: string;
  price: string;
  active: boolean;
};

export type VariantInitial = {
  id: string;
  width_mm: number | null;
  material: string | null;
  color: string | null;
  stock_quantity: number;
  price_usd: number | null;
  is_active: boolean;
};

let rowCounter = 0;
const newKey = () => `fila-${++rowCounter}`;

function toRow(v: VariantInitial): Row {
  return {
    key: v.id,
    id: v.id,
    width: v.width_mm === null ? "" : String(v.width_mm),
    material: v.material ?? "",
    color: v.color ?? "",
    stock: String(v.stock_quantity),
    price: v.price_usd === null ? "" : String(v.price_usd),
    active: v.is_active,
  };
}

const num = (value: string): number | null => {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Tabla tipo planilla para cargar variantes de una correa o accesorio:
 * una fila por combinación de ancho, material y color, con su stock.
 * Pensada para cargar rápido: generar combinaciones, duplicar una fila
 * y moverse con Tab. El stock total del producto es la suma de las filas.
 */
export function VariantsManager({
  productId,
  initialVariants,
  listingUsd,
}: {
  productId: string;
  initialVariants: VariantInitial[];
  listingUsd: number | null;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(() => initialVariants.map(toRow));
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [genWidths, setGenWidths] = React.useState("");
  const [genMaterials, setGenMaterials] = React.useState("");
  const [genColors, setGenColors] = React.useState("");
  const [genStock, setGenStock] = React.useState("1");

  const update = (key: string, patch: Partial<Row>) => {
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = (base?: Row) => {
    setDirty(true);
    setRows((prev) => {
      const fresh: Row = base
        ? { ...base, key: newKey(), id: null }
        : { key: newKey(), id: null, width: "", material: "", color: "", stock: "1", price: "", active: true };
      if (!base) return [...prev, fresh];
      const index = prev.findIndex((r) => r.key === base.key);
      return [...prev.slice(0, index + 1), fresh, ...prev.slice(index + 1)];
    });
  };

  const removeRow = (key: string) => {
    setDirty(true);
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const generate = () => {
    const widths = parseWidths(genWidths);
    const materials = parseList(genMaterials);
    const colors = parseList(genColors);
    if (widths.length === 0 && materials.length === 0 && colors.length === 0) {
      toast.error("Escribí al menos un ancho, un material o un color.");
      return;
    }
    const existing = rows.map((r) => ({
      width_mm: num(r.width),
      material: r.material || null,
      color: r.color || null,
    }));
    const created = generateVariantCombos(existing, { widths, materials, colors });
    if (created.length === 0) {
      toast.message("Esas combinaciones ya están en la tabla.");
      return;
    }
    const stock = String(Math.max(0, Math.floor(Number(genStock) || 0)));
    setDirty(true);
    setRows((prev) => [
      ...prev,
      ...created.map((c) => ({
        key: newKey(),
        id: null,
        width: c.width_mm === null ? "" : String(c.width_mm),
        material: c.material ?? "",
        color: c.color ?? "",
        stock,
        price: "",
        active: true,
      })),
    ]);
    toast.success(`${created.length} variante${created.length === 1 ? "" : "s"} agregada${created.length === 1 ? "" : "s"}. Revisá el stock y guardá.`);
  };

  const totalStock = rows.reduce(
    (acc, r) => acc + (r.active ? Math.max(0, Math.floor(Number(r.stock) || 0)) : 0),
    0
  );

  const save = async () => {
    const payload = rows.map((r) => ({
      id: r.id,
      width_mm: num(r.width),
      material: r.material.trim() || null,
      color: r.color.trim() || null,
      stock_quantity: Number(r.stock),
      price_usd: num(r.price),
      is_active: r.active,
    }));

    for (const [i, row] of payload.entries()) {
      if (Number.isNaN(row.width_mm) || (row.width_mm !== null && (row.width_mm <= 0 || row.width_mm > 60))) {
        toast.error(`Fila ${i + 1}: el ancho debe ser un número en mm (por ejemplo 20).`);
        return;
      }
      if (!Number.isInteger(row.stock_quantity) || row.stock_quantity < 0) {
        toast.error(`Fila ${i + 1}: el stock debe ser un número entero (0 o más).`);
        return;
      }
      if (Number.isNaN(row.price_usd) || (row.price_usd !== null && row.price_usd < 0)) {
        toast.error(`Fila ${i + 1}: el precio debe ser un número (o quedar vacío).`);
        return;
      }
      if (row.width_mm === null && !row.material && !row.color) {
        toast.error(`Fila ${i + 1}: completá al menos ancho, material o color.`);
        return;
      }
    }
    const duplicate = findDuplicateVariant(payload);
    if (duplicate) {
      toast.error(`Hay una variante repetida: ${variantLabel(duplicate)}.`);
      return;
    }

    setSaving(true);
    const result = await saveVariantsAction({ product_id: productId, rows: payload });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Variantes guardadas. El stock total se actualizó.");
    setDirty(false);
    router.refresh();
  };

  // Tras guardar, el servidor devuelve las variantes con sus ids definitivos.
  const initialSignature = initialVariants.map((v) => `${v.id}:${v.stock_quantity}`).join(",");
  React.useEffect(() => {
    if (!dirty) setRows(initialVariants.map(toRow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSignature]);

  const cell = "h-10 min-w-0 text-base md:text-sm";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="h-4 w-4" /> Generar combinaciones
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Separá con comas. Ejemplo: anchos «18, 20, 22» y colores «Negro, Marrón» crea 6 variantes. Medios
          anchos con punto (19.5).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="gen-anchos" className="text-xs">Anchos (mm)</Label>
            <Input id="gen-anchos" value={genWidths} onChange={(e) => setGenWidths(e.target.value)} placeholder="18, 20, 22" inputMode="decimal" className={cell} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-materiales" className="text-xs">Materiales</Label>
            <Input id="gen-materiales" value={genMaterials} onChange={(e) => setGenMaterials(e.target.value)} placeholder="Cuero" className={cell} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-colores" className="text-xs">Colores</Label>
            <Input id="gen-colores" value={genColors} onChange={(e) => setGenColors(e.target.value)} placeholder="Negro, Marrón" className={cell} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gen-stock" className="text-xs">Stock de cada una</Label>
            <Input id="gen-stock" value={genStock} onChange={(e) => setGenStock(e.target.value)} inputMode="numeric" className={cell} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" className="h-10 w-full" onClick={generate}>
              Generar
            </Button>
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-24 px-1 font-medium">Ancho (mm)</th>
              <th className="px-1 font-medium">Material</th>
              <th className="px-1 font-medium">Color</th>
              <th className="w-24 px-1 font-medium">Stock</th>
              <th className="w-32 px-1 font-medium">Precio USD</th>
              <th className="w-16 px-1 font-medium">Activa</th>
              <th className="w-24 px-1"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="rounded-md border border-dashed px-3 py-8 text-center text-muted-foreground">
                  Sin variantes. Este producto usa un único stock (el de la pestaña Datos). Agregá filas
                  si se vende en distintos anchos, materiales o colores.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.key}>
                <td className="px-1">
                  <Input aria-label={`Ancho de la fila ${i + 1}`} value={row.width} onChange={(e) => update(row.key, { width: e.target.value })} inputMode="decimal" placeholder="20" className={cell} />
                </td>
                <td className="px-1">
                  <Input aria-label={`Material de la fila ${i + 1}`} value={row.material} onChange={(e) => update(row.key, { material: e.target.value })} placeholder="Cuero" className={cell} />
                </td>
                <td className="px-1">
                  <Input aria-label={`Color de la fila ${i + 1}`} value={row.color} onChange={(e) => update(row.key, { color: e.target.value })} placeholder="Marrón" className={cell} />
                </td>
                <td className="px-1">
                  <Input aria-label={`Stock de la fila ${i + 1}`} value={row.stock} onChange={(e) => update(row.key, { stock: e.target.value })} inputMode="numeric" className={cell} />
                </td>
                <td className="px-1">
                  <Input aria-label={`Precio de la fila ${i + 1}`} value={row.price} onChange={(e) => update(row.key, { price: e.target.value })} inputMode="decimal" placeholder={listingUsd !== null ? String(listingUsd) : "Lista"} className={cell} />
                </td>
                <td className="px-1 text-center">
                  <input type="checkbox" aria-label={`Fila ${i + 1} activa`} checked={row.active} onChange={(e) => update(row.key, { active: e.target.checked })} className="h-5 w-5 accent-[var(--primary)]" />
                </td>
                <td className="px-1">
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Duplicar fila ${i + 1}`} title="Duplicar" onClick={() => addRow(row)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Quitar fila ${i + 1}`} title="Quitar" onClick={() => removeRow(row.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => addRow()}>
          <Plus className="h-4 w-4" /> Agregar fila
        </Button>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {rows.length} variante{rows.length === 1 ? "" : "s"} · stock total:{" "}
            <span className="font-medium text-foreground">{totalStock}</span>
            {dirty && <span className="ml-2 text-amber-700">Cambios sin guardar</span>}
          </p>
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar variantes
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El precio vacío usa el precio de lista del producto. Una variante inactiva no se muestra en
        el sitio ni suma al stock.
      </p>
    </div>
  );
}

/** Con qué relojes es compatible la correa: "Rolex" o "Rolex Submariner", uno por línea. */
export function CompatibilityManager({
  productId,
  initial,
}: {
  productId: string;
  initial: Compatibility[];
}) {
  const router = useRouter();
  const [text, setText] = React.useState(() =>
    initial.map((c) => (c.model ? `${c.brand} | ${c.model}` : c.brand)).join("\n")
  );
  const [saving, setSaving] = React.useState(false);

  const parsed: Compatibility[] = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [brand, ...rest] = line.split("|");
      const model = rest.join("|").trim();
      return { brand: (brand ?? "").trim(), model: model || null };
    })
    .filter((c) => c.brand !== "");

  const save = async () => {
    setSaving(true);
    const result = await saveCompatibilityAction({ product_id: productId, items: parsed });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Compatibilidad guardada.");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="compatibilidad">Relojes compatibles</Label>
      <textarea
        id="compatibilidad"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"Rolex | Submariner\nOmega | Seamaster\nTudor"}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Una línea por reloj: «Marca | Modelo». Solo la marca significa todos sus modelos. En el sitio
        el cliente elige su reloj y ve las correas compatibles.
      </p>
      {parsed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Se mostrará: {parsed.map(compatibilityLabel).join(" · ")}
        </p>
      )}
      <Button type="button" variant="outline" onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar compatibilidad
      </Button>
    </div>
  );
}
