import { d, roundMoney } from "@/services/finance/currency";
import { daysBetween } from "@/lib/formatting/date";

/**
 * Rentabilidad de una venta (ver docs/FORMULAS.md):
 *
 *   Ganancia bruta   = precio real de venta − costo total del producto
 *   Ganancia neta    = ganancia bruta − gastos de la venta
 *   Diferencia lista = precio real de venta − precio de lista
 *   Descuento %      = (lista − venta) / lista × 100
 *   Días en stock    = fecha de venta − fecha de compra
 *
 * Todos los importes en USD históricos preservados.
 * Divisiones por cero devuelven null (se muestra "—").
 */

export type SaleProfitInput = {
  saleAmountUsd: number;
  totalCostUsd: number;
  saleExpensesUsd: number;
  listingPriceUsd: number | null;
  purchaseDate: string | null;
  saleDate: string;
};

export type SaleProfit = {
  grossProfitUsd: number;
  netProfitUsd: number;
  listingDifferenceUsd: number | null;
  discountFromListingPct: number | null;
  daysInInventory: number | null;
};

export function computeSaleProfit(input: SaleProfitInput): SaleProfit {
  const sale = d(input.saleAmountUsd);
  const cost = d(input.totalCostUsd);
  const expenses = d(input.saleExpensesUsd);

  const gross = sale.sub(cost);
  const net = gross.sub(expenses);

  let listingDifference: number | null = null;
  let discountPct: number | null = null;
  if (input.listingPriceUsd !== null) {
    const listing = d(input.listingPriceUsd);
    listingDifference = roundMoney(sale.sub(listing)).toNumber();
    if (listing.gt(0)) {
      discountPct = listing
        .sub(sale)
        .div(listing)
        .mul(100)
        .toDecimalPlaces(2)
        .toNumber();
    }
  }

  return {
    grossProfitUsd: roundMoney(gross).toNumber(),
    netProfitUsd: roundMoney(net).toNumber(),
    listingDifferenceUsd: listingDifference,
    discountFromListingPct: discountPct,
    daysInInventory: input.purchaseDate
      ? daysBetween(input.purchaseDate, input.saleDate)
      : null,
  };
}
