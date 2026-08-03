import { d } from "@/services/finance/currency";

/**
 * Márgenes sobre venta:
 *   Margen bruto % = ganancia bruta / precio de venta × 100
 *   Margen neto  % = ganancia neta  / precio de venta × 100
 *
 * Venta de importe 0 → margen null (división segura), nunca Infinity/NaN.
 */

export function grossMarginPct(grossProfit: number, saleAmount: number): number | null {
  return marginPct(grossProfit, saleAmount);
}

export function netMarginPct(netProfit: number, saleAmount: number): number | null {
  return marginPct(netProfit, saleAmount);
}

function marginPct(profit: number, saleAmount: number): number | null {
  const sale = d(saleAmount);
  if (sale.lte(0)) return null;
  return d(profit).div(sale).mul(100).toDecimalPlaces(2).toNumber();
}
