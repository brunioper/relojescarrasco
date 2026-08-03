import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { loadFinanceSnapshot, computeInventory, inventoryAgingSummary } from "@/services/reports/data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductStatusBadge } from "@/components/admin/product-status-badge";
import { formatUsd, formatUyu } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import type { ProductStatus } from "@/types/supabase";

export const metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; antiguedad?: string; marca?: string }>;
}) {
  await requireStaffPage();
  const params = await searchParams;
  const snap = await loadFinanceSnapshot();
  let items = computeInventory(snap);
  const aging = inventoryAgingSummary(items);
  const brands = [...new Set(items.map((i) => i.brand))].sort();

  if (params.estado) items = items.filter((i) => i.status === params.estado);
  if (params.antiguedad) items = items.filter((i) => i.agingBucket === params.antiguedad);
  if (params.marca) items = items.filter((i) => i.brand === params.marca);

  const totalCostUsd = items.reduce((acc, i) => acc + i.totalCostUsd, 0);
  const totalListingUsd = items.reduce((acc, i) => acc + (i.listingUsd ?? 0), 0);

  const buildHref = (updates: Record<string, string | null>) => {
    const url = new URLSearchParams();
    const current = { estado: params.estado, antiguedad: params.antiguedad, marca: params.marca };
    for (const [key, value] of Object.entries({ ...current, ...updates })) {
      if (value) url.set(key, value);
    }
    const qs = url.toString();
    return qs ? `/admin/inventario?${qs}` : "/admin/inventario";
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">Inventario</h1>

      {/* Grupos de antigüedad */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {aging.map((bucket) => (
          <Link key={bucket.key} href={buildHref({ antiguedad: params.antiguedad === bucket.key ? null : bucket.key })}>
            <Card className={params.antiguedad === bucket.key ? "ring-2 ring-gold" : undefined}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{bucket.label}</p>
                <p className="text-lg font-semibold">{bucket.count}</p>
                <p className="text-xs text-muted-foreground">{formatUsd(bucket.costUsd)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filtrar:</span>
        {(["disponible", "reservado", "en_reparacion", "no_publicado"] as const).map((status) => (
          <Link
            key={status}
            href={buildHref({ estado: params.estado === status ? null : status })}
            className={`rounded-md border px-2.5 py-1 ${params.estado === status ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
          >
            {status === "disponible"
              ? "Disponibles"
              : status === "reservado"
                ? "Reservados"
                : status === "en_reparacion"
                  ? "En reparación"
                  : "No publicados"}
          </Link>
        ))}
        <span className="mx-2 text-muted-foreground">·</span>
        {brands.map((brand) => (
          <Link
            key={brand}
            href={buildHref({ marca: params.marca === brand ? null : brand })}
            className={`rounded-md border px-2.5 py-1 ${params.marca === brand ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
          >
            {brand}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Compra</TableHead>
              <TableHead className="text-right">Costo total</TableHead>
              <TableHead className="text-right">Precio lista</TableHead>
              <TableHead className="text-right">Ganancia potencial</TableHead>
              <TableHead className="text-right">Días</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Sin productos en inventario con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.productId} className={item.slowMoving ? "bg-amber-50/60" : undefined}>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                <TableCell>
                  <Link href={`/admin/productos/${item.productId}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.brand} {item.model}
                    {!item.isPublished && " · sin publicar"}
                  </p>
                </TableCell>
                <TableCell>
                  <ProductStatusBadge status={item.status as ProductStatus} />
                </TableCell>
                <TableCell className="text-sm">
                  {item.purchaseDate ? (
                    <>
                      {formatDate(item.purchaseDate)}
                      {item.purchaseCurrency && (
                        <span className="ml-1 text-xs text-muted-foreground">({item.purchaseCurrency})</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin compra</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatUsd(item.totalCostUsd)}
                  <p className="text-xs text-muted-foreground">{formatUyu(item.totalCostUyu)} UYU</p>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {item.listingUsd !== null ? formatUsd(item.listingUsd) : "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {item.potentialProfitUsd !== null ? (
                    <span className={item.potentialProfitUsd >= 0 ? "text-emerald-700" : "text-destructive"}>
                      {formatUsd(item.potentialProfitUsd)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {item.ageDays ?? "—"}
                  {item.slowMoving && (
                    <Badge variant="warning" className="ml-1.5">
                      Lento
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap justify-end gap-6 border-t p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Costo total: </span>
            <span className="font-medium tabular-nums">{formatUsd(totalCostUsd)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Valor de lista: </span>
            <span className="font-medium tabular-nums">{formatUsd(totalListingUsd)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
