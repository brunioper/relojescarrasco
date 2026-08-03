import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  // Rutas permitidas dentro del bucket privado.
  path: z
    .string()
    .min(3)
    .max(500)
    .regex(/^(purchases|costs|expenses|internal)\/[\w\-./]+$/, "Ruta inválida."),
});

/**
 * Acceso a documentos privados (facturas, recibos) SOLO para administradores,
 * mediante URL firmada de corta vida (60 segundos).
 *
 * El cliente service-role se usa únicamente DESPUÉS de verificar la
 * autorización del administrador — nunca como sustituto de RLS.
 * Jamás se generan URLs públicas permanentes de este bucket.
 */
export async function GET(request: Request) {
  const ctx = await requireAdminAction();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ path: url.searchParams.get("path") });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ruta inválida." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("private-documents")
    .createSignedUrl(parsed.data.path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: "El documento no existe." }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
