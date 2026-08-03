import Decimal from "decimal.js";
import type { CurrencyCode } from "@/types/supabase";

/**
 * Servicio central de conversión USD/UYU.
 *
 * REGLAS (ver docs/FORMULAS.md):
 * - Toda conversión usa aritmética decimal exacta (decimal.js),
 *   nunca aritmética de punto flotante de JavaScript.
 * - La cotización se expresa como UYU por 1 USD.
 * - Se redondea SOLO al presentar o persistir (2 decimales),
 *   nunca en pasos intermedios.
 * - Las transacciones históricas guardan importe original, moneda,
 *   cotización usada y ambos convertidos: NUNCA se recalculan con
 *   cotizaciones posteriores.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export const d = (value: number | string | Decimal): Decimal => new Decimal(value);

/** Redondeo monetario a 2 decimales (solo para persistir/mostrar). */
export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** USD -> UYU con la cotización dada. Sin redondear (intermedio). */
export function usdToUyu(amountUsd: Decimal | number, rate: Decimal | number): Decimal {
  const r = d(rate);
  if (r.lte(0)) throw new Error("VALIDATION: la cotización debe ser mayor que cero.");
  return d(amountUsd).mul(r);
}

/** UYU -> USD con la cotización dada. Sin redondear (intermedio). */
export function uyuToUsd(amountUyu: Decimal | number, rate: Decimal | number): Decimal {
  const r = d(rate);
  if (r.lte(0)) throw new Error("VALIDATION: la cotización debe ser mayor que cero.");
  return d(amountUyu).div(r);
}

export type ConvertedAmounts = {
  /** Importe original redondeado a 2 decimales. */
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  /** Equivalente USD redondeado a 2 decimales. */
  amountUsd: number;
  /** Equivalente UYU redondeado a 2 decimales. */
  amountUyu: number;
};

/**
 * Convierte un importe en su moneda original a AMBAS monedas para
 * persistir en la base (patrón usado por compras, costos, ventas,
 * gastos y pagos).
 */
export function convertForStorage(
  amount: number | string,
  currency: CurrencyCode,
  exchangeRate: number | string
): ConvertedAmounts {
  const amt = d(amount);
  const rate = d(exchangeRate);
  if (amt.lt(0)) throw new Error("VALIDATION: el importe no puede ser negativo.");
  if (rate.lte(0)) throw new Error("VALIDATION: la cotización debe ser mayor que cero.");

  const usd = currency === "USD" ? amt : uyuToUsd(amt, rate);
  const uyu = currency === "UYU" ? amt : usdToUyu(amt, rate);

  return {
    amount: roundMoney(amt).toNumber(),
    currency,
    exchangeRate: rate.toDecimalPlaces(4).toNumber(),
    amountUsd: roundMoney(usd).toNumber(),
    amountUyu: roundMoney(uyu).toNumber(),
  };
}

/**
 * Conversión aproximada del catálogo público:
 * precio USD -> UYU con la cotización activa del catálogo,
 * redondeado al PESO ENTERO.
 * Devuelve null si no hay cotización (el catálogo muestra solo USD).
 */
export function catalogueUyuApprox(
  priceUsd: number | Decimal,
  catalogueRate: number | Decimal | null
): number | null {
  if (catalogueRate === null) return null;
  const rate = d(catalogueRate);
  if (rate.lte(0)) return null;
  return d(priceUsd).mul(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}
