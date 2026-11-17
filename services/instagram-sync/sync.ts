import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, InstagramImport, Json } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { productImageUrl } from "@/lib/storage";
import { siteUrl } from "@/lib/site";
import { listingCategory, productInputFromListing, type ListingDetection } from "@/lib/ai/listing";
import { findCatalogMatches, type CatalogCandidate } from "@/lib/instagram/duplicates";
import { decideImport, usablePriceUsd } from "@/lib/instagram/decide";
import {
  MAX_IMAGES_PER_ITEM,
  imageExtension,
  imageUrlOf,
  selectNewMedia,
  type SourcedMedia,
} from "@/lib/instagram/media";
import { downloadImage } from "@/services/instagram";
import { readAiBudget, recordAiUsage } from "@/services/ai/budget";
import { Anthropic, aiConfigured } from "@/services/ai/product-detection";
import { detectListingFromImages } from "@/services/ai/listing-detection";
import { sendInstagramDigestEmail } from "@/services/email";
import {
  InstagramApiError,
  listChildren,
  listRecentMedia,
  listStories,
} from "@/services/instagram-sync/graph";
import {
  InstagramNotSetUpError,
  loadConnection,
  recordCheck,
  refreshTokenIfDue,
} from "@/services/instagram-sync/connection";
import { createProductFromImport, publishWithPrice } from "@/services/instagram-sync/products";

/**
 * Una revisión de Instagram (la corre /api/cron/instagram cada 15 minutos
 * y el botón "Revisar ahora" del panel):
 *
 *   1. Lee las historias activas y las últimas publicaciones.
 *   2. Toma las nuevas (publicadas desde que se conectó la cuenta) y copia
 *      sus fotos enseguida: las URLs de Instagram vencen y las historias
 *      desaparecen a las 24 horas.
 *   3. La IA mira las fotos y se decide: crear (y publicar si se lee el
 *      precio), pedir aprobación si se parece a algo del catálogo, o
 *      descartar si no es un producto a la venta.
 *
 * Pocas piezas por revisión para entrar en el límite de tiempo de la
 * función; lo que quede se procesa en la siguiente.
 */

const NEW_PER_RUN = 3;
const RETRIES_PER_RUN = 2;
const MAX_ATTEMPTS = 3;
/** Fotos que mira la IA por pieza (menos que el máximo, para cuidar el costo). */
const AI_IMAGES = 4;
const STALE_PROCESSING_MS = 15 * 60 * 1000;
/** Después de esto no se empieza otra lectura de IA: la función tiene 60 segundos en total. */
const AI_TIME_BUDGET_MS = 35_000;

type Outcome = "publicados" | "borradores" | "pendientes" | "descartados" | "sinIa" | "errores";

export type SyncSummary = {
  ok: boolean;
  message: string;
  nuevas: number;
} & Record<Outcome, number>;

const emptySummary = (): SyncSummary => ({
  ok: true,
  message: "",
  nuevas: 0,
  publicados: 0,
  borradores: 0,
  pendientes: 0,
  descartados: 0,
  sinIa: 0,
  errores: 0,
});

type ImportUpdate = Database["public"]["Tables"]["instagram_imports"]["Update"];

async function finish(admin: SupabaseClient<Database>, id: string, fields: ImportUpdate): Promise<void> {
  await admin.from("instagram_imports").update(fields).eq("id", id);
}

function safeMediaId(id: string): string {
  return id.replace(/[^0-9A-Za-z_-]/g, "");
}

/** Copia las fotos de una pieza al bucket (instagram/<id>/<n>.jpg). */
async function storeImages(
  admin: SupabaseClient<Database>,
  token: string,
  item: SourcedMedia
): Promise<string[]> {
  let sources: string[] = [];
  if (item.media_type === "CAROUSEL_ALBUM") {
    try {
      const children = await listChildren(token, item.id);
      sources = children.map(imageUrlOf).filter((url): url is string => url !== null);
    } catch {
      sources = [];
    }
  } else {
    const url = imageUrlOf(item);
    if (url) sources = [url];
  }

  const paths: string[] = [];
  for (const [index, url] of sources.slice(0, MAX_IMAGES_PER_ITEM).entries()) {
    const download = await downloadImage(url);
    if (!download.ok) continue;
    const path = `instagram/${safeMediaId(item.id)}/${index}.${imageExtension(download.contentType)}`;
    const { error } = await admin.storage
      .from("product-images")
      .upload(path, download.data, { contentType: download.contentType, upsert: true });
    if (!error) paths.push(path);
  }
  return paths;
}

async function loadCandidates(admin: SupabaseClient<Database>): Promise<CatalogCandidate[]> {
  const { data } = await admin
    .from("products")
    .select("id, name, brand, model, reference_number, category, status")
    .is("deleted_at", null);
  return (data ?? []) as CatalogCandidate[];
}

