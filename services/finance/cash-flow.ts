import Decimal from "decimal.js";
import { d, roundMoney } from "@/services/finance/currency";
import type { Enums } from "@/types/supabase";

/**
 * Flujo de caja (ver docs/FORMULAS.md):
 *
 *   Caja al cierre =
 *     caja inicial
 *     + cobros de ventas
 *     + otros ingresos cobrados
 *     + aportes del dueño
 *     − compras de relojes pagadas
 *     − costos de producto pagados
 *     − gastos generales pagados
 *     − gastos de venta pagados
 *     − retiros del dueño
 *
 * Solo movimientos REALES de caja: lo no cobrado/no pagado se informa
 * aparte como cuentas por cobrar / por pagar (nunca como liquidez).
 */

type CashTxType = Enums<"cash_transaction_type">;

const INFLOWS: ReadonlySet<CashTxType> = new Set([
  "cobro_venta",
  "otro_ingreso",
  "aporte_dueno",
  "transferencia_entrada",
  "ajuste_positivo",
]);

export function isInflow(type: CashTxType): boolean {
  return INFLOWS.has(type);
}

export type CashTx = {
  type: CashTxType;
  /** Importe en la moneda de la cuenta. */
  amount: number;
  amount_usd: number;
  amount_uyu: number;
  transaction_date: string;
};

export type CashFlowSummary = {
  inflowsUsd: number;
  inflowsUyu: number;
  outflowsUsd: number;
  outflowsUyu: number;
  netUsd: number;
  netUyu: number;
  byType: Record<string, { usd: number; uyu: number }>;
};

/**
 * Resume movimientos de caja de un período.
 * Las transferencias internas se excluyen del neto consolidado por
 * defecto (mueven dinero entre cuentas propias, no son flujo real),
 * salvo que includeTransfers sea true (vista por cuenta).
 */
export function summarizeCashFlow(
  transactions: CashTx[],
  options: { includeTransfers?: boolean } = {}
): CashFlowSummary {
  const includeTransfers = options.includeTransfers ?? false;

  let inUsd = new Decimal(0);
  let inUyu = new Decimal(0);
  let outUsd = new Decimal(0);
  let outUyu = new Decimal(0);
  const byType: Record<string, { usd: Decimal; uyu: Decimal }> = {};

  for (const tx of transactions) {
    const isTransfer =
      tx.type === "transferencia_entrada" || tx.type === "transferencia_salida";
    if (isTransfer && !includeTransfers) continue;

    const usd = d(tx.amount_usd);
    const uyu = d(tx.amount_uyu);

    if (isInflow(tx.type)) {
      inUsd = inUsd.add(usd);
      inUyu = inUyu.add(uyu);
    } else {
      outUsd = outUsd.add(usd);
      outUyu = outUyu.add(uyu);
    }

    const bucket = (byType[tx.type] ??= { usd: new Decimal(0), uyu: new Decimal(0) });
    bucket.usd = bucket.usd.add(usd);
    bucket.uyu = bucket.uyu.add(uyu);
  }

  return {
    inflowsUsd: roundMoney(inUsd).toNumber(),
    inflowsUyu: roundMoney(inUyu).toNumber(),
    outflowsUsd: roundMoney(outUsd).toNumber(),
    outflowsUyu: roundMoney(outUyu).toNumber(),
    netUsd: roundMoney(inUsd.sub(outUsd)).toNumber(),
    netUyu: roundMoney(inUyu.sub(outUyu)).toNumber(),
    byType: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [
        k,
        { usd: roundMoney(v.usd).toNumber(), uyu: roundMoney(v.uyu).toNumber() },
      ])
    ),
  };
}
