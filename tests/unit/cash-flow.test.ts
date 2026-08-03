import { describe, expect, it } from "vitest";
import { summarizeCashFlow, isInflow, type CashTx } from "@/services/finance/cash-flow";

const tx = (type: CashTx["type"], usd: number, uyu: number): CashTx => ({
  type,
  amount: usd || uyu,
  amount_usd: usd,
  amount_uyu: uyu,
  transaction_date: "2026-07-15",
});

describe("flujo de caja", () => {
  it("clasifica entradas y salidas por tipo", () => {
    expect(isInflow("cobro_venta")).toBe(true);
    expect(isInflow("aporte_dueno")).toBe(true);
    expect(isInflow("pago_compra")).toBe(false);
    expect(isInflow("retiro_dueno")).toBe(false);
  });

  it("neto = entradas − salidas", () => {
    const summary = summarizeCashFlow([
      tx("cobro_venta", 1000, 40250),
      tx("otro_ingreso", 100, 4025),
      tx("aporte_dueno", 2000, 80500),
      tx("pago_compra", 1500, 60375),
      tx("pago_gasto_general", 170, 6842.5),
      tx("retiro_dueno", 246.91, 10000),
    ]);
    expect(summary.inflowsUsd).toBe(3100);
    expect(summary.outflowsUsd).toBe(1916.91);
    expect(summary.netUsd).toBe(1183.09);
  });

  it("las transferencias internas se excluyen del flujo consolidado", () => {
    const summary = summarizeCashFlow([
      tx("transferencia_salida", 500, 20125),
      tx("transferencia_entrada", 500, 20125),
      tx("cobro_venta", 100, 4025),
    ]);
    expect(summary.inflowsUsd).toBe(100);
    expect(summary.outflowsUsd).toBe(0);
  });

  it("con includeTransfers las transferencias sí aparecen (vista por cuenta)", () => {
    const summary = summarizeCashFlow(
      [tx("transferencia_salida", 500, 20125), tx("transferencia_entrada", 500, 20125)],
      { includeTransfers: true }
    );
    expect(summary.inflowsUsd).toBe(500);
    expect(summary.outflowsUsd).toBe(500);
    expect(summary.netUsd).toBe(0);
  });

  it("desglose por tipo", () => {
    const summary = summarizeCashFlow([
      tx("cobro_venta", 100, 4000),
      tx("cobro_venta", 50, 2000),
    ]);
    expect(summary.byType["cobro_venta"]?.usd).toBe(150);
  });
});
