import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { KEEP_FILES_DAYS } from "@/lib/video/script";
import { releaseProjectFiles } from "@/services/video/storage";

export const dynamic = "force-dynamic";

/** Un armado que se cortó sin avisar vuelve a la cola (hasta 3 intentos). */
const STALE_MS = 45 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const KEEP_FILES_MS = KEEP_FILES_DAYS * 24 * 60 * 60 * 1000;

/**
 * ¿Hay videos en cola? Lo consulta .github/workflows/video.yml cada 5 minutos
 * antes de preparar la máquina. Aprovecha para reencolar armados colgados y
 * borrar archivos viejos.
 */
export async function POST(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const now = Date.now();

  const { data: stale } = await admin
    .from("video_projects")
    .select("id, attempts")
    .eq("status", "procesando")
    .lt("processing_at", new Date(now - STALE_MS).toISOString());
  for (const row of stale ?? []) {
    await admin
      .from("video_projects")
      .update(
        row.attempts + 1 >= MAX_ATTEMPTS
          ? { status: "error", error: "El armado se cortó varias veces. Probá con un video más corto.", attempts: row.attempts + 1 }
          : { status: "en_cola", attempts: row.attempts + 1 }
      )
      .eq("id", row.id)
      .eq("status", "procesando");
  }

  const { data: old } = await admin
    .from("video_projects")
    .select("id")
    .eq("files_deleted", false)
    .in("status", ["listo", "error", "borrador"])
    .lt("updated_at", new Date(now - KEEP_FILES_MS).toISOString())
    .limit(10);
  for (const row of old ?? []) await releaseProjectFiles(admin, row.id);

  const { count, error } = await admin
    .from("video_projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "en_cola");
  if (error) return NextResponse.json({ ok: false, error: "Falta aplicar la actualización de la base." }, { status: 409 });
  return NextResponse.json({ ok: true, pendientes: count ?? 0 });
}
