import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reelPath } from "@/services/video/storage";

export const dynamic = "force-dynamic";

const reelSchema = z.object({
  name: z.string().regex(/^version-[1-9]$/),
  file: z.string().regex(/^version-[1-9]\.mp4$/),
  gancho: z.string().max(200),
  estilo: z.enum(["elegante", "impacto", "pregunta"]),
  duration: z.number().positive().max(200),
});

const bodySchema = z.discriminatedUnion("ok", [
  z
    .object({
      id: z.string().uuid(),
      ok: z.literal(true),
      reels: z.array(reelSchema).min(1).max(5),
      // Lo que ocupan el video, la voz y las versiones (para el tope de espacio).
      storageBytes: z.number().int().min(0).max(1024 * 1024 * 1024).optional(),
    })
    .passthrough(),
  z.object({ id: z.string().uuid(), ok: z.literal(false), error: z.string().max(300) }),
]);

/** La máquina de GitHub avisa que terminó (bien o mal). */
export async function POST(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("video_projects")
    .select("status, attempts")
    .eq("id", body.id)
    .maybeSingle();
  if (project?.status !== "procesando") {
    return NextResponse.json({ ok: false, error: "El proyecto no está en armado." }, { status: 409 });
  }

  const update = body.ok
    ? {
        status: "listo" as const,
        error: null,
        reels: body.reels.map((reel) => ({ ...reel, path: reelPath(body.id, reel.file) })),
        ...(body.storageBytes !== undefined ? { storage_bytes: body.storageBytes } : {}),
      }
    : { status: "error" as const, error: body.error, attempts: project.attempts + 1 };

  await admin.from("video_projects").update(update).eq("id", body.id).eq("status", "procesando");
  return NextResponse.json({ ok: true });
}
