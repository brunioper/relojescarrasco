import { describe, expect, it } from "vitest";
import {
  formatCataloguePrice,
  formatUsd,
  formatUyu,
  formatAmount,
  formatPercent,
} from "@/lib/formatting/currency";
import { formatDate, daysBetween, todayMontevideo } from "@/lib/formatting/date";

/**
 * Nota: Intl es-UY usa punto como separador de miles.
 * Se normalizan los espacios no separables para comparar.
 */
const normalize = (value: string) => value.replace(/ | /g, " ");

describe("formato de precio de catálogo (obligatorio)", () => {
  it("US$ 450 ($ 18.900 UYU aprox.)", () => {
    expect(normalize(formatCataloguePrice(450, 18900))).toBe("US$ 450 ($ 18.900 UYU aprox.)");
  });

  it("US$ 1.250 ($ 52.500 UYU aprox.)", () => {
    expect(normalize(formatCataloguePrice(1250, 52500))).toBe(
      "US$ 1.250 ($ 52.500 UYU aprox.)"
    );
  });

  it("US$ 275,50 ($ 11.571 UYU aprox.)", () => {
    expect(normalize(formatCataloguePrice(275.5, 11571))).toBe(
      "US$ 275,50 ($ 11.571 UYU aprox.)"
    );
  });

  it("sin cotización muestra solo USD", () => {
    expect(normalize(formatCataloguePrice(450, null))).toBe("US$ 450");
  });
});

describe("formato de moneda es-UY", () => {
  it("USD entero sin decimales", () => {
    expect(normalize(formatUsd(450))).toBe("US$ 450");
    expect(normalize(formatUsd(1250))).toBe("US$ 1.250");
  });

  it("USD con decimales usa coma", () => {
    expect(normalize(formatUsd(275.5))).toBe("US$ 275,50");
  });

  it("UYU redondeado al peso con separador de miles", () => {
    expect(normalize(formatUyu(18900))).toBe("$ 18.900");
    expect(normalize(formatUyu(18900.6))).toBe("$ 18.901");
  });

  it("formatAmount distingue monedas", () => {
    expect(normalize(formatAmount(100, "USD"))).toBe("US$ 100");
    expect(normalize(formatAmount(100, "UYU"))).toBe("$ 100 UYU");
  });

  it("porcentajes con coma decimal", () => {
    expect(normalize(formatPercent(12.5))).toBe("12,5 %");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("fechas es-UY", () => {
  it("DD/MM/YYYY", () => {
    expect(formatDate("2026-08-03")).toBe("03/08/2026");
    expect(formatDate("2026-01-15")).toBe("15/01/2026");
  });

  it("días entre fechas", () => {
    expect(daysBetween("2026-05-10", "2026-07-08")).toBe(59);
    expect(daysBetween("2026-07-08", "2026-07-08")).toBe(0);
  });

  it("todayMontevideo devuelve ISO válido", () => {
    expect(todayMontevideo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
