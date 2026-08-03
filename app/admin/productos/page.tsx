import Link from "next/link";
import Image from "next/image";
import { Plus, Upload, Watch } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
import { formatUsd } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import { productImageUrl } from "@/lib/storage";

export const metadata = { title: "Productos" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const ctx = await requireStaffPage();
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      "id, name, brand, model, status, is_published, is_featured, listing_price_usd, listing_price_currency, created_at, product_images(storage_path, is_cover, sort_order)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.q) {
    const term = params.q.replace(/[%_,]/g, " ").trim();
    if (term) {
      query = query.or(`name.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%`);
    }
  }
  if (params.estado) {
    query = query.eq(
      "status",
      params.estado as "disponible" | "reservado" | "vendido" | "en_reparacion" | "no_publicado" | "archivado"
    );
  }

  const { data: products } = await query;

  const cover = (images: { storage_path: string; is_cover: boolean; sort_order: number }[]) => {
    const sorted = [...images].sort(
      (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order
    );
    return sorted[0]?.storage_path ?? null;
  };

  const statuses = [
    ["", "Todos"],
    ["disponible", "Disponibles"],
    ["reservado", "Reservados"],
    ["vendido", "Vendidos"],
    ["en_reparacion", "En reparación"],
    ["no_publicado", "No publicados"],
    ["archivado", "Archivados"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Productos</h1>
        {ctx.profile.role === "admin" && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/productos/importar">
                <Upload className="h-4 w-4" /> Importar en lote
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/productos/nuevo">
                <Plus className="h-4 w-4" /> Nuevo reloj
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex gap-2" role="search">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar…"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Buscar productos"
          />
          {params.estado && <input type="hidden" name="estado" value={params.estado} />}
          <Button type="submit" variant="secondary" size="sm">
            Buscar
          </Button>
        </form>
        <div className="flex flex-wrap gap-1">
          {statuses.map(([value, label]) => (
            <Button
              key={value}
              asChild
              variant={(params.estado ?? "") === value ? "default" : "outline"}
              size="sm"
            >
              <Link
                href={value ? `/admin/productos?estado=${value}` : "/admin/productos"}
              >
                {label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead>Reloj</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Publicado</TableHead>
              <TableHead className="text-right">Precio lista</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No hay productos para mostrar.
                </TableCell>
              </TableRow>
            )}
            {(products ?? []).map((product) => {
              const coverPath = cover(product.product_images ?? []);
              const url = productImageUrl(coverPath);
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link href={`/admin/productos/${product.id}`}>
                      <span className="relative block h-10 w-10 overflow-hidden rounded-md bg-muted">
                        {url ? (
                          <Image src={url} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                            <Watch className="h-5 w-5" strokeWidth={1.5} />
                          </span>
                        )}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/productos/${product.id}`} className="hover:underline">
                      <span className="font-medium">{product.name}</span>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {product.brand} {product.model}
                    </p>
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge status={product.status} />
                  </TableCell>
                  <TableCell>
                    {product.is_published ? (
                      <Badge variant="success">Publicado</Badge>
                    ) : (
                      <Badge variant="outline">No publicado</Badge>
                    )}
                    {product.is_featured && (
                      <Badge variant="info" className="ml-1">
                        Destacado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {product.listing_price_usd !== null ? (
                      <>
                        {formatUsd(product.listing_price_usd)}
                        {product.listing_price_currency === "UYU" && (
                          <span className="ml-1 text-xs text-muted-foreground">(orig. UYU)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin precio</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(product.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
