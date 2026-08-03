import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { serverEnv } from "@/lib/env";

/**
 * Cliente Supabase con clave SERVICE ROLE.
 *
 * ⚠️ USO RESTRINGIDO — omite Row Level Security por completo.
 *
 * Solo se utiliza para operaciones de servidor que genuinamente lo
 * requieren (URLs firmadas de documentos privados, mantenimiento),
 * SIEMPRE después de verificar la autorización del usuario con
 * `requireAdmin()`. Nunca como sustituto de políticas RLS correctas.
 *
 * La clave jamás llega al navegador: este módulo importa "server-only"
 * y la variable no tiene prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
