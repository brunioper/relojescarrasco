import { describe, expect, it } from "vitest";
import {
  catalogueUyuApprox,
  convertForStorage,
  d,
  roundMoney,
  usdToUyu,
  uyuToUsd,
} from "@/services/finance/currency";

describe("conversión USD/UYU", () => {
  it("convierte USD a UYU con la cotización dada", () => {
    expect(roundMoney(usdToUyu(100, 40.5)).toNumber()).toBe(4050);
    expect(roundMoney(usdToUyu(450, 42)).toNumber()).toBe(18900);
  });

  it("convierte UYU a USD con la cotización dada", () => {
    expect(roundMoney(uyuToUsd(4050, 40.5)).toNumber()).toBe(100);
    expect(roundMoney(uyuToUsd(17000, 40.5)).toNumber()).toBe(419.75);
  });

  it("no usa aritmética flotante de JS (0.1 + 0.2)", () => {
    // 0.1 + 0.2 !== 0.3 en float; con Decimal debe ser exacto.
    const result = d(0.1).add(d(0.2));
    expect(result.toNumber()).toBe(0.3);
  });

  it("rechaza cotización cero o negativa", () => {
    expect(() => usdToUyu(100, 0)).toThrow();
    expect(() => uyuToUsd(100, -1)).toThrow();
  });

  it("convertForStorage guarda original + ambos convertidos (origen USD)", () => {
    const money = convertForStorage(1500, "USD", 40.1);
    expect(money.amount).toBe(1500);
    expect(money.currency).toBe("USD");
    expect(money.exchangeRate).toBe(40.1);
    expect(money.amountUsd).toBe(1500);
    expect(money.amountUyu).toBe(60150);
  });

  it("convertForStorage guarda original + ambos convertidos (origen UYU)", () => {
    const money = convertForStorage(12000, "UYU", 40.25);
    expect(money.amount).toBe(12000);
    expect(money.currency).toBe("UYU");
    expect(money.amountUyu).toBe(12000);
    expect(money.amountUsd).toBe(298.14); // 12000 / 40.25 redondeado a 2
  });

  it("convertForStorage rechaza importes negativos", () => {
    expect(() => convertForStorage(-1, "USD", 40)).toThrow();
  });

  it("redondea solo al final (sin redondeos intermedios acumulados)", () => {
    // 1/3 * 3 con decimales: debe recuperar el valor exacto.
    const third = d(100).div(3);
    expect(roundMoney(third.mul(3)).toNumber()).toBe(100);
  });
});

describe("conversión aproximada del catálogo", () => {
  it("redondea al peso entero", () => {
    expect(catalogueUyuApprox(450, 42)).toBe(18900);
    expect(catalogueUyuApprox(275.5, 42)).toBe(11571);
    expect(catalogueUyuApprox(419.75, 40.5)).toBe(17000); // 16.999,875 -> 17.000
  });

  it("ejemplos exactos de la especificación", () => {
    // US$ 275,50 con cotización 42 -> $ 11.571
    expect(catalogueUyuApprox(275.5, 42)).toBe(11571);
  });

  it("devuelve null sin cotización", () => {
    expect(catalogueUyuApprox(450, null)).toBeNull();
    expect(catalogueUyuApprox(450, 0)).toBeNull();
    expect(catalogueUyuApprox(450, -5)).toBeNull();
  });
});
