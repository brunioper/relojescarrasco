import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveRate } from "@/services/exchange-rates";
import { todayMontevideo, formatDate } from "@/lib/formatting/date";
import { formatAmount, formatUsd } from "@/lib/formatting/currency";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseDialog } from "@/components/admin/expense-dialog";
import { ExpenseRowActions } from "@/components/admin/expense-row-actions";
import type { PaymentStatus } from "@/types/supabase";

export const metadata = { title: "Gastos generales" };
export const dynamic = "force-dynamic";

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  pagado: { label: "Pagado", variant: "success" },
  parcial: { label: "Parcial", variant: "warning" },
  pendiente: { label: "Pendiente", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; estado?: string; desde?: string; hasta?: string }>;
}) {
  const ctx = await requireStaffPage();
  const params = await searchParams;
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  let query = supabase
    .from("general_expenses")
    .select(
      "id, expense_date, category_id, description, amount, currency, exchange_rate, amount_usd, payment_status, amount_paid, supplier_id, payment_method, due_date, is_recurring"
    )
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .limit(300);

  if (params.categoria) query = query.eq("category_id", params.categoria);
  if (params.estado) query = query.eq("payment_status", params.estado as PaymentStatus);
  if (params.desde) query = query.gte("expense_date", params.desde);
  if (params.hasta) query = query.lte("expense_date", params.hasta);

  const [{ data: expenses }, { data: categories }, { data: suppliers }, activeRate] =
    await Promise.all([
      query,
      supabase
        .from("expense_categories")
        .select("id, name")
        .eq("kind", "gasto_general")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
      getActiveRate(),
    ]);

  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? "—";
  const totalUsd = (expenses ?? []).reduce((acc, e) => acc + e.amount_usd, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Gastos generales</h1>
        {isAdmin && (
          <ExpenseDialog
            categories={categories ?? []}
            suppliers={suppliers ?? []}
            activeRate={activeRate?.rate ?? null}
            today={todayMontevideo()}
          />
        )}
      </div>

      {/* Filtros por GET */}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 text-sm">
        <div>
          <label htmlFor="f-desde" className="mb-1 block text-xs text-muted-foreground">
            Desde
          </label>
          <input
            id="f-desde"
            type="date"
            name="desde"
            defaultValue={params.desde ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2"
          />
        </div>
        <div>
          <label htmlFor="f-hasta" className="mb-1 block text-xs text-muted-foreground">
            Hasta
          </label>
          <input
            id="f-hasta"
            type="date"
            name="hasta"
            defaultValue={params.hasta ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2"
          />
        </div>
        <div>
          <label htmlFor="f-cat" className="mb-1 block text-xs text-muted-foreground">
            Categoría
          </label>
          <select
            id="f-cat"
            name="categoria"
            defaultValue={params.categoria ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2"
          >
            <option value="">Todas</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className="mb-1 block text-xs text-muted-foreground">
            Estado de pago
          </label>
          <select
            id="f-estado"
            name="estado"
            defaultValue={params.estado ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2"
          >
            <option value="">Todos</option>
            <option value="pagado">Pagado</option>
            <option value="parcial">Parcial</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
      </form>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-right">USD</TableHead>
              <TableHead>Pago</TableHead>
              {isAdmin && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(expenses ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Sin gastos para mostrar.
                </TableCell>
              </TableRow>
            )}
            {(expenses ?? []).map((expense) => {
              const badge = PAYMENT_BADGE[expense.payment_status];
              return (
                <TableRow key={expense.id}>
                  <TableCell className="text-sm">{formatDate(expense.expense_date)}</TableCell>
                  <TableCell className="text-sm">
                    {expense.description}
                    {expense.is_recurring && (
                      <Badge variant="info" className="ml-1.5">
                        Recurrente
                      </Badge>
                    )}
                    {expense.due_date && expense.payment_status !== "pagado" && (
                      <p className="text-xs text-amber-700">Vence: {formatDate(expense.due_date)}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{categoryName(expense.category_id)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatAmount(expense.amount, expense.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatUsd(expense.amount_usd)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <ExpenseRowActions
                        expense={expense}
                        categories={categories ?? []}
                        suppliers={suppliers ?? []}
                        activeRate={activeRate?.rate ?? null}
                        today={todayMontevideo()}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex justify-end border-t p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Total del listado: </span>
            <span className="font-medium tabular-nums">{formatUsd(totalUsd)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
