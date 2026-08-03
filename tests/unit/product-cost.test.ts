import { describe, expect, it } from "vitest";
import { totalProductCost } from "@/services/finance/product-cost";

describe("costo total del producto", () => {
  it("compra + costos directos con históricos preservados", () => {
    // Rolex del seed: compra 3.800 USD @39,80 + service 9.500 UYU (238,69 USD)
    // + pulido 2.500 UYU (62,81 USD)
    const totals = totalProductCost(
      { amount_usd: 3800, amount_uyu: 151240 },
      [
        { amount_usd: 238.69, amount_uyu: 9500 },
        { amount_usd: 62.81, amount_uyu: 2500 },
      ]
    );

    expect(totals.purchaseUsd).toBe(3800);
    expect(totals.costsUsd).toBe(301.5);
    expect(totals.totalUsd).toBe(4101.5);
    expect(totals.totalUyu).toBe(163240);
  });

  it("sin compra registrada el costo es solo de costos directos", () => {
    const totals = totalProductCost(null, [{ amount_usd: 50, amount_uyu: 2025 }]);
    expect(totals.totalUsd).toBe(50);
    expect(totals.purchaseUsd).toBe(0);
  });

  it("sin costos el total es la compra", () => {
    const totals = totalProductCost({ amount_usd: 1500, amount_uyu: 60150 }, []);
    expect(totals.totalUsd).toBe(1500);
    expect(totals.costsUsd).toBe(0);
  });

  it("los históricos NO se recalculan: cada componente aporta su conversión original", () => {
    // Dos costos de 1.000 UYU con cotizaciones distintas (25 y 50 USD).
    const totals = totalProductCost(null, [
      { amount_usd: 25, amount_uyu: 1000 }, // cotización 40
      { amount_usd: 50, amount_uyu: 1000 }, // cotización 20 (histórica distinta)
    ]);
    expect(totals.totalUsd).toBe(75); // no 2 × mismo valor
    expect(totals.totalUyu).toBe(2000);
  });
});
