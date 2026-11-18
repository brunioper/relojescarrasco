import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reelPath, signedUploadUrl } from "@/services/video/storage";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().uuid(),
  files: z.array(z.string().regex(/^version-[1-9]\.mp4$/)).min(1).max(5),
});

/** URLs firmadas para subir las versiones de un proyecto en armado. */
export async function POST(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("video_projects")
    .select("status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (project?.status !== "procesando") {
    return NextResponse.json({ ok: false, error: "El proyecto no está en armado." }, { status: 409 });
  }

  const urls: Record<string, string> = {};
  for (const file of parsed.data.files) {
    urls[file] = (await signedUploadUrl(admin, reelPath(parsed.data.id, file))).signedUrl;
  }
  return NextResponse.json({ ok: true, urls });
}
