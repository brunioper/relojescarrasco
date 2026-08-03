"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MOVEMENTS = [
  { value: "automatico", label: "Automático" },
  { value: "manual", label: "Manual (cuerda)" },
  { value: "cuarzo", label: "Cuarzo" },
  { value: "solar", label: "Solar" },
  { value: "otro", label: "Otro" },
];

const SORTS = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "price_asc", label: "Menor precio (USD)" },
  { value: "price_desc", label: "Mayor precio (USD)" },
  { value: "updated", label: "Actualizados recientemente" },
];

/** Filtros del catálogo: sincronizados con la URL (server-side filtering). */
export function CatalogueFilters({ brands }: { brands: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("pagina"); // todo cambio de filtro vuelve a página 1
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const hasFilters = ["q", "marca", "movimiento", "min", "max", "caja", "papeles", "estado"].some(
    (key) => searchParams.has(key)
  );

  return (
    <div className="mb-8 space-y-4">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParam({ q });
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, marca, modelo o referencia…"
            className="pl-9"
            aria-label="Buscar en el catálogo"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
        </Button>
      </form>

      {showAdvanced && (
        <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-marca">Marca</Label>
            <Select
              value={searchParams.get("marca") ?? "todas"}
              onValueChange={(v) => setParam({ marca: v === "todas" ? null : v })}
            >
              <SelectTrigger id="filtro-marca">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las marcas</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-mov">Movimiento</Label>
            <Select
              value={searchParams.get("movimiento") ?? "todos"}
              onValueChange={(v) => setParam({ movimiento: v === "todos" ? null : v })}
            >
              <SelectTrigger id="filtro-mov">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MOVEMENTS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Precio USD</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Mín."
                aria-label="Precio mínimo en dólares"
                defaultValue={searchParams.get("min") ?? ""}
                onBlur={(e) => setParam({ min: e.target.value || null })}
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Máx."
                aria-label="Precio máximo en dólares"
                defaultValue={searchParams.get("max") ?? ""}
                onBlur={(e) => setParam({ max: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-orden">Ordenar por</Label>
            <Select
              value={searchParams.get("orden") ?? "newest"}
              onValueChange={(v) => setParam({ orden: v === "newest" ? null : v })}
            >
              <SelectTrigger id="filtro-orden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={searchParams.get("caja") === "1"}
                onCheckedChange={(v) => setParam({ caja: v ? "1" : null })}
              />
              Con caja
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={searchParams.get("papeles") === "1"}
                onCheckedChange={(v) => setParam({ papeles: v ? "1" : null })}
              />
              Con documentación
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={searchParams.get("estado") === "disponible"}
                onCheckedChange={(v) => setParam({ estado: v ? "disponible" : null })}
              />
              Solo disponibles
            </label>
          </div>

          {hasFilters && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  router.push(pathname, { scroll: false });
                }}
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
