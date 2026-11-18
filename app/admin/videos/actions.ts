"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { uuidSchema } from "@/lib/validation/money";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, normalizeScript, reelScriptSchema } from "@/lib/video/script";
import {
  VIDEO_BUCKET,
  baseMimeType,
  deleteProjectFiles,
  extensionFor,
  makeRoom,
  projectFolder,
  signedUploadUrl,
} from "@/services/video/storage";

/**
 * Estudio de reels. Los archivos van directo del navegador al bucket
 * privado con una URL firmada de un solo uso que da el servidor.
 */

const MIN_VIDEO_SECONDS = 6;

function revalidate(id?: string) {
  revalidatePath("/admin/videos");
  if (id) revalidatePath(`/admin/videos/${id}`);
}

const createSchema = z.object({
  productId: z.string().uuid().nullable(),
  title: z.string().trim().max(200).default(""),
  durationSec: z.number().min(MIN_VIDEO_SECONDS, `El video tiene que durar al menos ${MIN_VIDEO_SECONDS} segundos.`).max(MAX_VIDEO_SECONDS, `El video puede durar hasta ${MAX_VIDEO_SECONDS} segundos.`),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().positive().max(MAX_VIDEO_BYTES, "El video pesa más de 50 MB."),
});

export async function createVideoProjectAction(
  input: unknown
): Promise<ActionResult<{ id: string; path: string; token: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");

  const mime = baseMimeType(parsed.data.mimeType);
  const extension = extensionFor(mime);
  if (!mime.startsWith("video/") || !extension) return fail("Formato de video no admitido (usá MP4 o MOV).");

  const supabase = await createClient();
  let title = parsed.data.title;
  if (!title && parsed.data.productId) {
    const { data } = await supabase.from("products").select("name").eq("id", parsed.data.productId).maybeSingle();
    title = data?.name ?? "";
  }
  if (!title) title = `Video del ${new Intl.DateTimeFormat("es-UY", { dateStyle: "short" }).format(new Date())}`;

  // Antes de subir, se hace lugar borrando archivos de videos viejos si hace falta.
  const admin = createAdminClient();
  const room = await makeRoom(admin, parsed.data.sizeBytes).catch(() => false);
  if (!room) return fail("No hay lugar para otro video mientras se arman los que están en cola. Probá en unos minutos.");

  const { data: project, error } = await supabase
    .from("video_projects")
    .insert({
      product_id: parsed.data.productId,
      title,
      video_duration: Math.round(parsed.data.durationSec * 100) / 100,
      storage_bytes: parsed.data.sizeBytes,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return fail(safeErrorMessage(error));

  const path = `${projectFolder(project.id)}/video.${extension}`;
  try {
    const upload = await signedUploadUrl(admin, path);
    await supabase.from("video_projects").update({ video_path: path }).eq("id", project.id);
    revalidate();
    return ok({ id: project.id, path: upload.path, token: upload.token });
  } catch {
    await supabase.from("video_projects").delete().eq("id", project.id);
    return fail("No se pudo preparar la subida del video.");
  }
}

export async function prepareVoiceUploadAction(
  projectId: unknown,
  mimeType: unknown
): Promise<ActionResult<{ path: string; token: string }>> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(projectId);
  const mime = baseMimeType(String(mimeType ?? ""));
  const extension = extensionFor(mime);
  if (!id.success) return fail("Video inválido.");
  if (!mime.startsWith("audio/") || !extension) return fail("Formato de audio no admitido (usá M4A, MP3 o WAV).");

  // Nombre nuevo en cada toma: así nunca se reproduce una versión vieja guardada en caché.
  const path = `${projectFolder(id.data)}/voz-${Date.now()}.${extension}`;
  try {
    const upload = await signedUploadUrl(createAdminClient(), path);
    return ok({ path: upload.path, token: upload.token });
  } catch {
    return fail("No se pudo preparar la subida del audio.");
  }
}

export async function saveVoiceAction(projectId: unknown, path: unknown, offset: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(projectId);
  if (!id.success || typeof path !== "string" || !path.startsWith(`${projectFolder(id.data)}/voz-`)) {
    return fail("Audio inválido.");
  }
  const voiceOffset = Math.min(10, Math.max(0, Math.round((Number(offset) || 0) * 100) / 100));

  const supabase = await createClient();
  const { data: previous } = await supabase.from("video_projects").select("voice_path").eq("id", id.data).maybeSingle();
  const { error } = await supabase
    .from("video_projects")
    .update({ voice_path: path, voice_offset: voiceOffset })
    .eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));
  if (previous?.voice_path && previous.voice_path !== path) {
    await createAdminClient().storage.from(VIDEO_BUCKET).remove([previous.voice_path]);
  }
  revalidate(id.data);
  return ok(null);
}

export async function removeVoiceAction(projectId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(projectId);
  if (!id.success) return fail("Video inválido.");

  const supabase = await createClient();
  const { data: previous } = await supabase.from("video_projects").select("voice_path").eq("id", id.data).maybeSingle();
  await supabase.from("video_projects").update({ voice_path: null, voice_offset: 0 }).eq("id", id.data);
  if (previous?.voice_path) await createAdminClient().storage.from(VIDEO_BUCKET).remove([previous.voice_path]);
  revalidate(id.data);
  return ok(null);
}

export async function saveScriptAction(projectId: unknown, script: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(projectId);
  const parsed = reelScriptSchema.safeParse(script);
  if (!id.success || !parsed.success) return fail("El guion tiene un formato inválido.");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("video_projects")
    .select("video_duration")
    .eq("id", id.data)
    .maybeSingle();
  if (!project) return fail("No se encontró el video.");

  const { error } = await supabase
    .from("video_projects")
    .update({ script: normalizeScript(parsed.data, Number(project.video_duration) || MAX_VIDEO_SECONDS) })
    .eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));
  revalidate(id.data);
  return ok(null);
}

export async function requestReelsAction(projectId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(projectId);
  if (!id.success) return fail("Video inválido.");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("video_projects")
    .select("status, video_path, voice_path, script, files_deleted")
    .eq("id", id.data)
    .maybeSingle();
  if (!project) return fail("No se encontró el video.");
  if (project.files_deleted || !project.video_path) return fail("El video ya no está guardado: subilo de nuevo.");
  if (project.status === "en_cola" || project.status === "procesando") return fail("Ya se está armando.");

  const script = reelScriptSchema.safeParse(project.script);
  const hasHooks = script.success && script.data.ganchos.length > 0;
  if (!hasHooks) return fail("Falta el guion (al menos un gancho) para armar las versiones.");
  if (!project.voice_path && !(script.success && script.data.lineas.length > 0)) {
    return fail("Grabá tu voz o completá las líneas del guion.");
  }

  const { error } = await supabase
    .from("video_projects")
    .update({ status: "en_cola", error: null, attempts: 0, reels: [] })
    .eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));
  revalidate(id.data);
  return ok(null);
}

export async function deleteVideoProjectAction(projectId: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos.");
  const id = uuidSchema.safeParse(projectId);
  if (!id.success) return fail("Video inválido.");

  await deleteProjectFiles(createAdminClient(), id.data);
  const supabase = await createClient();
  const { error } = await supabase.from("video_projects").delete().eq("id", id.data);
  if (error) return fail(safeErrorMessage(error));
  revalidate();
  return ok(null);
}
