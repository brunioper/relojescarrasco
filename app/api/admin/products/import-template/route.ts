import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/auth/session";
import { buildProductImportTemplate } from "@/services/products/import-template";

export const dynamic = "force-dynamic";

/** Descarga la plantilla .xlsx para la importación en lote de productos. */
export async function GET() {
  const ctx = await requireAdminAction();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const buffer = await buildProductImportTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_relojes.xlsx"',
    },
  });
}
