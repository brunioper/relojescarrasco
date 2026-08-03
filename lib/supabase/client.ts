"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { publicEnv } from "@/lib/env";

/**
 * Cliente Supabase para el NAVEGADOR.
 * Usa exclusivamente la clave anónima: toda operación queda
 * protegida por Row Level Security.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
