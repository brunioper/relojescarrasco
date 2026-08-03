import Decimal from "decimal.js";
import { d, roundMoney } from "@/services/finance/currency";

/**
 * Costo total de un producto:
 *   precio de compra + todos los costos directos
 *   (service, reparación, cristal, correa, pulido, limpieza, transporte,
 *   comisiones, importación, fotografía, packaging, otros).
 *
 * Cada componente conserva sus importes convertidos históricos
 * (amount_usd / amount_uyu con la cotización de SU fecha);
 * el total es la suma de esos históricos, nunca una reconversión.
 */

export type CostComponent = {
  amount_usd: number;
  amount_uyu: number;
};

export type ProductCostTotals = {
  purchaseUsd: number;
  purchaseUyu: number;
  costsUsd: number;
  costsUyu: number;
  totalUsd: number;
  totalUyu: number;
};

export function totalProductCost(
  purchase: CostComponent | null,
  costs: CostComponent[]
): ProductCostTotals {
  const purchaseUsd = purchase ? d(purchase.amount_usd) : new Decimal(0);
  const purchaseUyu = purchase ? d(purchase.amount_uyu) : new Decimal(0);

  let costsUsd = new Decimal(0);
  let costsUyu = new Decimal(0);
  for (const cost of costs) {
    costsUsd = costsUsd.add(d(cost.amount_usd));
    costsUyu = costsUyu.add(d(cost.amount_uyu));
  }

  return {
    purchaseUsd: roundMoney(purchaseUsd).toNumber(),
    purchaseUyu: roundMoney(purchaseUyu).toNumber(),
    costsUsd: roundMoney(costsUsd).toNumber(),
    costsUyu: roundMoney(costsUyu).toNumber(),
    totalUsd: roundMoney(purchaseUsd.add(costsUsd)).toNumber(),
    totalUyu: roundMoney(purchaseUyu.add(costsUyu)).toNumber(),
  };
}
