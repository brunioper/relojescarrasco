import Link from "next/link";
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
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { formatDateTime } from "@/lib/formatting/date";
import type { OrderRequestStatus } from "@/types/supabase";

export const metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const ctx = await requireStaffPage();
  const params = await searchParams;
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  let query = supabase
    .from("order_requests")
    .select(
      "id, first_name, last_name, phone, instagram_username, delivery_method, shipping_address, status, created_at, products(name, slug, brand)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.estado) {
    query = query.eq("status", params.estado as OrderRequestStatus);
  }

  const { data: orders } = await query;

  const statuses = [
    ["", "Todos"],
    ["nuevo", "Nuevos"],
    ["contactado", "Contactados"],
    ["confirmado", "Confirmados"],
    ["cancelado", "Cancelados"],
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos enviados desde el catálogo público. No son ventas confirmadas: coordine el pago
          y registre la venta desde el producto una vez cerrado el trato.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {statuses.map(([value, label]) => (
          <Button
            key={value}
            asChild
            variant={(params.estado ?? "") === value ? "default" : "outline"}
            size="sm"
          >
            <Link href={value ? `/admin/pedidos?estado=${value}` : "/admin/pedidos"}>{label}</Link>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No hay pedidos para mostrar.
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  {order.products ? (
                    <Link
                      href={`/catalogo/${order.products.slug}`}
                      target="_blank"
                      className="font-medium hover:underline"
                    >
                      {order.products.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {order.first_name} {order.last_name}
                </TableCell>
                <TableCell className="text-sm">
                  <p>{order.phone}</p>
                  {order.instagram_username && (
                    <p className="text-xs text-muted-foreground">@{order.instagram_username}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {order.delivery_method === "envio" ? (
                    <>
                      <Badge variant="outline">Envío</Badge>
                      <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                        {order.shipping_address}
                      </p>
                    </>
                  ) : (
                    <Badge variant="outline">Retiro</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <OrderStatusSelect orderId={order.id} status={order.status} />
                  ) : (
                    <Badge variant="secondary">{order.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(order.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
