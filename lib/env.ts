import { z } from "zod";

/**
 * Validación de variables de entorno.
 *
 * - `publicEnv`: seguras para el navegador (prefijo NEXT_PUBLIC_).
 * - `serverEnv()`: SOLO servidor; incluye la clave service-role.
 *
 * La validación ocurre al arrancar: si falta una variable requerida
 * la aplicación falla de inmediato con un mensaje claro, en lugar de
 * fallar de forma confusa en producción.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY es requerida"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY es requerida en el servidor"),
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  RATE_LIMIT_SECRET: z.string().min(16).optional(),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

export const publicEnv = (() => {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Variables de entorno públicas inválidas:\n${formatIssues(parsed.error)}\n` +
        "Copie .env.example a .env.local y complete los valores."
    );
  }
  return parsed.data;
})();

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/** Solo llamar desde código de servidor. */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() no puede usarse en el navegador.");
  }
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variables de entorno del servidor inválidas:\n${formatIssues(parsed.error)}`);
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}
