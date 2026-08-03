import { AlertTriangle } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { loadFinanceSnapshot, computeDashboard } from "@/services/reports/data";
import { getActiveRate } from "@/services/exchange-rates";
import { StatCard } from "@/components/admin/stat-card";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { formatUsd, formatUyu } from "@/lib/formatting/currency";
import { formatDate, todayMontevideo } from "@/lib/formatting/date";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireStaffPage();

  const [snap, activeRate] = await Promise.all([loadFinanceSnapshot(), getActiveRate()]);
  const data = computeDashboard(snap, todayMontevideo());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen del negocio al {formatDate(todayMontevideo())}</p>
        </div>
        {activeRate && (
          <div className="rounded-lg border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">Cotización activa: </span>
            <span className="font-medium tabular-nums">$ {activeRate.rate} / US$ 1</span>
            <span className="ml-2 text-xs text-muted-foreground">({formatDate(activeRate.rateDate)})</span>
          </div>
        )}
      </div>

      {!activeRate && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          No hay cotización USD/UYU cargada. Cargue una en Cotizaciones para que el catálogo muestre la
          conversión a pesos.
        </div>
      )}
      {activeRate?.isStale && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          La cotización activa tiene {activeRate.ageDays} días ({formatDate(activeRate.rateDate)}).
          Considere actualizarla.
        </div>
      )}

      {/* Inventario */}
      <section aria-label="Inventario">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard title="Disponibles" value={String(data.counts.disponibles)} />
          <StatCard title="Reservados" value={String(data.counts.reservados)} />
          <StatCard title="En reparación" value={String(data.counts.enReparacion)} />
          <StatCard title="Vendidos (histórico)" value={String(data.counts.vendidos)} />
        </div>
      </section>

      <section aria-label="Valores de inventario">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            title="Costo del inventario"
            value={formatUsd(data.inventoryCostUsd)}
            subtitle={`${formatUyu(data.inventoryCostUyu)} UYU (histórico)`}
            hint="Costo total = precio de compra + costos directos de cada reloj en stock, con las cotizaciones históricas de cada operación."
          />
          <StatCard
            title="Valor de lista del stock"
            value={formatUsd(data.inventoryListingUsd)}
            hint="Suma de los precios de lista en USD de los relojes en stock con precio definido."
          />
          <StatCard
            title="Ganancia potencial"
            value={formatUsd(data.potentialProfitUsd)}
            tone={data.potentialProfitUsd >= 0 ? "positive" : "negative"}
            hint="Precio de lista menos costo total, para el stock actual. Es una estimación: la ganancia real se calcula al vender."
          />
          <StatCard
            title="Antigüedad promedio"
            value={`${data.avgInventoryAgeDays} días`}
            subtitle={data.avgDaysToSell !== null ? `Venta promedio: ${data.avgDaysToSell} días` : undefined}
            hint="Días promedio desde la compra de los relojes en stock."
          />
        </div>
      </section>

      {/* Resultados */}
      <section aria-label="Resultados">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            title="Ventas del mes"
            value={formatUsd(data.salesMonthUsd)}
            subtitle={`${data.salesMonthCount} ${data.salesMonthCount === 1 ? "reloj" : "relojes"}`}
          />
          <StatCard
            title="Ganancia neta del mes"
            value={formatUsd(data.netProfitMonthUsd)}
            tone={data.netProfitMonthUsd >= 0 ? "positive" : "negative"}
            hint="Ganancia neta = venta real − costo total − gastos de la venta."
          />
          <StatCard
            title="Ventas del año"
            value={formatUsd(data.salesYearUsd)}
            subtitle={`${data.salesYearCount} ${data.salesYearCount === 1 ? "reloj" : "relojes"}`}
          />
          <StatCard
            title="Ganancia neta del año"
            value={formatUsd(data.netProfitYearUsd)}
            tone={data.netProfitYearUsd >= 0 ? "positive" : "negative"}
            subtitle={`Bruta: ${formatUsd(data.grossProfitYearUsd)}`}
          />
        </div>
      </section>

      {/* Liquidez */}
      <section aria-label="Liquidez">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            title="Liquidez USD"
            value={formatUsd(data.liquidity.totalUsd)}
            hint="Dinero real en cuentas USD (efectivo y banco). No incluye inventario ni cuentas por cobrar."
          />
          <StatCard
            title="Liquidez UYU"
            value={`${formatUyu(data.liquidity.totalUyu)} UYU`}
            hint="Dinero real en cuentas UYU. No incluye inventario ni cuentas por cobrar."
          />
          <StatCard
            title="Cuentas por cobrar"
            value={formatUsd(data.receivables.consolidatedUsd)}
            hint="Ventas con saldo pendiente de cobro, convertidas con la cotización histórica de cada venta."
          />
          <StatCard
            title="Cuentas por pagar"
            value={formatUsd(data.payables.consolidatedUsd)}
            tone={data.payables.consolidatedUsd > 0 ? "negative" : "neutral"}
            hint="Compras, costos y gastos con saldo pendiente de pago."
          />
        </div>
      </section>

      <DashboardCharts monthly={data.monthly} byBrand={data.byBrand} />
    </div>
  );
}
