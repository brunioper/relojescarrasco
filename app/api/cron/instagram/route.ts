import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { runInstagramSync } from "@/services/instagram-sync/sync";

export const dynamic = "force-dynamic";
// La IA puede tardar unos segundos por historia.
export const maxDuration = 60;

/**
 * Revisión automática de Instagram. La llama el workflow
 * .github/workflows/instagram.yml cada 15 minutos con
 * "Authorization: Bearer <CRON_SECRET>".
 */
async function handle(request: Request) {
  const auth = checkCronAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

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
