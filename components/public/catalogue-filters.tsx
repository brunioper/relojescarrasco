"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRICE_RANGES, SIZE_RANGES, priceRangeValue } from "@/lib/catalogue-params";

const MOVEMENTS = [
  { value: "automatico", label: "Automático" },
  { value: "manual", label: "Manual (cuerda)" },
  { value: "cuarzo", label: "Cuarzo" },
  { value: "solar", label: "Solar" },
  { value: "otro", label: "Otro" },
];

const SORTS = [
  { value: "newest", label: "Recién llegados" },
  { value: "price_asc", label: "Menor precio" },
  { value: "price_desc", label: "Mayor precio" },
  { value: "oldest", label: "Más antiguos" },
];

const CONDITIONS = [
  { value: "nuevo", label: "Nuevos" },
  { value: "usado", label: "Usados" },
];

const FILTER_KEYS = [
  "q",
  "condicion",
  "ancho",
  "para",
  "marca",
  "movimiento",
  "material",
  "tamano",
  "min",
  "max",
  "caja",
  "papeles",
  "estado",
] as const;

/** Selector nativo: en el celular abre el selector del sistema, cómodo y legible. */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-base text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value !== "" && "border-foreground/60"
          )}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/** Filtros del catálogo: sincronizados con la URL (el filtrado ocurre en el servidor). */
export function CatalogueFilters({
  brands,
  materials,
  showCategoryTabs,
  strapWidths = [],
  compatibleBrands = [],
  showCondition = false,
}: {
  brands: string[];
  materials: string[];
  showCategoryTabs: boolean;
  /** Anchos de correa disponibles (mm). */
  strapWidths?: number[];
  /** Marcas de reloj con correas compatibles cargadas. */
  compatibleBrands?: string[];
  /** Ofrecer el filtro nuevo/usado (solo si hay relojes nuevos). */
  showCondition?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("pagina"); // todo cambio de filtro vuelve a la página 1
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const tipo = searchParams.get("tipo") ?? "";
  const isAccessories = tipo === "accesorio";
  const activeCount = FILTER_KEYS.filter((key) => key !== "max" && searchParams.has(key)).length;

  const minParam = searchParams.get("min");
  const maxParam = searchParams.get("max");
  const priceValue =
    priceRangeValue(
      minParam ? Number(minParam) : undefined,
      maxParam ? Number(maxParam) : undefined
    ) ?? "";

  const clearAll = () => {
    setQ("");
    router.push(tipo ? `${pathname}?tipo=${tipo}` : pathname, { scroll: false });
  };

  return (
    <div className="mb-10">
      {showCategoryTabs && (
        <div className="mb-6 flex gap-6 border-b" role="tablist" aria-label="Tipo de producto">
          {(
            [
              ["", "Todo"],
              ["reloj", "Relojes"],
              ["accesorio", "Correas y accesorios"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tipo === value}
              onClick={() => setParam({ tipo: value === "" ? null : value })}
              className={cn(
                "-mb-px border-b-2 pb-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tipo === value
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParam({ q: q.trim() || null });
          }}
        >
          <label htmlFor="catalogo-busqueda" className="sr-only">
            Buscar en el catálogo
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="catalogo-busqueda"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar marca, modelo o referencia"
            enterKeyHint="search"
            className="h-11 w-full rounded-md border border-input bg-card pl-11 pr-24 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Buscar
          </button>
        </form>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="catalogo-filtros"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-card px-4 text-base hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
          <div className="w-44 sm:w-52">
            <label htmlFor="catalogo-orden" className="sr-only">
              Ordenar por
            </label>
            <div className="relative">
              <select
                id="catalogo-orden"
                value={searchParams.get("orden") ?? "newest"}
                onChange={(e) =>
                  setParam({ orden: e.target.value === "newest" ? null : e.target.value })
                }
                className="h-11 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        id="catalogo-filtros"
        className={cn(
          "mt-5 grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid lg:grid-cols-6",
          open ? "grid" : "hidden"
        )}
      >
        <FilterSelect
          id="filtro-marca"
          label="Marca"
          value={searchParams.get("marca") ?? ""}
          onChange={(v) => setParam({ marca: v || null })}
        >
          <option value="">Todas</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filtro-precio"
          label="Precio"
          value={priceValue}
          onChange={(v) => {
            const range = PRICE_RANGES.find((r) => r.value === v);
            setParam({
              min: range?.min !== undefined ? String(range.min) : null,
              max: range?.max !== undefined ? String(range.max) : null,
            });
          }}
        >
          <option value="">Todos</option>
          {PRICE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </FilterSelect>

        {isAccessories && compatibleBrands.length > 0 && (
          <FilterSelect
            id="filtro-para"
            label="Para mi reloj"
            value={searchParams.get("para") ?? ""}
            onChange={(v) => setParam({ para: v || null })}
          >
            <option value="">Cualquier reloj</option>
            {compatibleBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </FilterSelect>
        )}

        {isAccessories && strapWidths.length > 0 && (
          <FilterSelect
            id="filtro-ancho"
            label="Ancho de correa"
            value={searchParams.get("ancho") ?? ""}
            onChange={(v) => setParam({ ancho: v || null })}
          >
            <option value="">Todos</option>
            {strapWidths.map((width) => (
              <option key={width} value={String(width)}>
                {String(width).replace(".", ",")} mm
              </option>
            ))}
          </FilterSelect>
        )}

        {!isAccessories && showCondition && (
          <FilterSelect
            id="filtro-condicion"
            label="Condición"
            value={searchParams.get("condicion") ?? ""}
            onChange={(v) => setParam({ condicion: v || null })}
          >
            <option value="">Nuevos y usados</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </FilterSelect>
        )}

        {!isAccessories && (
          <>
            <FilterSelect
              id="filtro-tamano"
              label="Tamaño de caja"
              value={searchParams.get("tamano") ?? ""}
              onChange={(v) => setParam({ tamano: v || null })}
            >
              <option value="">Todos</option>
              {SIZE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </FilterSelect>

            {materials.length > 0 && (
              <FilterSelect
                id="filtro-material"
                label="Material"
                value={searchParams.get("material") ?? ""}
                onChange={(v) => setParam({ material: v || null })}
              >
                <option value="">Todos</option>
                {materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </FilterSelect>
            )}

            <FilterSelect
              id="filtro-movimiento"
              label="Movimiento"
              value={searchParams.get("movimiento") ?? ""}
              onChange={(v) => setParam({ movimiento: v || null })}
            >
              <option value="">Todos</option>
              {MOVEMENTS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </FilterSelect>

            <div className="col-span-2 flex flex-wrap items-center gap-x-8 gap-y-3 sm:col-span-3 lg:col-span-6">
              {(
                [
                  ["caja", "Con caja"],
                  ["papeles", "Con papeles"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-base">
                  <input
                    type="checkbox"
                    checked={searchParams.get(key) === "1"}
                    onChange={(e) => setParam({ [key]: e.target.checked ? "1" : null })}
                    className="h-5 w-5 rounded border-input accent-[var(--primary)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-base underline decoration-gold underline-offset-4 hover:text-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Quitar filtros
        </button>
      )}
    </div>
  );
}
