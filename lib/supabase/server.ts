import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { publicEnv } from "@/lib/env";

/**
 * Cliente Supabase para SERVIDOR (Server Components, Server Actions,
 * Route Handlers). Autenticado con la sesión del usuario vía cookies;
 * todas las operaciones pasan por RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: el middleware
            // se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}

/**
 * Cliente anónimo de servidor (páginas públicas renderizadas en servidor).
 * Sin sesión: solo puede leer las vistas públicas autorizadas para `anon`.
 */
export function createAnonClient() {
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
