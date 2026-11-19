import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_VIDEO_SECONDS } from "@/lib/video/script";
import { readAiBudget, recordAiUsage } from "@/services/ai/budget";
import { AiNotConfiguredError, Anthropic, aiConfigured } from "@/services/ai/product-detection";
import { writeReelScript, type ReelScriptProduct } from "@/services/ai/reel-script";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Guion de un reel: la IA mira cuadros del video (sacados en el navegador)
 * y escribe lo que el dueño va a decir con su voz.
 */

const bodySchema = z.object({
  projectId: z.string().uuid(),
  duration: z.number().positive().max(MAX_VIDEO_SECONDS + 1),
  frames: z
    .array(
      z.object({
        time: z.number().min(0).max(MAX_VIDEO_SECONDS + 1),
        mediaType: z.enum(["image/webp", "image/jpeg", "image/png"]),
        data: z.string().min(100).max(600_000),
      })
    )
    .min(1)
    .max(8),
});

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const ctx = await requireAdminAction();
  if (!ctx) return fail(401, "No tiene permisos.");
  if (!aiConfigured()) {
    return fail(503, "Falta activar la IA (BLOQUEOS, punto 4). Podés escribir el guion a mano.");
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "No se pudieron leer los cuadros del video.");
  const { projectId, duration, frames } = parsed.data;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("video_projects")
    .select("id, product_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return fail(404, "No se encontró el video.");

  let product: ReelScriptProduct | null = null;
  if (project.product_id) {
    const { data } = await admin
      .from("products")
      .select(
        "name, brand, model, reference_number, year_approx, condition, includes_box, includes_documentation, listing_price_usd, is_published"
      )
      .eq("id", project.product_id)
      .maybeSingle();
    if (data) {
      product = {
        ...data,
        // Solo se menciona el precio de un producto publicado.
        price_usd: data.is_published ? data.listing_price_usd : null,
      };
    }
  }

  const { usage, budget, exceeded } = await readAiBudget(admin);
  if (exceeded) {
    return fail(429, `Se alcanzó el tope de IA de este mes (US$ ${budget}). Podés subirlo en Configuración o escribir el guion a mano.`);
  }

  try {
    const result = await writeReelScript({ frames, durationSec: duration, product });
    const next = await recordAiUsage(admin, usage, result.costUsd, ctx.userId);
    await admin.from("video_projects").update({ script: result.script }).eq("id", projectId);
    return NextResponse.json({ ok: true, script: result.script, costUsd: result.costUsd, monthUsd: next.usd });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail(503, "Falta activar la IA.");
    if (error instanceof Anthropic.RateLimitError) return fail(429, "La IA está ocupada. Probá en un minuto.");
    if (error instanceof Anthropic.APIError) return fail(502, "La IA no respondió. Probá de nuevo.");
    console.error("[video] no se pudo escribir el guion");
    return fail(500, "No se pudo escribir el guion. Probá de nuevo.");
  }
}