/** Piezas para reintentar (sin IA, error transitorio o una revisión que se cortó). */
async function claimRetries(admin: SupabaseClient<Database>, limit: number): Promise<InstagramImport[]> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data } = await admin
    .from("instagram_imports")
    .select("*")
    .or(
      `status.eq.sin_ia,and(status.eq.error,attempts.lt.${MAX_ATTEMPTS}),and(status.eq.procesando,updated_at.lt.${staleBefore})`
    )
    .order("posted_at", { ascending: true })
    .limit(limit * 2);

  const claimed: InstagramImport[] = [];
  for (const row of data ?? []) {
    if (claimed.length >= limit) break;
    if (row.image_paths.length === 0) {
      await finish(admin, row.id, {
        status: "error",
        reason: "No se llegó a guardar la imagen y la historia ya no está disponible.",
        attempts: MAX_ATTEMPTS,
      });
      continue;
    }
    // Toma atómica: si otra revisión ya la agarró, no coincide el estado anterior.
    const { data: taken } = await admin
      .from("instagram_imports")
      .update({ status: "procesando" })
      .eq("id", row.id)
      .eq("status", row.status)
      .eq("updated_at", row.updated_at)
      .select("*")
      .maybeSingle();
    if (taken) claimed.push(taken);
  }
  return claimed;
}

async function applyDecision(
  admin: SupabaseClient<Database>,
  row: InstagramImport,
  listing: ListingDetection,
  candidates: CatalogCandidate[],
  autoPublish: boolean,
  actorId: string | null
): Promise<Outcome> {
  const category = listingCategory(listing);
  const input = category ? productInputFromListing(listing, category) : null;
  const matches =
    category && input
      ? findCatalogMatches(
          { category, brand: input.brand, model: input.model || null, reference_number: input.reference_number },
          candidates
        )
      : [];
  const decision = decideImport({
    signals: { ...listing, brand: input?.brand ?? null },
    matches,
    autoPublish,
  });

  const base: ImportUpdate = {
    ai_result: listing as unknown as Json,
    detected_price_usd: usablePriceUsd(listing.visible_price),
  };

  if (decision.action === "descartar") {
    await finish(admin, row.id, { ...base, status: "descartado", reason: decision.reason });
    return "descartados";
  }
  if (decision.action === "pendiente" || !input || !category) {
    await finish(admin, row.id, {
      ...base,
      status: "pendiente",
      reason: decision.reason,
      matched_product_ids: decision.action === "pendiente" ? decision.matches : [],
    });
    return "pendientes";
  }

  const productId = await createProductFromImport(admin, {
    data: input,
    status: decision.status,
    imagePaths: row.image_paths,
    permalink: row.permalink,
    actorId,
  });
  // Otra pieza de esta misma revisión con el mismo reloj ya lo encuentra.
  candidates.push({
    id: productId,
    name: input.name,
    brand: input.brand,
    model: input.model,
    reference_number: input.reference_number,
    category,
    status: decision.status,
  });

  if (decision.publishPriceUsd !== null) {
    const published = await publishWithPrice(admin, productId, decision.publishPriceUsd, actorId);
    if (published.ok) {
      await finish(admin, row.id, { ...base, status: "publicado", reason: decision.reason, product_id: productId });
      return "publicados";
    }
    await finish(admin, row.id, { ...base, status: "borrador", reason: published.reason, product_id: productId });
    return "borradores";
  }
  await finish(admin, row.id, { ...base, status: "borrador", reason: decision.reason, product_id: productId });
  return "borradores";
}

