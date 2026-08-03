import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { loadFinanceSnapshot, computeSalesWithProfit } from "@/services/reports/data";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/stat-card";
import { formatAmount, formatPercent, formatUsd } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/date";
import type { CurrencyCode, PaymentStatus } from "@/types/supabase";

export const metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  pagado: { label: "Cobrada", variant: "success" },
  parcial: { label: "Cobro parcial", variant: "warning" },
  pendiente: { label: "Sin cobrar", variant: "destructive" },
  cancelado: { label: "Cancelada", variant: "outline" },
};

export default async function SalesPage() {
  await requireStaffPage();
  const snap = await loadFinanceSnapshot();
  const sales = computeSalesWithProfit(snap).sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));

  const totalUsd = sales.reduce((acc, s) => acc + s.amountUsd, 0);
  const totalNet = sales.reduce((acc, s) => acc + s.netProfitUsd, 0);
  const pendingCount = sales.filter(
    (s) => s.paymentStatus === "pendiente" || s.paymentStatus === "parcial"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Para registrar una venta, abra el producto y use «Registrar venta».
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Ventas totales" value={String(sales.length)} />
        <StatCard title="Facturación (USD)" value={formatUsd(totalUsd)} />
        <StatCard
          title="Ganancia neta acumulada"
          value={formatUsd(totalNet)}
          tone={totalNet >= 0 ? "positive" : "negative"}
        />
        <StatCard title="Con saldo pendiente" value={String(pendingCount)} />
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Reloj</TableHead>
              <TableHead className="text-right">Venta</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Ganancia neta</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="text-right">Desc. lista</TableHead>
              <TableHead className="text-right">Días stock</TableHead>
              <TableHead>Cobro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Aún no hay ventas registradas.
                </TableCell>
              </TableRow>
            )}
            {sales.map((sale) => {
              const badge = PAYMENT_BADGE[sale.paymentStatus as PaymentStatus];
              return (
                <TableRow key={sale.saleId}>
                  <TableCell className="text-sm">{formatDate(sale.saleDate)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/productos/${sale.productId}`} className="font-medium hover:underline">
                      {sale.productName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{sale.brand}</p>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatAmount(sale.amount, sale.currency as CurrencyCode)}
                    {sale.currency === "UYU" && (
                      <p className="text-xs text-muted-foreground">{formatUsd(sale.amountUsd)}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatUsd(sale.totalCostUsd)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <span className={sale.netProfitUsd >= 0 ? "text-emerald-700" : "text-destructive"}>
                      {formatUsd(sale.netProfitUsd)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPercent(sale.netMarginPct)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPercent(sale.discountPct)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {sale.daysInInventory ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
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
