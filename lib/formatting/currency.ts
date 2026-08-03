/**
 * Formato de moneda es-UY.
 *
 * Reglas del catálogo público (obligatorias):
 *   - Precio primario SIEMPRE en USD: "US$ 450" / "US$ 1.250" / "US$ 275,50"
 *   - Conversión UYU entre paréntesis, redondeada al peso: "($ 18.900 UYU aprox.)"
 *   - Separador de miles uruguayo (punto), decimales con coma.
 *
 * Este módulo solo FORMATEA para mostrar. Los cálculos financieros
 * viven en services/finance con aritmética decimal exacta.
 */
import type { CurrencyCode } from "@/types/supabase";

const intUsd = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decUsd = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intUyu = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "US$ 450" si es entero, "US$ 275,50" si tiene decimales. */
export function formatUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const isWhole = Number.isInteger(rounded);
  return `US$ ${(isWhole ? intUsd : decUsd).format(rounded)}`;
}

/** "$ 18.900" — redondeado al peso entero. */
export function formatUyu(amount: number): string {
  return `$ ${intUyu.format(Math.round(amount))}`;
}

/** Formato genérico para el panel interno. */
export function formatAmount(amount: number, currency: CurrencyCode): string {
  return currency === "USD" ? formatUsd(amount) : `${formatUyu(amount)} UYU`;
}

/**
 * Precio de catálogo completo:
 *   "US$ 450 ($ 18.900 UYU aprox.)"
 * Si no hay cotización disponible (uyuApprox null) muestra solo USD.
 */
export function formatCataloguePrice(usd: number, uyuApprox: number | null): string {
  const primary = formatUsd(usd);
  if (uyuApprox === null || !Number.isFinite(uyuApprox)) return primary;
  return `${primary} (${formatUyu(uyuApprox)} UYU aprox.)`;
}

export const CURRENCY_DISCLAIMER =
  "El importe en pesos uruguayos es una conversión aproximada y puede variar según el tipo de cambio vigente al momento de la operación.";

/** Formato de porcentaje: "12,5 %". */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`;
}
