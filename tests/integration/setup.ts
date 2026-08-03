import { config } from "dotenv";

// Carga .env.local si existe (sin sobrescribir variables ya definidas).
config({ path: ".env.local" });

/**
 * Claves por defecto del entorno LOCAL de Supabase (supabase start).
 * Son claves demo públicas y conocidas, válidas solo en local.
 * En CI se configuran vía variables de entorno.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

export const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const ADMIN_EMAIL = "admin@relojescarrasco.test";
export const ADMIN_PASSWORD = "Admin1234!";
export const VIEWER_EMAIL = "viewer@relojescarrasco.test";
export const VIEWER_PASSWORD = "Viewer1234!";

/** true si hay un Supabase local corriendo con el seed cargado. */
export async function supabaseAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(3000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}
