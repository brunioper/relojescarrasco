import "server-only";

import Decimal from "decimal.js";
import { createClient } from "@/lib/supabase/server";
import { d, roundMoney } from "@/services/finance/currency";
import { totalProductCost } from "@/services/finance/product-cost";
import { computeSaleProfit } from "@/services/finance/sale-profit";
import { grossMarginPct, netMarginPct } from "@/services/finance/margins";
import { inventoryAgeDays, agingBucket, AGING_BUCKETS } from "@/services/finance/inventory";
import { liquiditySummary, outstandingSummary } from "@/services/finance/liquidity";
import { summarizeCashFlow, type CashTx } from "@/services/finance/cash-flow";

/**
 * Carga y agregación central de datos financieros para dashboard,
 * reportes y exportaciones. Una sola pasada de consultas explícitas
 * (sin select *) y agregación con aritmética decimal.
 */

export type DateRange = { from: string; to: string };

export type FinanceSnapshot = Awaited<ReturnType<typeof loadFinanceSnapshot>>;

export async function loadFinanceSnapshot() {
  const supabase = await createClient();

  const [products, purchases, costs, sales, saleExpenses, expenses, accounts, cashTxs, categories, rateRows] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, brand, model, status, is_published, listing_price_usd, listing_price_uyu, listing_price_currency, listing_price_amount, created_at"
        )
        .is("deleted_at", null),
      supabase
        .from("purchases")
        .select(
          "id, product_id, purchase_date, amount, currency, exchange_rate, amount_usd, amount_uyu, payment_status, amount_paid, supplier_id"
        ),
      supabase
        .from("product_costs")
        .select(
          "id, product_id, category_id, description, cost_date, amount, currency, exchange_rate, amount_usd, amount_uyu, payment_status, amount_paid"
        )
        .is("deleted_at", null),
      supabase
        .from("sales")
        .select(
          "id, product_id, sale_date, amount, currency, exchange_rate, amount_usd, amount_uyu, listing_price_usd_at_sale, payment_status, amount_paid, customer_id"
        )
        .eq("is_cancelled", false),
      supabase
        .from("sale_expenses")
        .select("id, sale_id, category_id, description, amount, currency, exchange_rate, amount_usd, amount_uyu"),
      supabase
        .from("general_expenses")
        .select(
          "id, expense_date, category_id, description, amount, currency, exchange_rate, amount_usd, amount_uyu, payment_status, amount_paid, supplier_id, is_recurring"
        )
        .is("deleted_at", null),
      supabase
        .from("cash_accounts")
        .select("id, name, currency, account_type, initial_balance, is_active")
        .eq("is_active", true),
      supabase
        .from("cash_transactions")
        .select("id, account_id, transaction_date, type, amount, amount_usd, amount_uyu, description"),
      supabase.from("expense_categories").select("id, name, kind"),
      supabase.rpc("get_active_usd_uyu_rate"),
    ]);

  const activeRate = rateRows.data?.[0] ? Number(rateRows.data[0].rate) : null;

  return {
    products: products.data ?? [],
    purchases: purchases.data ?? [],
    costs: costs.data ?? [],
    sales: sales.data ?? [],
    saleExpenses: saleExpenses.data ?? [],
    expenses: expenses.data ?? [],
    accounts: accounts.data ?? [],
    cashTxs: cashTxs.data ?? [],
    categories: categories.data ?? [],
    activeRate,
  };
}

const inRange = (date: string, range: DateRange) => date >= range.from && date <= range.to;

// ------------------------------------------------------------
// Rentabilidad por venta (con costos históricos preservados)
// ------------------------------------------------------------
export type SaleWithProfit = {
  saleId: string;
  productId: string;
  productName: string;
  brand: string;
  saleDate: string;
  currency: string;
  amount: number;
  amountUsd: number;
  listingUsd: number | null;
  totalCostUsd: number;
  saleExpensesUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  discountPct: number | null;
  daysInInventory: number | null;
  paymentStatus: string;
  amountPaid: number;
};

