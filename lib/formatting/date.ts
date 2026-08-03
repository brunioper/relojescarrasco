/**
 * Fechas en formato uruguayo (DD/MM/YYYY) y zona America/Montevideo.
 */

const TZ = "America/Montevideo";

const dateFmt = new Intl.DateTimeFormat("es-UY", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

const dateTimeFmt = new Intl.DateTimeFormat("es-UY", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});

/** "03/08/2026" a partir de un ISO date ("2026-08-03") o timestamp. */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? parseDateSafe(iso) : iso;
  if (!date) return "—";
  return dateFmt.format(date);
}

/** "03/08/2026 14:30" */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? parseDateSafe(iso) : iso;
  if (!date) return "—";
  return dateTimeFmt.format(date);
}

function parseDateSafe(iso: string): Date | null {
  // Fechas puras (YYYY-MM-DD) se interpretan a mediodía UTC para evitar
  // corrimientos de día por zona horaria.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fecha de hoy en Montevideo como "YYYY-MM-DD" (para inputs date). */
export function todayMontevideo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Días entre dos fechas ISO (b - a), en días enteros. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}
