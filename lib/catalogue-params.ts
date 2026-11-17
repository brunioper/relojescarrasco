/**
 * Lectura y validación de los filtros del catálogo desde la URL.
 *
 * Lógica pura (sin acceso a datos) para poder testearla: cualquier valor
 * inválido en la URL se descarta en lugar de romper la consulta.
 */

export type CatalogueSort = "newest" | "oldest" | "price_asc" | "price_desc" | "updated";

export const CATALOGUE_SORTS: readonly CatalogueSort[] = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "updated",
] as const;

export const MOVEMENT_VALUES = ["automatico", "manual", "cuarzo", "solar", "otro"] as const;
export type MovementValue = (typeof MOVEMENT_VALUES)[number];

/** Rangos de precio (USD) que se ofrecen como opciones rápidas. */
export const PRICE_RANGES = [
  { value: "hasta-1000", label: "Hasta US$ 1.000", min: undefined, max: 1000 },
  { value: "1000-3000", label: "US$ 1.000 a 3.000", min: 1000, max: 3000 },
  { value: "3000-7000", label: "US$ 3.000 a 7.000", min: 3000, max: 7000 },
  { value: "7000-mas", label: "Más de US$ 7.000", min: 7000, max: undefined },
] as const;

/** Rangos de diámetro de caja (mm). */
export const SIZE_RANGES = [
  { value: "hasta-36", label: "Hasta 36 mm", min: undefined, max: 36 },
  { value: "37-39", label: "37 a 39 mm", min: 37, max: 39.9 },
  { value: "40-42", label: "40 a 42 mm", min: 40, max: 42.9 },
  { value: "43-mas", label: "43 mm o más", min: 43, max: undefined },
] as const;

export type SizeRangeValue = (typeof SIZE_RANGES)[number]["value"];

export type CatalogueFilters = {
  q?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  movement?: MovementValue;
  material?: string;
  size?: SizeRangeValue;
  box?: boolean;
  docs?: boolean;
  status?: "disponible" | "reservado";
  category?: "reloj" | "accesorio";
  sort: CatalogueSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function readParam(params: RawParams, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed.slice(0, 120);
}

function readPositiveNumber(params: RawParams, key: string): number | undefined {
  const raw = readParam(params, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function parseCatalogueParams(params: RawParams): CatalogueFilters {
  const pageRaw = readPositiveNumber(params, "pagina");
  const page = pageRaw !== undefined ? Math.max(1, Math.floor(pageRaw)) : 1;

  return {
    q: readParam(params, "q"),
    brand: readParam(params, "marca"),
    movement: oneOf(readParam(params, "movimiento"), MOVEMENT_VALUES),
    material: readParam(params, "material"),
    size: oneOf(
      readParam(params, "tamano"),
      SIZE_RANGES.map((r) => r.value)
    ),
    minPrice: readPositiveNumber(params, "min"),
    maxPrice: readPositiveNumber(params, "max"),
    box: readParam(params, "caja") === "1" ? true : undefined,
    docs: readParam(params, "papeles") === "1" ? true : undefined,
    status: oneOf(readParam(params, "estado"), ["disponible", "reservado"] as const),
    category: oneOf(readParam(params, "tipo"), ["reloj", "accesorio"] as const),
    sort: oneOf(readParam(params, "orden"), CATALOGUE_SORTS) ?? "newest",
    page,
  };
}

/** Valor del selector de precio que corresponde a un par min/max de la URL. */
export function priceRangeValue(min: number | undefined, max: number | undefined): string | null {
  const match = PRICE_RANGES.find((r) => r.min === min && r.max === max);
  return match ? match.value : null;
}