export function computeSalesWithProfit(snap: FinanceSnapshot): SaleWithProfit[] {
  const purchaseByProduct = new Map(snap.purchases.map((p) => [p.product_id, p]));
  const productById = new Map(snap.products.map((p) => [p.id, p]));
  const costsByProduct = new Map<string, typeof snap.costs>();
  for (const cost of snap.costs) {
    const list = costsByProduct.get(cost.product_id) ?? [];
    list.push(cost);
    costsByProduct.set(cost.product_id, list);
  }
  const expensesBySale = new Map<string, typeof snap.saleExpenses>();
  for (const exp of snap.saleExpenses) {
    const list = expensesBySale.get(exp.sale_id) ?? [];
    list.push(exp);
    expensesBySale.set(exp.sale_id, list);
  }

  return snap.sales.map((sale) => {
    const product = productById.get(sale.product_id);
    const purchase = purchaseByProduct.get(sale.product_id) ?? null;
    const productCosts = costsByProduct.get(sale.product_id) ?? [];
    const saleExps = expensesBySale.get(sale.id) ?? [];

    const totals = totalProductCost(purchase, productCosts);
    const saleExpensesUsd = roundMoney(
      saleExps.reduce((acc, e) => acc.add(d(e.amount_usd)), new Decimal(0))
    ).toNumber();

    const profit = computeSaleProfit({
      saleAmountUsd: sale.amount_usd,
      totalCostUsd: totals.totalUsd,
      saleExpensesUsd,
      listingPriceUsd: sale.listing_price_usd_at_sale,
      purchaseDate: purchase?.purchase_date ?? null,
      saleDate: sale.sale_date,
    });

    return {
      saleId: sale.id,
      productId: sale.product_id,
      productName: product?.name ?? "—",
      brand: product?.brand ?? "—",
      saleDate: sale.sale_date,
      currency: sale.currency,
      amount: sale.amount,
      amountUsd: sale.amount_usd,
      listingUsd: sale.listing_price_usd_at_sale,
      totalCostUsd: totals.totalUsd,
      saleExpensesUsd,
      grossProfitUsd: profit.grossProfitUsd,
      netProfitUsd: profit.netProfitUsd,
      grossMarginPct: grossMarginPct(profit.grossProfitUsd, sale.amount_usd),
      netMarginPct: netMarginPct(profit.netProfitUsd, sale.amount_usd),
      discountPct: profit.discountFromListingPct,
      daysInInventory: profit.daysInInventory,
      paymentStatus: sale.payment_status,
      amountPaid: sale.amount_paid,
    };
  });
}

// ------------------------------------------------------------
// Inventario
// ------------------------------------------------------------
export type InventoryItem = {
  productId: string;
  name: string;
  brand: string;
  model: string;
  status: string;
  isPublished: boolean;
  purchaseDate: string | null;
  purchaseCurrency: string | null;
  totalCostUsd: number;
  totalCostUyu: number;
  listingUsd: number | null;
  potentialProfitUsd: number | null;
  ageDays: number | null;
  agingBucket: string | null;
  slowMoving: boolean;
};

const IN_STOCK = new Set(["disponible", "reservado", "en_reparacion", "no_publicado"]);

export function computeInventory(snap: FinanceSnapshot): InventoryItem[] {
  const purchaseByProduct = new Map(snap.purchases.map((p) => [p.product_id, p]));
  const costsByProduct = new Map<string, typeof snap.costs>();
  for (const cost of snap.costs) {
    const list = costsByProduct.get(cost.product_id) ?? [];
    list.push(cost);
    costsByProduct.set(cost.product_id, list);
  }

  return snap.products
    .filter((p) => IN_STOCK.has(p.status))
    .map((product) => {
      const purchase = purchaseByProduct.get(product.id) ?? null;
      const totals = totalProductCost(purchase, costsByProduct.get(product.id) ?? []);
      const ageDays = inventoryAgeDays(purchase?.purchase_date ?? null);
      const listingUsd = product.listing_price_usd;

      return {
        productId: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        status: product.status,
        isPublished: product.is_published,
        purchaseDate: purchase?.purchase_date ?? null,
        purchaseCurrency: purchase?.currency ?? null,
        totalCostUsd: totals.totalUsd,
        totalCostUyu: totals.totalUyu,
        listingUsd,
        potentialProfitUsd:
          listingUsd !== null
            ? roundMoney(d(listingUsd).sub(d(totals.totalUsd))).toNumber()
            : null,
        ageDays,
        agingBucket: agingBucket(ageDays),
        slowMoving: ageDays !== null && ageDays > 90,
      };
    });
}

