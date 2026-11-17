import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { productImageUrl } from "@/lib/storage";
import { MAX_AI_IMAGES, toFormSuggestion } from "@/lib/ai/product-suggestion";
import { readAiBudget, recordAiUsage } from "@/services/ai/budget";
import {
  AiNotConfiguredError,
  Anthropic,
  aiConfigured,
  detectProductFromImages,
  type DetectionImage,
} from "@/services/ai/product-detection";

export const dynamic = "force-dynamic";
// La lectura de varias fotos puede tardar: se amplía el límite de la función.
export const maxDuration = 60;

/**
 * Completa la ficha de un producto a partir de sus fotos (IA con visión).
 *
 * Seguridad y costos:
 *  - Solo administradores con sesión.
 *  - La API key vive en el servidor (ANTHROPIC_API_KEY); nunca llega al navegador.
 *  - Tope de gasto mensual (ai_monthly_budget_usd, por defecto US$ 5): al
 *    alcanzarlo, la IA deja de responder hasta el mes siguiente.
 *  - No guarda nada en el producto: devuelve una sugerencia para revisar.
 */

const bodySchema = z
  .object({
    category: z.enum(["reloj", "accesorio"]),
    hint: z.string().max(300).optional(),
    // Fotos recién elegidas (todavía sin producto), ya comprimidas en el navegador…
    images: z
      .array(
        z.object({
          mediaType: z.enum(["image/webp", "image/jpeg", "image/png"]),
          data: z.string().min(100).max(1_400_000),
        })
      )
      .max(MAX_AI_IMAGES)
      .optional(),
    // …o un producto existente: se usan las fotos que ya tiene cargadas.
    productId: z.string().uuid().optional(),
  })
  .refine((b) => (b.images?.length ?? 0) > 0 || b.productId, {
    message: "Faltan las fotos.",
  });

function json(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const ctx = await requireAdminAction();
  if (!ctx) return json(401, "No tiene permisos.");

  if (!aiConfigured()) {
    return json(
      503,
      "La carga con IA todavía no está activada (falta la clave de la API). Ver BLOQUEOS.md."
    );
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return json(400, "Datos inválidos: revisá las fotos e intentá de nuevo.");
    parsedBody = parsed.data;
  } catch {
    return json(400, "No se pudo leer el pedido (¿fotos demasiado pesadas?).");
  }

  // Fotos a analizar.
  let images: DetectionImage[];
  if (parsedBody.images && parsedBody.images.length > 0) {
    images = parsedBody.images.map((img) => ({
      kind: "base64",
      mediaType: img.mediaType,
      data: img.data,
    }));
  } else {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", parsedBody.productId!)
      .order("is_cover", { ascending: false })
      .order("sort_order")
      .limit(MAX_AI_IMAGES);
    images = (rows ?? [])
      .map((row) => productImageUrl(row.storage_path))
      .filter((url): url is string => url !== null && url.startsWith("https://"))
      .map((url) => ({ kind: "url", url }));
    if (images.length === 0) {
      return json(400, "Este producto todavía no tiene fotos. Subí al menos una.");
    }
  }

  // Tope de gasto mensual.
  const admin = createAdminClient();
  const { usage, budget, exceeded } = await readAiBudget(admin);
  if (exceeded) {
    return json(
      429,
      `Se alcanzó el tope de gasto de IA de este mes (US$ ${budget}). Vuelve a funcionar el mes que viene. Mientras tanto, la ficha se carga a mano.`
    );
  }

  try {
    const result = await detectProductFromImages({
      images,
      category: parsedBody.category,
      hint: parsedBody.hint ?? null,
    });

    const nextUsage = await recordAiUsage(admin, usage, result.costUsd, ctx.userId);

    return NextResponse.json({
      ok: true,
      suggestion: toFormSuggestion(result.suggestion, parsedBody.category),
      detectedType: result.suggestion.product_type,
      costUsd: result.costUsd,
      monthUsd: nextUsage.usd,
      budgetUsd: budget,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return json(503, "La carga con IA todavía no está activada.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return json(503, "La clave de la API de IA no es válida. Revisala en la configuración.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json(429, "La IA está ocupada. Probá de nuevo en un minuto.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      return json(400, "La IA no pudo leer las fotos. Probá con otras (JPG, PNG o WebP).");
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[ia] error de la API", { status: error.status });
      return json(502, "La IA no respondió. Podés completar la ficha a mano o reintentar.");
    }
    console.error("[ia] error inesperado");
    return json(500, "No se pudo completar la ficha con IA. Podés cargarla a mano.");
  }
}
