import { daysBetween, todayMontevideo } from "@/lib/formatting/date";

/**
 * Antigüedad de inventario.
 * Grupos: 0–30, 31–60, 61–90, 91–180, +180 días.
 */

export const AGING_BUCKETS = [
  { key: "0-30", label: "0–30 días", min: 0, max: 30 },
  { key: "31-60", label: "31–60 días", min: 31, max: 60 },
  { key: "61-90", label: "61–90 días", min: 61, max: 90 },
  { key: "91-180", label: "91–180 días", min: 91, max: 180 },
  { key: "180+", label: "Más de 180 días", min: 181, max: Infinity },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

/** Días en inventario desde la fecha de compra hasta hoy (o hasta la venta). */
export function inventoryAgeDays(purchaseDate: string | null, until?: string): number | null {
  if (!purchaseDate) return null;
  return Math.max(0, daysBetween(purchaseDate, until ?? todayMontevideo()));
}

export function agingBucket(days: number | null): AgingBucketKey | null {
  if (days === null) return null;
  for (const bucket of AGING_BUCKETS) {
    if (days >= bucket.min && days <= bucket.max) return bucket.key;
  }
  return "180+";
}

/** Stock lento: más de 90 días sin venderse. */
export function isSlowMoving(days: number | null): boolean {
  return days !== null && days > 90;
}