export function inventoryAgingSummary(items: InventoryItem[]) {
  return AGING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: items.filter((i) => i.agingBucket === bucket.key).length,
    costUsd: roundMoney(
      items
        .filter((i) => i.agingBucket === bucket.key)
        .reduce((acc, i) => acc.add(d(i.totalCostUsd)), new Decimal(0))
    ).toNumber(),
  }));
}

// ------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------
export function computeDashboard(snap: FinanceSnapshot, today: string) {
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);

  const salesWithProfit = computeSalesWithProfit(snap);
  const inventory = computeInventory(snap);

  const sumUsd = (values: number[]) =>
    roundMoney(values.reduce((acc, v) => acc.add(d(v)), new Decimal(0))).toNumber();

  const monthSales = salesWithProfit.filter((s) => s.saleDate.startsWith(month));
  const yearSales = salesWithProfit.filter((s) => s.saleDate.startsWith(year));
  const monthExpenses = snap.expenses.filter((e) => e.expense_date.startsWith(month));

  const receivables = outstandingSummary(snap.sales);
  const payables = outstandingSummary([
    ...snap.purchases,
    ...snap.costs,
    ...snap.expenses,
  ]);

  const accountsWithTx = snap.accounts.map((account) => ({
    ...account,
    transactions: snap.cashTxs.filter((tx) => tx.account_id === account.id) as CashTx[],
  }));
  const liquidity = liquiditySummary(accountsWithTx, snap.activeRate);

  // Series mensuales (últimos 12 meses)
  const months: string[] = [];
  const now = new Date(`${today}T12:00:00Z`);
  for (let i = 11; i >= 0; i--) {
    const dte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(dte.toISOString().slice(0, 7));
  }

  const monthly = months.map((m) => {
    const monthSalesList = salesWithProfit.filter((s) => s.saleDate.startsWith(m));
    const monthPurchases = snap.purchases.filter((p) => p.purchase_date.startsWith(m));
    const monthExp = snap.expenses.filter((e) => e.expense_date.startsWith(m));
    return {
      month: m,
      salesUsd: sumUsd(monthSalesList.map((s) => s.amountUsd)),
      grossProfitUsd: sumUsd(monthSalesList.map((s) => s.grossProfitUsd)),
      netProfitUsd: sumUsd(monthSalesList.map((s) => s.netProfitUsd)),
      purchasesUsd: sumUsd(monthPurchases.map((p) => p.amount_usd)),
      expensesUsd: sumUsd(monthExp.map((e) => e.amount_usd)),
      unitsSold: monthSalesList.length,
    };
  });

  // Por marca
  const brandMap = new Map<string, { salesUsd: Decimal; netProfitUsd: Decimal; units: number }>();
  for (const sale of salesWithProfit) {
    const entry = brandMap.get(sale.brand) ?? {
      salesUsd: new Decimal(0),
      netProfitUsd: new Decimal(0),
      units: 0,
    };
    entry.salesUsd = entry.salesUsd.add(d(sale.amountUsd));
    entry.netProfitUsd = entry.netProfitUsd.add(d(sale.netProfitUsd));
    entry.units += 1;
    brandMap.set(sale.brand, entry);
  }
  const byBrand = [...brandMap.entries()]
    .map(([brand, v]) => ({
      brand,
      salesUsd: roundMoney(v.salesUsd).toNumber(),
      netProfitUsd: roundMoney(v.netProfitUsd).toNumber(),
      units: v.units,
    }))
    .sort((a, b) => b.salesUsd - a.salesUsd);

  const avgAge =
    inventory.length > 0
      ? Math.round(
          inventory.reduce((acc, i) => acc + (i.ageDays ?? 0), 0) / inventory.length
        )
      : 0;

  const soldWithDays = salesWithProfit.filter((s) => s.daysInInventory !== null);
  const avgDaysToSell =
    soldWithDays.length > 0
      ? Math.round(
          soldWithDays.reduce((acc, s) => acc + (s.daysInInventory ?? 0), 0) / soldWithDays.length
        )
      : null;

  return {
    counts: {
      disponibles: snap.products.filter((p) => p.status === "disponible").length,
      reservados: snap.products.filter((p) => p.status === "reservado").length,
      vendidos: snap.products.filter((p) => p.status === "vendido").length,
      enReparacion: snap.products.filter((p) => p.status === "en_reparacion").length,
    },
    inventoryCostUsd: sumUsd(inventory.map((i) => i.totalCostUsd)),
    inventoryCostUyu: sumUsd(inventory.map((i) => i.totalCostUyu)),
    inventoryListingUsd: sumUsd(inventory.map((i) => i.listingUsd ?? 0)),
    potentialProfitUsd: sumUsd(inventory.map((i) => i.potentialProfitUsd ?? 0)),
    salesMonthUsd: sumUsd(monthSales.map((s) => s.amountUsd)),
    salesMonthCount: monthSales.length,
    salesYearUsd: sumUsd(yearSales.map((s) => s.amountUsd)),
    salesYearCount: yearSales.length,
    grossProfitMonthUsd: sumUsd(monthSales.map((s) => s.grossProfitUsd)),
    netProfitMonthUsd: sumUsd(monthSales.map((s) => s.netProfitUsd)),
    grossProfitYearUsd: sumUsd(yearSales.map((s) => s.grossProfitUsd)),
    netProfitYearUsd: sumUsd(yearSales.map((s) => s.netProfitUsd)),
    expensesMonthUsd: sumUsd(monthExpenses.map((e) => e.amount_usd)),
    liquidity,
    receivables,
    payables,
    monthly,
    byBrand,
    avgInventoryAgeDays: avgAge,
    avgDaysToSell,
    activeRate: snap.activeRate,
    inventory,
    salesWithProfit,
  };
}

