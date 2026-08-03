import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Cotización activa USD/UYU para el panel interno + advertencias.
 */

export type ActiveRate = {
  rate: number;
  rateDate: string;
  source: string;
  isManual: boolean;
  ageDays: number;
  isStale: boolean;
};

export async function getActiveRate(warningDays = 7): Promise<ActiveRate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_usd_uyu_rate");
  if (error || !data || data.length === 0) return null;

  const row = data[0]!;
  const ageDays = Math.max(
    0,
    Math.round((Date.now() - new Date(`${row.rate_date}T12:00:00Z`).getTime()) / 86_400_000)
  );

  return {
    rate: Number(row.rate),
    rateDate: row.rate_date,
    source: row.source,
    isManual: row.is_manual,
    ageDays,
    isStale: ageDays > warningDays,
  };
}
