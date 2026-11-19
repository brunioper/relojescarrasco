import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { serverEnv } from "@/lib/env";
import { decryptToken, deriveTokenKey, encryptToken } from "@/lib/instagram/token-crypto";
import { getInstagramProfile, refreshLongLivedToken } from "@/services/instagram-sync/graph";

/**
 * Conexión con la cuenta de Instagram. El token se guarda cifrado con una
 * clave derivada de SUPABASE_SERVICE_ROLE_KEY: si esa clave se rota, hay
 * que volver a pegar el token en el panel.
 */

export type InstagramConnection = Omit<Tables<"instagram_connection">, "token_ciphertext">;

const tokenKey = () => deriveTokenKey(serverEnv().SUPABASE_SERVICE_ROLE_KEY);

/** Cada cuánto se renueva el token (dura 60 días; se renueva mucho antes). */
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

/** Falta aplicar la migración de la Etapa 6 en esta base. */
export class InstagramNotSetUpError extends Error {
  constructor() {
    super("Falta aplicar la actualización de la base de datos para Instagram (ver BLOQUEOS.md).");
    this.name = "InstagramNotSetUpError";
  }
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function loadConnection(
  admin: SupabaseClient<Database>
): Promise<(InstagramConnection & { token: string }) | null> {
  const { data, error } = await admin.from("instagram_connection").select("*").eq("id", 1).maybeSingle();
  if (isMissingTable(error)) throw new InstagramNotSetUpError();
  if (error) throw new Error("No se pudo leer la conexión con Instagram.");
  if (!data) return null;

  const { token_ciphertext, ...connection } = data;
  try {
    return { ...connection, token: decryptToken(token_ciphertext, tokenKey()) };
  } catch {
    // Se rotó la clave del servidor: el token guardado ya no se puede leer.
    return { ...connection, token: "" };
  }
}

/** Estado visible en el panel (sin el token). */
export async function loadConnectionStatus(admin: SupabaseClient<Database>): Promise<InstagramConnection | null> {
  const { data, error } = await admin
    .from("instagram_connection")
    .select(
      "id, ig_user_id, username, token_refreshed_at, token_expires_at, watch_since, auto_publish, connected_by, connected_at, last_checked_at, last_error, updated_at"
    )
    .eq("id", 1)
    .maybeSingle();
  if (isMissingTable(error)) throw new InstagramNotSetUpError();
  return data ?? null;
}

/** Valida el token contra Instagram y guarda la conexión (desde ahora se importa lo nuevo). */
export async function saveConnection(
  admin: SupabaseClient<Database>,
  token: string,
  connectedBy: string
): Promise<{ username: string }> {
  const profile = await getInstagramProfile(token);
  const now = new Date();
  const { error } = await admin.from("instagram_connection").upsert({
    id: 1,
    ig_user_id: profile.userId,
    username: profile.username,
    token_ciphertext: encryptToken(token, tokenKey()),
    token_refreshed_at: now.toISOString(),
    token_expires_at: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    watch_since: now.toISOString(),
    connected_by: connectedBy,
    connected_at: now.toISOString(),
    last_checked_at: null,
    last_error: null,
  });
  if (isMissingTable(error)) throw new InstagramNotSetUpError();
  if (error) throw new Error("No se pudo guardar la conexión con Instagram.");
  return { username: profile.username };
}

/** Renueva el token si corresponde. Devuelve el token vigente. */
export async function refreshTokenIfDue(
  admin: SupabaseClient<Database>,
  connection: InstagramConnection & { token: string },
  now = new Date()
): Promise<string> {
  const last = new Date(connection.token_refreshed_at).getTime();
  if (now.getTime() - last < REFRESH_EVERY_MS) return connection.token;

  const refreshed = await refreshLongLivedToken(connection.token);
  await admin
    .from("instagram_connection")
    .update({
      token_ciphertext: encryptToken(refreshed.token, tokenKey()),
      token_refreshed_at: now.toISOString(),
      token_expires_at: new Date(now.getTime() + refreshed.expiresInSeconds * 1000).toISOString(),
    })
    .eq("id", 1);
  return refreshed.token;
}

export async function recordCheck(admin: SupabaseClient<Database>, lastError: string | null): Promise<void> {
  await admin
    .from("instagram_connection")
    .update({ last_checked_at: new Date().toISOString(), last_error: lastError })
    .eq("id", 1);
}
