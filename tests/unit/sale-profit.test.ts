import { describe, expect, it } from "vitest";
import { computeSaleProfit } from "@/services/finance/sale-profit";
import { grossMarginPct, netMarginPct } from "@/services/finance/margins";

describe("rentabilidad de venta", () => {
  const base = {
    saleAmountUsd: 1900,
    totalCostUsd: 1245.23,
    saleExpensesUsd: 19.88,
    listingPriceUsd: 2100,
    purchaseDate: "2026-04-15",
    saleDate: "2026-07-08",
  };

  it("ganancia bruta = venta − costo total", () => {
    const profit = computeSaleProfit(base);
    expect(profit.grossProfitUsd).toBe(654.77);
  });

  it("ganancia neta = bruta − gastos de venta", () => {
    const profit = computeSaleProfit(base);
    expect(profit.netProfitUsd).toBe(634.89);
  });

  it("diferencia con lista y descuento %", () => {
    const profit = computeSaleProfit(base);
    expect(profit.listingDifferenceUsd).toBe(-200);
    // (2100 − 1900) / 2100 × 100 = 9,52 %
    expect(profit.discountFromListingPct).toBe(9.52);
  });

  it("días en inventario = venta − compra", () => {
    const profit = computeSaleProfit(base);
    expect(profit.daysInInventory).toBe(84);
  });

  it("sin precio de lista no calcula diferencia ni descuento", () => {
    const profit = computeSaleProfit({ ...base, listingPriceUsd: null });
    expect(profit.listingDifferenceUsd).toBeNull();
    expect(profit.discountFromListingPct).toBeNull();
  });

  it("sin fecha de compra no calcula días", () => {
    const profit = computeSaleProfit({ ...base, purchaseDate: null });
    expect(profit.daysInInventory).toBeNull();
  });

  it("venta con pérdida da ganancia negativa", () => {
    const profit = computeSaleProfit({ ...base, saleAmountUsd: 1000 });
    expect(profit.grossProfitUsd).toBe(-245.23);
    expect(profit.netProfitUsd).toBe(-265.11);
  });

  it("lista en cero no divide por cero", () => {
    const profit = computeSaleProfit({ ...base, listingPriceUsd: 0 });
    expect(profit.discountFromListingPct).toBeNull();
    expect(profit.listingDifferenceUsd).toBe(1900);
  });
});

describe("márgenes", () => {
  it("margen bruto y neto en %", () => {
    expect(grossMarginPct(654.77, 1900)).toBe(34.46);
    expect(netMarginPct(634.89, 1900)).toBe(33.42);
  });

  it("venta cero devuelve null (división segura)", () => {
    expect(grossMarginPct(100, 0)).toBeNull();
    expect(netMarginPct(100, 0)).toBeNull();
  });

  it("margen negativo con pérdida", () => {
    expect(grossMarginPct(-100, 1000)).toBe(-10);
  });
});
