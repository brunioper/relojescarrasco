import Decimal from "decimal.js";
import { d, roundMoney, usdToUyu, uyuToUsd } from "@/services/finance/currency";
import { isInflow, type CashTx } from "@/services/finance/cash-flow";
import type { CurrencyCode } from "@/types/supabase";

/**
 * Liquidez (ver docs/FORMULAS.md):
 *
 * - Saldo de cada cuenta = saldo inicial + entradas − salidas
 *   (en la MONEDA de la cuenta; las transferencias sí cuentan aquí).
 * - Liquidez USD = suma de saldos de cuentas en USD.
 * - Liquidez UYU = suma de saldos de cuentas en UYU.
 * - Vista consolidada: convierte con la cotización activa SOLO para
 *   mostrar; nunca se persiste.
 *
 * El inventario sin vender NO es caja. Lo no cobrado es cuenta por
 * cobrar; lo no pagado es cuenta por pagar.
 */

export type AccountWithTx = {
  id: string;
  name: string;
  currency: CurrencyCode;
  account_type: string;
  initial_balance: number;
  transactions: CashTx[];
};

export type AccountBalance = {
  id: string;
  name: string;
  currency: CurrencyCode;
  account_type: string;
  balance: number;
};

export function accountBalance(account: AccountWithTx): AccountBalance {
  let balance = d(account.initial_balance);
  for (const tx of account.transactions) {
    // En el saldo de la cuenta se usa el importe en la moneda de la cuenta,
    // incluidas las transferencias internas.
    balance = isInflow(tx.type) ? balance.add(d(tx.amount)) : balance.sub(d(tx.amount));
  }
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    account_type: account.account_type,
    balance: roundMoney(balance).toNumber(),
  };
}

export type LiquiditySummary = {
  accounts: AccountBalance[];
  totalUsd: number;
  totalUyu: number;
  /** Consolidado en USD usando la cotización activa (solo display). */
  consolidatedUsd: number | null;
  /** Consolidado en UYU usando la cotización activa (solo display). */
  consolidatedUyu: number | null;
};

export function liquiditySummary(
  accounts: AccountWithTx[],
  activeRate: number | null
): LiquiditySummary {
  const balances = accounts.map(accountBalance);

  let totalUsd = new Decimal(0);
  let totalUyu = new Decimal(0);
  for (const b of balances) {
    if (b.currency === "USD") totalUsd = totalUsd.add(d(b.balance));
    else totalUyu = totalUyu.add(d(b.balance));
  }

  let consolidatedUsd: number | null = null;
  let consolidatedUyu: number | null = null;
  if (activeRate !== null && activeRate > 0) {
    consolidatedUsd = roundMoney(totalUsd.add(uyuToUsd(totalUyu, activeRate))).toNumber();
    consolidatedUyu = roundMoney(totalUyu.add(usdToUyu(totalUsd, activeRate))).toNumber();
  }

  return {
    accounts: balances,
    totalUsd: roundMoney(totalUsd).toNumber(),
    totalUyu: roundMoney(totalUyu).toNumber(),
    consolidatedUsd,
    consolidatedUyu,
  };
}

/**
 * Cuentas por cobrar / por pagar a partir de comprobantes con saldo.
 * outstanding = total − pagado (en la moneda del comprobante,
 * más los equivalentes históricos para totalizar).
 */
export type Receivable = {
  amount: number;
  amount_paid: number;
  currency: CurrencyCode;
  exchange_rate: number;
  payment_status: string;
};

export type OutstandingSummary = {
  totalUsd: number;
  totalUyu: number;
  /** Consolidado a USD con cotización histórica de cada comprobante. */
  consolidatedUsd: number;
};

export function outstandingSummary(items: Receivable[]): OutstandingSummary {
  let usd = new Decimal(0);
  let uyu = new Decimal(0);
  let consolidated = new Decimal(0);

  for (const item of items) {
    if (item.payment_status === "cancelado" || item.payment_status === "pagado") continue;
    const outstanding = Decimal.max(d(item.amount).sub(d(item.amount_paid)), new Decimal(0));
    if (outstanding.lte(0)) continue;

    if (item.currency === "USD") {
      usd = usd.add(outstanding);
      consolidated = consolidated.add(outstanding);
    } else {
      uyu = uyu.add(outstanding);
      consolidated = consolidated.add(uyuToUsd(outstanding, item.exchange_rate));
    }
  }

  return {
    totalUsd: roundMoney(usd).toNumber(),
    totalUyu: roundMoney(uyu).toNumber(),
    consolidatedUsd: roundMoney(consolidated).toNumber(),
  };
}
