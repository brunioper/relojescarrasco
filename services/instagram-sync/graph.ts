import "server-only";

import type { GraphMedia } from "@/lib/instagram/media";

/**
 * API oficial de Instagram (inicio de sesión de Instagram, cuenta profesional).
 * Docs: developers.facebook.com/docs/instagram-platform
 *
 * El token viaja como parámetro (así lo pide la API) pero nunca se escribe
 * en logs ni en mensajes de error.
 */

const GRAPH_URL = "https://graph.instagram.com";

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null
  ) {
    super(message);
    this.name = "InstagramApiError";
  }

  /** El token venció, se revocó o no tiene permisos. */
  get isAuthError(): boolean {
    return this.status === 401 || this.code === 190;
  }
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(path, GRAPH_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", token);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new InstagramApiError("Instagram no respondió.", 0, null);
  }

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number } })
    | null;
  if (!response.ok || !body || body.error) {
    throw new InstagramApiError(
      body?.error?.message?.slice(0, 200) ?? `Instagram respondió con el código ${response.status}.`,
      response.status,
      body?.error?.code ?? null
    );
  }
  return body;
}

const MEDIA_FIELDS = "id,media_type,media_url,thumbnail_url,timestamp,permalink";

export async function getInstagramProfile(token: string): Promise<{ userId: string; username: string }> {
  const body = await graphGet<{ user_id?: string; username?: string; id?: string }>(
    "/me",
    { fields: "user_id,username" },
    token
  );
  const userId = body.user_id ?? body.id;
  if (!userId || !body.username) {
    throw new InstagramApiError("Instagram no devolvió la cuenta.", 200, null);
  }
  return { userId, username: body.username };
}

/** Historias activas (las de las últimas 24 horas). */
export async function listStories(token: string, igUserId: string): Promise<GraphMedia[]> {
  const body = await graphGet<{ data?: GraphMedia[] }>(`/${igUserId}/stories`, { fields: MEDIA_FIELDS }, token);
  return body.data ?? [];
}

/** Publicaciones más recientes del feed. */
export async function listRecentMedia(token: string, igUserId: string, limit = 10): Promise<GraphMedia[]> {
  const body = await graphGet<{ data?: GraphMedia[] }>(
    `/${igUserId}/media`,
    { fields: MEDIA_FIELDS, limit: String(limit) },
    token
  );
  return body.data ?? [];
}

/** Fotos y videos de una publicación de varias imágenes (carrusel). */
export async function listChildren(token: string, mediaId: string): Promise<GraphMedia[]> {
  const body = await graphGet<{ data?: GraphMedia[] }>(
    `/${mediaId}/children`,
    { fields: "id,media_type,media_url,thumbnail_url" },
    token
  );
  return body.data ?? [];
}

/** Renueva un token de larga duración (debe tener más de 24 h y no estar vencido). */
export async function refreshLongLivedToken(token: string): Promise<{ token: string; expiresInSeconds: number }> {
  const body = await graphGet<{ access_token?: string; expires_in?: number }>(
    "/refresh_access_token",
    { grant_type: "ig_refresh_token" },
    token
  );
  if (!body.access_token) throw new InstagramApiError("Instagram no devolvió el token renovado.", 200, null);
  return { token: body.access_token, expiresInSeconds: body.expires_in ?? 60 * 24 * 60 * 60 };
}
