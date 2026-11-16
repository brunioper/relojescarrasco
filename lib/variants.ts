/**
 * Variantes de correas y accesorios (lógica pura, testeable).
 */

export type VariantLike = {
  width_mm: number | null;
  material: string | null;
  color: string | null;
};

/** "20 mm · Cuero · Marrón" (omite lo que no esté cargado). */
export function variantLabel(variant: VariantLike): string {
  const parts: string[] = [];
  if (variant.width_mm !== null && variant.width_mm !== undefined) {
    parts.push(`${formatWidth(variant.width_mm)} mm`);
  }
  if (variant.material?.trim()) parts.push(variant.material.trim());
  if (variant.color?.trim()) parts.push(variant.color.trim());
  return parts.length > 0 ? parts.join(" · ") : "Única";
}

export function formatWidth(width: number): string {
  return Number.isInteger(width) ? String(width) : String(width).replace(".", ",");
}

/** Clave para detectar combinaciones repetidas (misma regla que el índice único de la base). */
export function variantKey(variant: VariantLike): string {
  return [
    variant.width_mm ?? 0,
    (variant.material ?? "").trim().toLowerCase(),
    (variant.color ?? "").trim().toLowerCase(),
  ].join("|");
}

/** Separa "18, 20; 22" o "Negro, Marrón" en una lista sin vacíos ni repetidos. */
export function parseList(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Anchos válidos (mm) a partir de un texto como "18, 20, 22mm". */
export function parseWidths(input: string): number[] {
  const widths: number[] = [];
  for (const item of parseList(input)) {
    const n = Number(item.replace(/mm/i, "").replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0 && n <= 60 && !widths.includes(n)) widths.push(n);
  }
  return widths.sort((a, b) => a - b);
}

/**
 * Genera todas las combinaciones ancho × material × color que todavía
 * no existen. Una lista vacía cuenta como "sin ese dato".
 */
export function generateVariantCombos(
  existing: VariantLike[],
  input: { widths: number[]; materials: string[]; colors: string[] }
): VariantLike[] {
  const widths: (number | null)[] = input.widths.length > 0 ? input.widths : [null];
  const materials: (string | null)[] = input.materials.length > 0 ? input.materials : [null];
  const colors: (string | null)[] = input.colors.length > 0 ? input.colors : [null];

  const taken = new Set(existing.map(variantKey));
  const created: VariantLike[] = [];

  for (const material of materials) {
    for (const color of colors) {
      for (const width_mm of widths) {
        const candidate = { width_mm, material, color };
        if (width_mm === null && material === null && color === null) continue;
        const key = variantKey(candidate);
        if (taken.has(key)) continue;
        taken.add(key);
        created.push(candidate);
      }
    }
  }
  return created;
}

/** Primera combinación repetida dentro de una lista, o null. */
export function findDuplicateVariant(variants: VariantLike[]): VariantLike | null {
  const seen = new Set<string>();
  for (const variant of variants) {
    const key = variantKey(variant);
    if (seen.has(key)) return variant;
    seen.add(key);
  }
  return null;
}

export type PublicVariant = {
  id: string;
  width_mm: number | null;
  material: string | null;
  color: string | null;
  stock: number;
  price_usd: number | null;
};

/** Lee las variantes de la vista pública (JSON) de forma segura. */
export function readPublicVariants(raw: unknown): PublicVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicVariant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    if (typeof v.id !== "string") continue;
    out.push({
      id: v.id,
      width_mm: typeof v.width_mm === "number" ? v.width_mm : null,
      material: typeof v.material === "string" ? v.material : null,
      color: typeof v.color === "string" ? v.color : null,
      stock: typeof v.stock === "number" ? v.stock : 0,
      price_usd: typeof v.price_usd === "number" ? v.price_usd : null,
    });
  }
  return out;
}

export type Compatibility = { brand: string; model: string | null };

export function readCompatibility(raw: unknown): Compatibility[] {
  if (!Array.isArray(raw)) return [];
  const out: Compatibility[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.brand !== "string" || !c.brand.trim()) continue;
    out.push({ brand: c.brand, model: typeof c.model === "string" && c.model ? c.model : null });
  }
  return out;
}

/** "Rolex Submariner", "Omega (todos los modelos)". */
export function compatibilityLabel(item: Compatibility): string {
  return item.model ? `${item.brand} ${item.model}` : `${item.brand} (todos los modelos)`;
}
