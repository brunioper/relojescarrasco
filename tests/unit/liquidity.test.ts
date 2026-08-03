import { describe, expect, it } from "vitest";
import {
  accountBalance,
  liquiditySummary,
  outstandingSummary,
} from "@/services/finance/liquidity";
import type { CashTx } from "@/services/finance/cash-flow";

const tx = (
  type: CashTx["type"],
  amount: number,
  usd: number,
  uyu: number,
  date = "2026-07-01"
): CashTx => ({ type, amount, amount_usd: usd, amount_uyu: uyu, transaction_date: date });

describe("saldo de cuenta", () => {
  it("saldo = inicial + entradas − salidas (en moneda de la cuenta)", () => {
    const balance = accountBalance({
      id: "a",
      name: "Caja USD",
      currency: "USD",
      account_type: "efectivo",
      initial_balance: 5000,
      transactions: [
        tx("cobro_venta", 1000, 1000, 40250),
        tx("pago_compra", 1500, 1500, 60150),
        tx("aporte_dueno", 2000, 2000, 79600),
        tx("retiro_dueno", 300, 300, 12150),
      ],
    });
    expect(balance.balance).toBe(6200); // 5000 + 1000 − 1500 + 2000 − 300
  });

  it("las transferencias afectan el saldo de la cuenta", () => {
    const balance = accountBalance({
      id: "a",
      name: "Banco USD",
      currency: "USD",
      account_type: "banco",
      initial_balance: 1000,
      transactions: [tx("transferencia_salida", 500, 500, 20125)],
    });
    expect(balance.balance).toBe(500);
  });
});

describe("liquidez", () => {
  const accounts = [
    {
      id: "usd",
      name: "Caja USD",
      currency: "USD" as const,
      account_type: "efectivo",
      initial_balance: 1000,
      transactions: [tx("cobro_venta", 500, 500, 20250)],
    },
    {
      id: "uyu",
      name: "Caja UYU",
      currency: "UYU" as const,
      account_type: "efectivo",
      initial_balance: 40500,
      transactions: [tx("pago_gasto_general", 20250, 500, 20250)],
    },
  ];

  it("totales por moneda separados", () => {
    const summary = liquiditySummary(accounts, null);
    expect(summary.totalUsd).toBe(1500);
    expect(summary.totalUyu).toBe(20250);
    expect(summary.consolidatedUsd).toBeNull(); // sin cotización activa
  });

  it("consolidado con cotización activa (solo display)", () => {
    const summary = liquiditySummary(accounts, 40.5);
    expect(summary.consolidatedUsd).toBe(2000); // 1500 + 20250/40,5
    expect(summary.consolidatedUyu).toBe(81000); // 20250 + 1500×40,5
  });
});

describe("cuentas por cobrar / pagar (pagos parciales)", () => {
  it("saldo pendiente = total − pagado, con cotización histórica", () => {
    const summary = outstandingSummary([
      // Venta 1.900 USD con 1.000 cobrados -> 900 USD pendientes
      { amount: 1900, amount_paid: 1000, currency: "USD", exchange_rate: 40.25, payment_status: "parcial" },
      // Gasto 4.500 UYU sin pagar @40,50 -> 111,11 USD consolidado
      { amount: 4500, amount_paid: 0, currency: "UYU", exchange_rate: 40.5, payment_status: "pendiente" },
    ]);
    expect(summary.totalUsd).toBe(900);
    expect(summary.totalUyu).toBe(4500);
    expect(summary.consolidatedUsd).toBe(1011.11);
  });

  it("pagados y cancelados no cuentan", () => {
    const summary = outstandingSummary([
      { amount: 100, amount_paid: 100, currency: "USD", exchange_rate: 40, payment_status: "pagado" },
      { amount: 100, amount_paid: 0, currency: "USD", exchange_rate: 40, payment_status: "cancelado" },
    ]);
    expect(summary.consolidatedUsd).toBe(0);
  });

  it("el saldo pendiente nunca es negativo", () => {
    const summary = outstandingSummary([
      // Sobrepago por redondeo: el saldo se trunca a 0, no a negativo.
      { amount: 100, amount_paid: 100.01, currency: "USD", exchange_rate: 40, payment_status: "parcial" },
    ]);
    expect(summary.consolidatedUsd).toBe(0);
  });
});
