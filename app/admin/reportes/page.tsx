import Link from "next/link";
import { Download } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { loadFinanceSnapshot, computeReports, computeInventory, inventoryAgingSummary } from "@/services/reports/data";
import { todayMontevideo, formatDate } from "@/lib/formatting/date";
import { formatPercent, formatUsd, formatUyu } from "@/lib/formatting/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

function rangeFromPreset(preset: string, today: string): { from: string; to: string; label: string } {
  const now = new Date(`${today}T12:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const iso = (dte: Date) => dte.toISOString().slice(0, 10);

  switch (preset) {
    case "hoy":
      return { from: today, to: today, label: "Hoy" };
    case "semana": {
      const day = now.getUTCDay() || 7;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - day + 1);
      return { from: iso(monday), to: today, label: "Esta semana" };
    }
    case "mes_anterior": {
      const first = new Date(Date.UTC(year, month - 1, 1));
      const last = new Date(Date.UTC(year, month, 0));
      return { from: iso(first), to: iso(last), label: "Mes anterior" };
    }
    case "trimestre": {
      const qStart = new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
      return { from: iso(qStart), to: today, label: "Este trimestre" };
    }
    case "anio":
      return { from: `${year}-01-01`, to: today, label: "Este año" };
    case "anio_anterior":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: "Año anterior" };
    case "mes":
    default:
      return { from: iso(new Date(Date.UTC(year, month, 1))), to: today, label: "Este mes" };
  }
}

const PRESETS = [
  ["hoy", "Hoy"],
  ["semana", "Esta semana"],
  ["mes", "Este mes"],
  ["mes_anterior", "Mes anterior"],
  ["trimestre", "Este trimestre"],
  ["anio", "Este año"],
  ["anio_anterior", "Año anterior"],
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  await requireStaffPage();
  const params = await searchParams;
  const today = todayMontevideo();

  const isCustom = Boolean(params.desde && params.hasta);
  const range = isCustom
    ? { from: params.desde!, to: params.hasta!, label: "Personalizado" }
    : rangeFromPreset(params.periodo ?? "mes", today);

  const snap = await loadFinanceSnapshot();
  const report = computeReports(snap, range);
  const inventory = computeInventory(snap);
  const aging = inventoryAgingSummary(inventory);

  const exportUrl = (reportName: string, format: string) =>
    `/api/admin/export?report=${reportName}&format=${format}&from=${range.from}&to=${range.to}`;

  const ExportButtons = ({ report: reportName }: { report: string }) => (
    <div className="flex gap-1.5">
      {(["csv", "xlsx", "pdf"] as const).map((format) => (
        <Button key={format} asChild variant="outline" size="sm">
          <a href={exportUrl(reportName, format)} download>
            <Download className="h-3.5 w-3.5" /> {format.toUpperCase()}
          </a>
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            {range.label}: {formatDate(range.from)} — {formatDate(range.to)}
          </p>
        </div>
      </div>

      {/* Selector de período */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([value, label]) => (
          <Button
            key={value}
            asChild
            size="sm"
            variant={!isCustom && (params.periodo ?? "mes") === value ? "default" : "outline"}
          >
            <Link href={`/admin/reportes?periodo=${value}`}>{label}</Link>
          </Button>
        ))}
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="desde"
            defaultValue={params.desde ?? ""}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Desde"
          />
          <input
            type="date"
            name="hasta"
            defaultValue={params.hasta ?? ""}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Hasta"
          />
          <Button type="submit" size="sm" variant={isCustom ? "default" : "outline"}>
            Aplicar
          </Button>
        </form>
      </div>

      <Tabs defaultValue="ventas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="liquidez">Liquidez</TabsTrigger>
        </TabsList>

        {/* Ventas */}
        <TabsContent value="ventas" className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons report="ventas" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard title="Relojes vendidos" value={String(report.sales.count)} />
            <StatCard title="Ventas brutas" value={formatUsd(report.sales.grossUsd)} />
            <StatCard title="Precio promedio" value={formatUsd(report.sales.averageUsd)} />
            <StatCard
              title="Descuento promedio"
              value={formatPercent(report.sales.averageDiscountPct)}
              hint="Promedio del descuento respecto del precio de lista de cada venta."
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Reloj</TableHead>
                    <TableHead className="text-right">Lista (USD)</TableHead>
                    <TableHead className="text-right">Venta (USD)</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Moneda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.sales.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Sin ventas en el período.
                      </TableCell>
                    </TableRow>
                  )}
                  {report.sales.rows.map((sale) => (
                    <TableRow key={sale.saleId}>
                      <TableCell className="text-sm">{formatDate(sale.saleDate)}</TableCell>
                      <TableCell className="text-sm">
                        {sale.productName}
                        <span className="ml-1 text-xs text-muted-foreground">({sale.brand})</span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {sale.listingUsd !== null ? formatUsd(sale.listingUsd) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatUsd(sale.amountUsd)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {sale.listingUsd !== null ? formatUsd(sale.amountUsd - sale.listingUsd) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{sale.currency}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rentabilidad */}
        <TabsContent value="rentabilidad" className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons report="rentabilidad" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              title="Ganancia bruta"
              value={formatUsd(report.profitability.grossProfitUsd)}
              tone={report.profitability.grossProfitUsd >= 0 ? "positive" : "negative"}
            />
            <StatCard
              title="Ganancia neta"
              value={formatUsd(report.profitability.netProfitUsd)}
              tone={report.profitability.netProfitUsd >= 0 ? "positive" : "negative"}
            />
            <StatCard title="Margen bruto" value={formatPercent(report.profitability.grossMarginPct)} />
            <StatCard title="Margen neto" value={formatPercent(report.profitability.netMarginPct)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Más rentables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.profitability.best.map((sale) => (
                  <div key={sale.saleId} className="flex justify-between text-sm">
                    <span>{sale.productName}</span>
                    <span className="font-medium tabular-nums text-emerald-700">
                      {formatUsd(sale.netProfitUsd)}
                    </span>
                  </div>
                ))}
                {report.profitability.best.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin datos.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Menos rentables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.profitability.worst.map((sale) => (
                  <div key={sale.saleId} className="flex justify-between text-sm">
                    <span>{sale.productName}</span>
                    <span
                      className={`font-medium tabular-nums ${sale.netProfitUsd >= 0 ? "" : "text-destructive"}`}
                    >
                      {formatUsd(sale.netProfitUsd)}
                    </span>
                  </div>
                ))}
                {report.profitability.worst.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin datos.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inventario */}
        <TabsContent value="inventario" className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons report="inventario" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard title="Unidades en stock" value={String(inventory.length)} />
            <StatCard
              title="Costo total"
              value={formatUsd(inventory.reduce((a, i) => a + i.totalCostUsd, 0))}
            />
            <StatCard
              title="Valor de lista"
              value={formatUsd(inventory.reduce((a, i) => a + (i.listingUsd ?? 0), 0))}
              subtitle={
                snap.activeRate
                  ? `${formatUyu(inventory.reduce((a, i) => a + (i.listingUsd ?? 0), 0) * snap.activeRate)} UYU aprox.`
                  : undefined
              }
            />
            <StatCard
              title="Stock lento (+90 días)"
              value={String(inventory.filter((i) => i.slowMoving).length)}
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Antigüedad del inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Costo (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.map((bucket) => (
                    <TableRow key={bucket.key}>
                      <TableCell className="text-sm">{bucket.label}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{bucket.count}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatUsd(bucket.costUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gastos */}
        <TabsContent value="gastos" className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons report="gastos" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard title="Compras de relojes" value={formatUsd(report.expensesReport.purchasesUsd)} />
            <StatCard title="Costos de producto" value={formatUsd(report.expensesReport.productCostsUsd)} />
            <StatCard title="Gastos generales" value={formatUsd(report.expensesReport.generalUsd)} />
            <StatCard title="Gastos de venta" value={formatUsd(report.expensesReport.saleExpensesUsd)} />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Por categoría (USD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.expensesReport.byCategory.map((row) => (
                <div key={row.name} className="flex justify-between text-sm">
                  <span>{row.name}</span>
                  <span className="font-medium tabular-nums">{formatUsd(row.usd)}</span>
                </div>
              ))}
              {report.expensesReport.byCategory.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin gastos en el período.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Liquidez */}
        <TabsContent value="liquidez" className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons report="liquidez" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              title="Caja inicial"
              value={formatUsd(report.cashFlow.openingUsd)}
              subtitle={`${formatUyu(report.cashFlow.openingUyu)} UYU`}
              hint="Saldos al inicio del período (saldos iniciales + movimientos anteriores)."
            />
            <StatCard
              title="Entradas"
              value={formatUsd(report.cashFlow.inflowsUsd)}
              subtitle={`${formatUyu(report.cashFlow.inflowsUyu)} UYU`}
              tone="positive"
            />
            <StatCard
              title="Salidas"
              value={formatUsd(report.cashFlow.outflowsUsd)}
              subtitle={`${formatUyu(report.cashFlow.outflowsUyu)} UYU`}
              tone="negative"
            />
            <StatCard
              title="Caja al cierre"
              value={formatUsd(report.cashFlow.closingUsd)}
              subtitle={`${formatUyu(report.cashFlow.closingUyu)} UYU`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Saldos por cuenta (al cierre)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.liquidity.accounts.map((account) => (
                  <div key={account.id} className="flex justify-between text-sm">
                    <span>{account.name}</span>
                    <span className="font-medium tabular-nums">
                      {account.currency === "USD"
                        ? formatUsd(account.balance)
                        : `${formatUyu(account.balance)} UYU`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cuentas por cobrar y pagar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Por cobrar (USD + UYU convertido)</span>
                  <span className="font-medium tabular-nums text-emerald-700">
                    {formatUsd(report.receivables.consolidatedUsd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Por pagar (USD + UYU convertido)</span>
                  <span className="font-medium tabular-nums text-destructive">
                    {formatUsd(report.payables.consolidatedUsd)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
