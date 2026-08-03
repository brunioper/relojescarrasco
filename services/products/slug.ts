import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { slugify } from "@/lib/utils";

/** Genera un slug único para un producto, agregando un sufijo si ya existe. */
export async function uniqueProductSlug(
  supabase: SupabaseClient<Database>,
  base: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = slugify(base) || "reloj";
  let candidate = baseSlug;
  for (let i = 0; i < 20; i++) {
    let query = supabase.from("products").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return candidate;
    candidate = `${baseSlug}-${i + 2}`;
  }
  return `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
}