function describe(summary: SyncSummary): string {
  const parts = [
    summary.publicados > 0 ? `${summary.publicados} publicado(s)` : null,
    summary.borradores > 0 ? `${summary.borradores} sin publicar` : null,
    summary.pendientes > 0 ? `${summary.pendientes} para aprobar` : null,
    summary.descartados > 0 ? `${summary.descartados} descartado(s)` : null,
    summary.sinIa > 0 ? `${summary.sinIa} esperando la IA` : null,
    summary.errores > 0 ? `${summary.errores} con error` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Nada nuevo en Instagram.";
}

export async function runInstagramSync(options: { actorId?: string | null } = {}): Promise<SyncSummary> {
  const aiDeadline = Date.now() + AI_TIME_BUDGET_MS;
  const admin = createAdminClient();
  const summary = emptySummary();

  let connection: Awaited<ReturnType<typeof loadConnection>>;
  try {
    connection = await loadConnection(admin);
  } catch (error) {
    if (error instanceof InstagramNotSetUpError) return { ...summary, ok: false, message: error.message };
    throw error;
  }
  if (!connection) return { ...summary, ok: false, message: "Instagram no está conectado." };
  if (!connection.token) {
    const message = "No se puede leer el token guardado: volvé a conectar Instagram.";
    await recordCheck(admin, message);
    return { ...summary, ok: false, message };
  }

  let token = connection.token;
  try {
    token = await refreshTokenIfDue(admin, connection);
  } catch {
    // Se sigue con el token actual; si venció, la lectura de abajo lo informa.
  }

  // 1. Lo publicado en Instagram.
  let media: SourcedMedia[];
  try {
    const [stories, posts] = await Promise.all([
      listStories(token, connection.ig_user_id),
      listRecentMedia(token, connection.ig_user_id),
    ]);
    media = [
      ...stories.map((item) => ({ ...item, source: "historia" as const })),
      ...posts.map((item) => ({ ...item, source: "publicacion" as const })),
    ];
  } catch (error) {
    const message =
      error instanceof InstagramApiError && error.isAuthError
        ? "Instagram rechazó el token: volvé a conectar la cuenta."
        : "No se pudo leer Instagram: se reintenta en la próxima revisión.";
    await recordCheck(admin, message);
    return { ...summary, ok: false, message };
  }

  // 2. Lo nuevo: se reserva (una sola revisión lo procesa) y se copian las fotos.
  const ids = media.map((item) => item.id);
  const { data: known } =
    ids.length > 0
      ? await admin.from("instagram_imports").select("media_id").in("media_id", ids)
      : { data: [] as { media_id: string }[] };
  const fresh = selectNewMedia(media, {
    watchSince: new Date(connection.watch_since),
    knownIds: new Set((known ?? []).map((row) => row.media_id)),
    max: NEW_PER_RUN,
  });

  const queue: InstagramImport[] = [];
  for (const item of fresh) {
    const { data: row } = await admin
      .from("instagram_imports")
      .insert({
        media_id: item.id,
        source: item.source,
        media_type: item.media_type,
        permalink: item.permalink ?? null,
        posted_at: item.timestamp!,
        status: "procesando",
      })
      .select("*")
      .maybeSingle();
    if (!row) continue; // la tomó otra revisión
    summary.nuevas++;

    const paths = await storeImages(admin, token, item);
    if (paths.length === 0) {
      await finish(admin, row.id, {
        status: "error",
        reason: "No se pudo descargar la imagen de Instagram.",
        attempts: MAX_ATTEMPTS,
      });
      summary.errores++;
      continue;
    }
    await finish(admin, row.id, { image_paths: paths });
    queue.push({ ...row, image_paths: paths });
  }
  queue.push(...(await claimRetries(admin, RETRIES_PER_RUN)));

  // 3. IA y decisión.
  if (queue.length > 0) {
    const candidates = await loadCandidates(admin);
    const actorId = connection.connected_by ?? options.actorId ?? null;
    let budget = await readAiBudget(admin);

    for (const row of queue) {
      if (Date.now() > aiDeadline) {
        // Las fotos ya están guardadas: la próxima revisión la retoma.
        await finish(admin, row.id, { status: "sin_ia", reason: "Queda para la próxima revisión." });
        summary.sinIa++;
        continue;
      }
      if (!aiConfigured() || budget.exceeded) {
        await finish(admin, row.id, {
          status: "sin_ia",
          reason: !aiConfigured()
            ? "Falta activar la IA (BLOQUEOS, punto 4). Se procesa sola cuando esté."
            : "Se alcanzó el tope mensual de IA. Se procesa cuando se renueve el mes.",
        });
        summary.sinIa++;
        continue;
      }
      try {
        const imageUrls = row.image_paths
          .slice(0, AI_IMAGES)
          .map((path) => productImageUrl(path))
          .filter((url): url is string => url !== null);
        const { listing, costUsd } = await detectListingFromImages({ imageUrls, source: row.source });
        const usage = await recordAiUsage(admin, budget.usage, costUsd, actorId);
        budget = { ...budget, usage, exceeded: usage.usd >= budget.budget };
        summary[await applyDecision(admin, row, listing, candidates, connection.auto_publish, actorId)]++;
      } catch (error) {
        await finish(admin, row.id, {
          status: "error",
          reason:
            error instanceof Anthropic.APIError
              ? "La IA no respondió: se reintenta en la próxima revisión."
              : "No se pudo procesar: se reintenta en la próxima revisión.",
          attempts: row.attempts + 1,
        });
        summary.errores++;
      }
    }
  }

  await recordCheck(admin, null);

  if (summary.publicados > 0) {
    revalidatePath("/catalogo");
    revalidatePath("/", "layout");
  }
  if (summary.publicados + summary.borradores + summary.pendientes > 0) {
    await sendInstagramDigestEmail({
      publicados: summary.publicados,
      borradores: summary.borradores,
      pendientes: summary.pendientes,
      adminUrl: `${siteUrl()}/admin/instagram`,
    });
  }
  return { ...summary, message: describe(summary) };
}
