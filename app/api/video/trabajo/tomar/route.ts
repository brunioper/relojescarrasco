import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatUsd } from "@/lib/formatting/currency";
import { signedDownloadUrl } from "@/services/video/storage";

export const dynamic = "force-dynamic";

/** Toma el proyecto más viejo en cola y entrega lo necesario para armarlo. */
export async function POST(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("video_projects")
    .select("id")
    .eq("status", "en_cola")
    .order("created_at", { ascending: true })
    .limit(3);

  for (const candidate of candidates ?? []) {
    // Toma atómica: solo una máquina se queda con cada proyecto.
    const { data: job } = await admin
      .from("video_projects")
      .update({ status: "procesando", processing_at: new Date().toISOString(), error: null })
      .eq("id", candidate.id)
      .eq("status", "en_cola")
      .select("id, title, video_path, voice_path, voice_offset, script, product_id")
      .maybeSingle();
    if (!job) continue;

    if (!job.video_path) {
      await admin.from("video_projects").update({ status: "error", error: "Falta el video." }).eq("id", job.id);
      continue;
    }

    let product = null;
    if (job.product_id) {
      const { data } = await admin
        .from("products")
        .select("brand, model, reference_number, listing_price_usd, is_published")
        .eq("id", job.product_id)
        .maybeSingle();
      if (data) {
        product = {
          brand: data.brand,
          model: data.model,
          reference: data.reference_number,
          // El precio solo aparece si el producto está publicado con precio.
          price: data.is_published && data.listing_price_usd !== null ? formatUsd(data.listing_price_usd) : "",
        };
      }
    }

    return NextResponse.json({
      id: job.id,
      title: job.title,
      videoUrl: await signedDownloadUrl(admin, job.video_path, { seconds: 2 * 3600 }),
      voiceUrl: job.voice_path ? await signedDownloadUrl(admin, job.voice_path, { seconds: 2 * 3600 }) : null,
      voiceOffset: Number(job.voice_offset) || 0,
      script: job.script,
      product,
    });
  }

  return new NextResponse(null, { status: 204 });
}
