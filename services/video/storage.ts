import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Archivos del estudio de reels: bucket privado "videos", siempre con
 * URLs firmadas de corta duración generadas por el servidor.
 */

export const VIDEO_BUCKET = "videos";

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/** Tipo de archivo sin parámetros ("audio/webm;codecs=opus" → "audio/webm"). */
export function baseMimeType(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}

export function extensionFor(mime: string): string | null {
  return EXTENSIONS[baseMimeType(mime)] ?? null;
}

export const projectFolder = (id: string) => `proyectos/${id}`;
export const reelPath = (id: string, file: string) => `${projectFolder(id)}/reels/${file}`;

export async function signedUploadUrl(
  admin: SupabaseClient<Database>,
  path: string
): Promise<{ path: string; token: string; signedUrl: string }> {
  const { data, error } = await admin.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new Error("No se pudo preparar la subida.");
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function signedDownloadUrl(
  admin: SupabaseClient<Database>,
  path: string,
  options: { seconds?: number; downloadAs?: string } = {}
): Promise<string | null> {
  const { data } = await admin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(path, options.seconds ?? 3600, options.downloadAs ? { download: options.downloadAs } : undefined);
  return data?.signedUrl ?? null;
}

/** Borra todo lo de un proyecto (video, voz y reels). */
export async function deleteProjectFiles(admin: SupabaseClient<Database>, id: string): Promise<void> {
  const folders = [projectFolder(id), `${projectFolder(id)}/reels`];
  for (const folder of folders) {
    const { data } = await admin.storage.from(VIDEO_BUCKET).list(folder, { limit: 100 });
    const files = (data ?? []).filter((item) => item.id !== null).map((item) => `${folder}/${item.name}`);
    if (files.length > 0) await admin.storage.from(VIDEO_BUCKET).remove(files);
  }
}

/**
 * Tope del estudio. El plan gratuito de Supabase tiene 1 GB para todo: el
 * resto queda para las fotos del catálogo, que no se tocan nunca.
 */
export const VIDEO_STORAGE_BUDGET = 400 * 1024 * 1024;

/** Borra los archivos de un proyecto y lo deja marcado (el guion queda). */
export async function releaseProjectFiles(admin: SupabaseClient<Database>, id: string): Promise<void> {
  await deleteProjectFiles(admin, id);
  await admin
    .from("video_projects")
    .update({ files_deleted: true, video_path: null, voice_path: null, reels: [], storage_bytes: 0 })
    .eq("id", id);
}

/**
 * Hace lugar para un archivo nuevo: si el estudio pasaría su tope, borra los
 * archivos de los videos tocados hace más tiempo (nunca los que se están
 * armando). Devuelve false si aun así no entra.
 */
export async function makeRoom(admin: SupabaseClient<Database>, incomingBytes: number): Promise<boolean> {
  const { data, error } = await admin
    .from("video_projects")
    .select("id, status, storage_bytes")
    .eq("files_deleted", false)
    .order("updated_at", { ascending: true });
  if (error) throw new Error("No se pudo calcular el espacio de los videos.");

  let used = (data ?? []).reduce((sum, row) => sum + Number(row.storage_bytes), 0);
  for (const row of data ?? []) {
    if (used + incomingBytes <= VIDEO_STORAGE_BUDGET) break;
    if (row.status === "en_cola" || row.status === "procesando") continue;
    await releaseProjectFiles(admin, row.id);
    used -= Number(row.storage_bytes);
  }
  return used + incomingBytes <= VIDEO_STORAGE_BUDGET;
}
