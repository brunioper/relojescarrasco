import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { runInstagramSync } from "@/services/instagram-sync/sync";

export const dynamic = "force-dynamic";
// La IA puede tardar unos segundos por historia.
export const maxDuration = 60;

/**
 * Revisión automática de Instagram. La llama el workflow
 * .github/workflows/instagram.yml cada 15 minutos con
 * "Authorization: Bearer <CRON_SECRET>".
 */

const digest = (value: string) => createHash("sha256").update(value).digest();

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

async function handle(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || secret.length < 24) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado." }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const summary = await runInstagramSync();
    return NextResponse.json(summary, { status: summary.ok ? 200 : 409 });
  } catch {
    console.error("[instagram] la revisión falló");
    return NextResponse.json({ ok: false, error: "La revisión falló." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
