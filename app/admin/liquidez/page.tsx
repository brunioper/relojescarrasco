import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveRate } from "@/services/exchange-rates";
import { liquiditySummary, outstandingSummary } from "@/services/finance/liquidity";
import type { CashTx } from "@/services/finance/cash-flow";
import { todayMontevideo, formatDate } from "@/lib/formatting/date";
import { formatAmount, formatUsd, formatUyu } from "@/lib/formatting/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/stat-card";
import {
  CashMovementDialog,
  NewAccountDialog,
  TransferDialog,
} from "@/components/admin/cash-dialogs";
import { isInflow } from "@/services/finance/cash-flow";

export const metadata = { title: "Caja y liquidez" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  cobro_venta: "Cobro de venta",
  otro_ingreso: "Otro ingreso",
  aporte_dueno: "Aporte del dueño",
  pago_compra: "Pago de compra",
  pago_costo_producto: "Pago de costo",
  pago_gasto_general: "Pago de gasto",
  pago_gasto_venta: "Pago gasto de venta",
  retiro_dueno: "Retiro del dueño",
  otro_egreso: "Otro egreso",
  transferencia_entrada: "Transferencia (entrada)",
  transferencia_salida: "Transferencia (salida)",
  ajuste_positivo: "Ajuste positivo",
  ajuste_negativo: "Ajuste negativo",
};

export default async function LiquidityPage() {
  const ctx = await requireStaffPage();
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  const [{ data: accounts }, { data: transactions }, { data: sales }, { data: purchases }, { data: costs }, { data: expenses }, activeRate] =
    await Promise.all([
      supabase
        .from("cash_accounts")
        .select("id, name, currency, account_type, initial_balance")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("cash_transactions")
        .select("id, account_id, transaction_date, type, amount, amount_usd, amount_uyu, description")
        .order("transaction_date", { ascending: false })
        .limit(500),
      supabase
        .from("sales")
        .select("amount, amount_paid, currency, exchange_rate, payment_status")
        .eq("is_cancelled", false),
      supabase.from("purchases").select("amount, amount_paid, currency, exchange_rate, payment_status"),
      supabase
        .from("product_costs")
        .select("amount, amount_paid, currency, exchange_rate, payment_status")
        .is("deleted_at", null),
      supabase
        .from("general_expenses")
        .select("amount, amount_paid, currency, exchange_rate, payment_status")
        .is("deleted_at", null),
      getActiveRate(),
    ]);

  const accountsWithTx = (accounts ?? []).map((account) => ({
    ...account,
    transactions: (transactions ?? []).filter((tx) => tx.account_id === account.id) as CashTx[],
  }));

  const liquidity = liquiditySummary(accountsWithTx, activeRate?.rate ?? null);
  const receivables = outstandingSummary(sales ?? []);
  const payables = outstandingSummary([...(purchases ?? []), ...(costs ?? []), ...(expenses ?? [])]);
  const accountName = (id: string) => accounts?.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Caja y liquidez</h1>
          <p className="text-sm text-muted-foreground">
            La liquidez es dinero real en caja. El inventario y lo pendiente de cobro no son caja.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <CashMovementDialog
              accounts={accounts ?? []}
              activeRate={activeRate?.rate ?? null}
              today={todayMontevideo()}
            />
            <TransferDialog
              accounts={accounts ?? []}
              activeRate={activeRate?.rate ?? null}
              today={todayMontevideo()}
            />
            <NewAccountDialog />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          title="Liquidez USD"
          value={formatUsd(liquidity.totalUsd)}
          hint="Suma de saldos de cuentas en dólares: saldo inicial + entradas − salidas."
        />
        <StatCard
          title="Liquidez UYU"
          value={`${formatUyu(liquidity.totalUyu)} UYU`}
          hint="Suma de saldos de cuentas en pesos."
        />
        <StatCard
          title="Consolidado (USD)"
          value={liquidity.consolidatedUsd !== null ? formatUsd(liquidity.consolidatedUsd) : "—"}
          hint="USD + UYU convertidos con la cotización activa. Solo referencia visual: nunca se guarda."
        />
        <StatCard
          title="Por cobrar − por pagar"
          value={formatUsd(receivables.consolidatedUsd - payables.consolidatedUsd)}
          tone={receivables.consolidatedUsd - payables.consolidatedUsd >= 0 ? "positive" : "negative"}
          hint="Cuentas por cobrar menos cuentas por pagar (con cotizaciones históricas)."
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liquidity.accounts.map((account) => (
              <div key={account.id} className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">
                  {account.name}
                  <span className="ml-1 text-xs">
                    ({account.account_type === "banco" ? "banco" : account.account_type})
                  </span>
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatAmount(account.balance, account.currency)}
                </p>
              </div>
            ))}
            {liquidity.accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin cuentas de caja configuradas.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transactions ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin movimientos registrados.
                  </TableCell>
                </TableRow>
              )}
              {(transactions ?? []).slice(0, 50).map((tx) => {
                const account = accounts?.find((a) => a.id === tx.account_id);
                const inflow = isInflow(tx.type);
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell className="text-sm">{accountName(tx.account_id)}</TableCell>
                    <TableCell className="text-sm">{TYPE_LABEL[tx.type] ?? tx.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                    <TableCell
                      className={`text-right text-sm tabular-nums ${inflow ? "text-emerald-700" : "text-destructive"}`}
                    >
                      {inflow ? "+" : "−"}
                      {account ? formatAmount(tx.amount, account.currency) : tx.amount}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
