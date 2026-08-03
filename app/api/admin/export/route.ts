import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAction } from "@/lib/auth/session";
import {
  computeInventory,
  computeReports,
  inventoryAgingSummary,
  loadFinanceSnapshot,
} from "@/services/reports/data";
import {
  buildCsv,
  buildPdf,
  buildXlsx,
  type ExportTable,
} from "@/services/reports/export-builders";
import { formatDate } from "@/lib/formatting/date";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  report: z.enum(["ventas", "rentabilidad", "inventario", "gastos", "liquidez"]),
  format: z.enum(["csv", "xlsx", "pdf"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Exportación de reportes. Requiere sesión de staff (admin o viewer);
 * respeta los filtros de fecha y nunca expone datos a anónimos.
 */
export async function GET(request: Request) {
  const ctx = await requireStaffAction();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    report: url.searchParams.get("report"),
    format: url.searchParams.get("format"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Parámetros inválidos." }, { status: 400 });
  }

  const { report, format, from, to } = parsed.data;
  const snap = await loadFinanceSnapshot();
  const data = computeReports(snap, { from, to });
  const period = `Período: ${formatDate(from)} — ${formatDate(to)}`;

  let table: ExportTable;

  switch (report) {
    case "ventas":
      table = {
        title: "Reporte de ventas — Relojes Carrasco",
        period,
        headers: [
          "Fecha",
          "Reloj",
          "Marca",
          "Moneda",
          "Importe original",
          "Importe USD",
          "Lista USD",
          "Diferencia USD",
          "Estado de cobro",
        ],
        rows: data.sales.rows.map((sale) => [
          formatDate(sale.saleDate),
          sale.productName,
          sale.brand,
          sale.currency,
          sale.amount,
          sale.amountUsd,
          sale.listingUsd,
          sale.listingUsd !== null ? Math.round((sale.amountUsd - sale.listingUsd) * 100) / 100 : null,
          sale.paymentStatus,
        ]),
      };
      break;

    case "rentabilidad":
      table = {
        title: "Reporte de rentabilidad — Relojes Carrasco",
        period,
        headers: [
          "Fecha",
          "Reloj",
          "Marca",
          "Venta USD",
          "Costo total USD",
          "Gastos venta USD",
          "Ganancia bruta USD",
          "Ganancia neta USD",
          "Margen bruto %",
          "Margen neto %",
          "Días en stock",
        ],
        rows: data.sales.rows.map((sale) => [
          formatDate(sale.saleDate),
          sale.productName,
          sale.brand,
          sale.amountUsd,
          sale.totalCostUsd,
          sale.saleExpensesUsd,
          sale.grossProfitUsd,
          sale.netProfitUsd,
          sale.grossMarginPct,
          sale.netMarginPct,
          sale.daysInInventory,
        ]),
      };
      break;

    case "inventario": {
      const inventory = computeInventory(snap);
      const aging = inventoryAgingSummary(inventory);
      table = {
        title: "Reporte de inventario — Relojes Carrasco",
        period: `Al ${formatDate(to)} · Antigüedad: ${aging.map((b) => `${b.label}: ${b.count}`).join(" · ")}`,
        headers: [
          "Reloj",
          "Marca",
          "Modelo",
          "Estado",
          "Publicado",
          "Fecha compra",
          "Moneda compra",
          "Costo total USD",
          "Costo total UYU",
          "Precio lista USD",
          "Ganancia potencial USD",
          "Días en stock",
        ],
        rows: inventory.map((item) => [
          item.name,
          item.brand,
          item.model,
          item.status,
          item.isPublished ? "Sí" : "No",
          item.purchaseDate ? formatDate(item.purchaseDate) : null,
          item.purchaseCurrency,
          item.totalCostUsd,
          item.totalCostUyu,
          item.listingUsd,
          item.potentialProfitUsd,
          item.ageDays,
        ]),
      };
      break;
    }

    case "gastos":
      table = {
        title: "Reporte de gastos — Relojes Carrasco",
        period,
        headers: [
          "Fecha",
          "Descripción",
          "Categoría",
          "Moneda",
          "Importe original",
          "Importe USD",
          "Estado de pago",
          "Pagado",
        ],
        rows: data.expensesReport.rows.map((expense) => [
          formatDate(expense.expense_date),
          expense.description,
          expense.categoryName,
          expense.currency,
          expense.amount,
          expense.amount_usd,
          expense.payment_status,
          expense.amount_paid,
        ]),
      };
      break;

    case "liquidez":
      table = {
        title: "Reporte de liquidez — Relojes Carrasco",
        period,
        headers: ["Concepto", "USD", "UYU"],
        rows: [
          ["Caja inicial", data.cashFlow.openingUsd, data.cashFlow.openingUyu],
          ["Entradas del período", data.cashFlow.inflowsUsd, data.cashFlow.inflowsUyu],
          ["Salidas del período", data.cashFlow.outflowsUsd, data.cashFlow.outflowsUyu],
          ["Caja al cierre", data.cashFlow.closingUsd, data.cashFlow.closingUyu],
          ["", null, null],
          ["Cuentas por cobrar (consolidado USD)", data.receivables.consolidatedUsd, null],
          ["Cuentas por pagar (consolidado USD)", data.payables.consolidatedUsd, null],
          ["", null, null],
          ...data.liquidity.accounts.map((account) => [
            `Saldo — ${account.name}`,
            account.currency === "USD" ? account.balance : null,
            account.currency === "UYU" ? account.balance : null,
          ]),
        ],
      };
      break;
  }

  const filename = `${report}_${from}_${to}`;

  try {
    if (format === "csv") {
      return new NextResponse(new Uint8Array(buildCsv(table)), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }
    if (format === "xlsx") {
      const buffer = await buildXlsx(table);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }
    const buffer = await buildPdf(table);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[export] error generando exportación", {
      report,
      format,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "No se pudo generar la exportación." },
      { status: 500 }
    );
  }
}
