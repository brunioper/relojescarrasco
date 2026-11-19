import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/auth/session";
import { runInstagramSync } from "@/services/instagram-sync/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Botón "Revisar ahora" del panel: misma revisión que la automática. */
export async function POST() {
  const ctx = await requireAdminAction();
  if (!ctx) return NextResponse.json({ ok: false, message: "No tiene permisos." }, { status: 401 });

  try {
    const summary = await runInstagramSync({ actorId: ctx.userId });
    return NextResponse.json(summary);
  } catch {
    console.error("[instagram] la revisión manual falló");
    return NextResponse.json({ ok: false, message: "La revisión falló. Probá de nuevo en unos minutos." }, { status: 500 });
  }
}