// ------------------------------------------------------------
// Reportes por rango de fechas
// ------------------------------------------------------------
export function computeReports(snap: FinanceSnapshot, range: DateRange) {
  const allSales = computeSalesWithProfit(snap);
  const sales = allSales.filter((s) => inRange(s.saleDate, range));
  const expenses = snap.expenses.filter((e) => inRange(e.expense_date, range));
  const costs = snap.costs.filter((c) => inRange(c.cost_date, range));
  const purchases = snap.purchases.filter((p) => inRange(p.purchase_date, range));
  const saleExpensesInRange = snap.saleExpenses.filter((se) => {
    const sale = snap.sales.find((s) => s.id === se.sale_id);
    return sale ? inRange(sale.sale_date, range) : false;
  });
  const cashTxs = snap.cashTxs.filter((tx) => inRange(tx.transaction_date, range)) as CashTx[];
  const cashBefore = snap.cashTxs.filter((tx) => tx.transaction_date < range.from) as CashTx[];

  const sumUsd = (values: number[]) =>
    roundMoney(values.reduce((acc, v) => acc.add(d(v)), new Decimal(0))).toNumber();

  const categoryName = (id: string) =>
    snap.categories.find((c) => c.id === id)?.name ?? "Sin categoría";

  const grossSalesUsd = sumUsd(sales.map((s) => s.amountUsd));
  const listingTotalUsd = sumUsd(sales.map((s) => s.listingUsd ?? s.amountUsd));

  // Flujo de caja del período
  const flow = summarizeCashFlow(cashTxs);
  const flowBefore = summarizeCashFlow(cashBefore);
  const initialBalancesUsd = sumUsd(
    snap.accounts.filter((a) => a.currency === "USD").map((a) => a.initial_balance)
  );
  const initialBalancesUyu = sumUsd(
    snap.accounts.filter((a) => a.currency === "UYU").map((a) => a.initial_balance)
  );

  const accountsWithTx = snap.accounts.map((account) => ({
    ...account,
    transactions: snap.cashTxs.filter(
      (tx) => tx.account_id === account.id && tx.transaction_date <= range.to
    ) as CashTx[],
  }));

  const expenseByCategory = new Map<string, Decimal>();
  for (const e of expenses) {
    const key = categoryName(e.category_id);
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? new Decimal(0)).add(d(e.amount_usd)));
  }
  for (const c of costs) {
    const key = `Costos de producto — ${categoryName(c.category_id)}`;
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? new Decimal(0)).add(d(c.amount_usd)));
  }

  return {
    range,
    sales: {
      count: sales.length,
      grossUsd: grossSalesUsd,
      averageUsd: sales.length > 0 ? roundMoney(d(grossSalesUsd).div(sales.length)).toNumber() : 0,
      listingTotalUsd,
      differenceUsd: roundMoney(d(grossSalesUsd).sub(d(listingTotalUsd))).toNumber(),
      averageDiscountPct:
        sales.filter((s) => s.discountPct !== null).length > 0
          ? roundMoney(
              sales
                .filter((s) => s.discountPct !== null)
                .reduce((acc, s) => acc.add(d(s.discountPct!)), new Decimal(0))
                .div(sales.filter((s) => s.discountPct !== null).length)
            ).toNumber()
          : null,
      byCurrency: {
        USD: sales.filter((s) => s.currency === "USD").length,
        UYU: sales.filter((s) => s.currency === "UYU").length,
      },
      rows: sales,
    },
    profitability: {
      grossProfitUsd: sumUsd(sales.map((s) => s.grossProfitUsd)),
      netProfitUsd: sumUsd(sales.map((s) => s.netProfitUsd)),
      grossMarginPct: grossMarginPct(sumUsd(sales.map((s) => s.grossProfitUsd)), grossSalesUsd),
      netMarginPct: netMarginPct(sumUsd(sales.map((s) => s.netProfitUsd)), grossSalesUsd),
      best: [...sales].sort((a, b) => b.netProfitUsd - a.netProfitUsd).slice(0, 5),
      worst: [...sales].sort((a, b) => a.netProfitUsd - b.netProfitUsd).slice(0, 5),
    },
    expensesReport: {
      productCostsUsd: sumUsd(costs.map((c) => c.amount_usd)),
      generalUsd: sumUsd(expenses.map((e) => e.amount_usd)),
      saleExpensesUsd: sumUsd(saleExpensesInRange.map((e) => e.amount_usd)),
      paidUsd: sumUsd(expenses.filter((e) => e.payment_status === "pagado").map((e) => e.amount_usd)),
      pendingUsd: sumUsd(
        expenses
          .filter((e) => e.payment_status === "pendiente" || e.payment_status === "parcial")
          .map((e) =>
            roundMoney(
              d(e.amount_usd).mul(d(e.amount).sub(d(e.amount_paid)).div(d(e.amount).eq(0) ? 1 : d(e.amount)))
            ).toNumber()
          )
      ),
      byCategory: [...expenseByCategory.entries()]
        .map(([name, value]) => ({ name, usd: roundMoney(value).toNumber() }))
        .sort((a, b) => b.usd - a.usd),
      purchasesUsd: sumUsd(purchases.map((p) => p.amount_usd)),
      rows: expenses.map((e) => ({ ...e, categoryName: categoryName(e.category_id) })),
    },
    cashFlow: {
      openingUsd: roundMoney(d(initialBalancesUsd).add(d(flowBefore.netUsd))).toNumber(),
      openingUyu: roundMoney(d(initialBalancesUyu).add(d(flowBefore.netUyu))).toNumber(),
      inflowsUsd: flow.inflowsUsd,
      inflowsUyu: flow.inflowsUyu,
      outflowsUsd: flow.outflowsUsd,
      outflowsUyu: flow.outflowsUyu,
      closingUsd: roundMoney(
        d(initialBalancesUsd).add(d(flowBefore.netUsd)).add(d(flow.netUsd))
      ).toNumber(),
      closingUyu: roundMoney(
        d(initialBalancesUyu).add(d(flowBefore.netUyu)).add(d(flow.netUyu))
      ).toNumber(),
      byType: flow.byType,
    },
    liquidity: liquiditySummary(accountsWithTx, snap.activeRate),
    receivables: outstandingSummary(snap.sales),
    payables: outstandingSummary([...snap.purchases, ...snap.costs, ...snap.expenses]),
  };
}
