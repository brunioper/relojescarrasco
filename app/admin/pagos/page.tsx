import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveRate } from "@/services/exchange-rates";
import { todayMontevideo, formatDate } from "@/lib/formatting/date";
import { formatAmount, formatUsd } from "@/lib/formatting/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentDialog, type PendingItem } from "@/components/admin/payment-dialog";
import { PaymentRowActions } from "@/components/admin/payment-row-actions";

export const metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  venta: "Cobro venta",
  compra: "Pago compra",
  costo_producto: "Costo producto",
  gasto_general: "Gasto general",
  gasto_venta: "Gasto de venta",
};

export default async function PaymentsPage() {
  const ctx = await requireStaffPage();
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  const [
    { data: payments },
    { data: pendingSales },
    { data: pendingPurchases },
    { data: pendingCosts },
    { data: pendingExpenses },
    { data: cashAccounts },
    { data: products },
    activeRate,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, transaction_type, transaction_id, payment_date, amount, currency, exchange_rate, amount_usd, payment_method, cash_account_id, notes"
      )
      .order("payment_date", { ascending: false })
      .limit(200),
    supabase
      .from("sales")
      .select("id, product_id, amount, amount_paid, currency")
      .in("payment_status", ["pendiente", "parcial"])
      .eq("is_cancelled", false),
    supabase
      .from("purchases")
      .select("id, product_id, amount, amount_paid, currency")
      .in("payment_status", ["pendiente", "parcial"]),
    supabase
      .from("product_costs")
      .select("id, product_id, description, amount, amount_paid, currency")
      .in("payment_status", ["pendiente", "parcial"])
      .is("deleted_at", null),
    supabase
      .from("general_expenses")
      .select("id, description, amount, amount_paid, currency")
      .in("payment_status", ["pendiente", "parcial"])
      .is("deleted_at", null),
    supabase.from("cash_accounts").select("id, name, currency").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name").is("deleted_at", null),
    getActiveRate(),
  ]);

  const productName = (id: string) => products?.find((p) => p.id === id)?.name ?? "Producto";
  const round2 = (v: number) => Math.round(v * 100) / 100;

  const pendingItems: PendingItem[] = [
    ...(pendingSales ?? []).map((s) => ({
      transactionType: "venta" as const,
      transactionId: s.id,
      label: productName(s.product_id),
      currency: s.currency,
      outstanding: round2(s.amount - s.amount_paid),
    })),
    ...(pendingPurchases ?? []).map((p) => ({
      transactionType: "compra" as const,
      transactionId: p.id,
      label: productName(p.product_id),
      currency: p.currency,
      outstanding: round2(p.amount - p.amount_paid),
    })),
    ...(pendingCosts ?? []).map((c) => ({
      transactionType: "costo_producto" as const,
      transactionId: c.id,
      label: `${productName(c.product_id)} — ${c.description || "costo"}`,
      currency: c.currency,
      outstanding: round2(c.amount - c.amount_paid),
    })),
    ...(pendingExpenses ?? []).map((e) => ({
      transactionType: "gasto_general" as const,
      transactionId: e.id,
      label: e.description,
      currency: e.currency,
      outstanding: round2(e.amount - e.amount_paid),
    })),
  ].filter((i) => i.outstanding > 0);

  const receivable = pendingItems.filter((i) => i.transactionType === "venta");
  const payable = pendingItems.filter((i) => i.transactionType !== "venta");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Pagos y cobros</h1>
        {isAdmin && (
          <PaymentDialog
            pendingItems={pendingItems}
            cashAccounts={cashAccounts ?? []}
            activeRate={activeRate?.rate ?? null}
            today={todayMontevideo()}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cuentas por cobrar ({receivable.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {receivable.length === 0 && (
              <p className="text-sm text-muted-foreground">Nada pendiente de cobro.</p>
            )}
            {receivable.map((item) => (
              <div
                key={item.transactionId}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span>{item.label}</span>
                <span className="font-medium tabular-nums">
                  {formatAmount(item.outstanding, item.currency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cuentas por pagar ({payable.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payable.length === 0 && (
              <p className="text-sm text-muted-foreground">Nada pendiente de pago.</p>
            )}
            {payable.map((item) => (
              <div
                key={`${item.transactionType}:${item.transactionId}`}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span>
                  {item.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({TYPE_LABEL[item.transactionType]})
                  </span>
                </span>
                <span className="font-medium tabular-nums text-destructive">
                  {formatAmount(item.outstanding, item.currency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">Cotización</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Nota</TableHead>
                {isAdmin && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Sin pagos registrados.
                  </TableCell>
                </TableRow>
              )}
              {(payments ?? []).map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm">{formatDate(payment.payment_date)}</TableCell>
                  <TableCell>
                    <Badge variant={payment.transaction_type === "venta" ? "success" : "secondary"}>
                      {TYPE_LABEL[payment.transaction_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatAmount(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatUsd(payment.amount_usd)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {payment.exchange_rate}
                  </TableCell>
                  <TableCell className="text-sm">{payment.payment_method ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {payment.notes ?? "—"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <PaymentRowActions paymentId={payment.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
