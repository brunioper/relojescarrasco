import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ANON_KEY,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
  VIEWER_EMAIL,
  VIEWER_PASSWORD,
  supabaseAvailable,
} from "./setup";

/**
 * Etapa 6 contra la base real: la conexión con Instagram es invisible para
 * todos menos el servidor, la bandeja la ve el personal y la resuelve solo un
 * administrador, cada historia se procesa una sola vez, y la publicación
 * automática solo la puede ejecutar el servidor.
 */

let available = false;
let service: SupabaseClient<Database>;
let admin: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;
let anon: SupabaseClient<Database>;
let adminId = "";

const client = (key: string) =>
  createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

beforeEach(() => {
  if (!available) {
    throw new Error("Supabase local no disponible o sin datos de prueba. Ejecutar: supabase start");
  }
});

beforeAll(async () => {
  available = await supabaseAvailable();
  if (!available) return;
  service = client(SERVICE_ROLE_KEY);
  admin = client(ANON_KEY);
  viewer = client(ANON_KEY);
  anon = client(ANON_KEY);
  const { data } = await admin.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const { data: viewerData } = await viewer.auth.signInWithPassword({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD });
  if (!data.user || !viewerData.user) available = false;
  adminId = data.user?.id ?? "";
});

const unique = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function insertImport(overrides: Partial<Database["public"]["Tables"]["instagram_imports"]["Insert"]> = {}) {
  const { data, error } = await service
    .from("instagram_imports")
    .insert({
      media_id: `ig-${unique()}`,
      source: "historia",
      media_type: "IMAGE",
      posted_at: new Date().toISOString(),
      status: "pendiente",
      reason: "Prueba de integración",
      ...overrides,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

describe("conexión con Instagram", () => {
  it("nadie más que el servidor puede leer o escribir el token", async () => {
    const { error } = await service.from("instagram_connection").upsert({
      id: 1,
      ig_user_id: "17840000000000000",
      username: "relojes_carrasco",
      token_ciphertext: "v1.prueba.prueba.prueba",
    });
    expect(error).toBeNull();

    for (const user of [anon, viewer, admin]) {
      const { data } = await user.from("instagram_connection").select("*");
      expect(data ?? []).toHaveLength(0);
    }

    const { error: writeError } = await admin
      .from("instagram_connection")
      .upsert({ id: 1, ig_user_id: "x", username: "intruso", token_ciphertext: "x" });
    expect(writeError).not.toBeNull();

    await service.from("instagram_connection").delete().eq("id", 1);
  });
});

describe("bandeja de Instagram", () => {
  it("el personal la ve; el público no", async () => {
    const row = await insertImport();
    const { data: asViewer } = await viewer.from("instagram_imports").select("id").eq("id", row.id);
    expect(asViewer).toHaveLength(1);
    const { data: asAnon } = await anon.from("instagram_imports").select("id").eq("id", row.id);
    expect(asAnon ?? []).toHaveLength(0);
  });

  it("solo un administrador la resuelve, y nadie crea filas desde el navegador", async () => {
    const row = await insertImport();

    const { data: viewerUpdate } = await viewer
      .from("instagram_imports")
      .update({ status: "descartado" })
      .eq("id", row.id)
      .select("id");
    expect(viewerUpdate ?? []).toHaveLength(0);

    const { data: adminUpdate, error } = await admin
      .from("instagram_imports")
      .update({ status: "descartado", reviewed_by: adminId })
      .eq("id", row.id)
      .select("status")
      .single();
    expect(error).toBeNull();
    expect(adminUpdate?.status).toBe("descartado");

    const { error: insertError } = await admin.from("instagram_imports").insert({
      media_id: `ig-${unique()}`,
      source: "historia",
      media_type: "IMAGE",
      posted_at: new Date().toISOString(),
    });
    expect(insertError).not.toBeNull();
  });

  it("cada historia se toma una sola vez", async () => {
    const mediaId = `ig-${unique()}`;
    await insertImport({ media_id: mediaId, status: "procesando" });
    const { data, error } = await service
      .from("instagram_imports")
      .insert({ media_id: mediaId, source: "historia", media_type: "IMAGE", posted_at: new Date().toISOString() })
      .select("id")
      .maybeSingle();
    expect(data).toBeNull();
    expect(error?.code).toBe("23505");
  });

  it("rechaza estados desconocidos", async () => {
    await expect(insertImport({ status: "inventado" as never })).rejects.toBeTruthy();
  });
});

describe("publicación automática con precio", () => {
  async function createWatch() {
    const { data, error } = await service
      .from("products")
      .insert({
        name: `Reloj Instagram ${unique()}`,
        brand: "TestIG",
        model: "Prueba",
        slug: `reloj-instagram-${unique()}`,
        category: "reloj",
        status: "disponible",
        created_by: adminId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  it("desde el navegador no se puede ejecutar, ni siendo administrador", async () => {
    const productId = await createWatch();
    const { error } = await admin.rpc("instagram_publish_with_price", {
      p_product_id: productId,
      p_amount_usd: 1200,
      p_actor: adminId,
    });
    expect(error).not.toBeNull();
  });

  it("el servidor fija el precio en dólares, publica y deja el historial con el autor", async () => {
    const productId = await createWatch();
    const { error } = await service.rpc("instagram_publish_with_price", {
      p_product_id: productId,
      p_amount_usd: 1200,
      p_actor: adminId,
    });
    expect(error).toBeNull();

    const { data: product } = await service
      .from("products")
      .select("listing_price_usd, listing_price_uyu, is_published, status")
      .eq("id", productId)
      .single();
    expect(product).toMatchObject({ listing_price_usd: 1200, is_published: true, status: "disponible" });
    expect(Number(product?.listing_price_uyu)).toBeGreaterThan(1200);

    const { data: history } = await service
      .from("product_price_history")
      .select("new_amount_usd, changed_by")
      .eq("product_id", productId);
    expect(history).toEqual([{ new_amount_usd: 1200, changed_by: adminId }]);

    const { data: publicRow } = await anon
      .from("public_catalogue_products")
      .select("id, price_usd")
      .eq("id", productId)
      .maybeSingle();
    expect(publicRow?.price_usd).toBe(1200);
  });

  it("no publica precios inválidos ni productos en reparación", async () => {
    const productId = await createWatch();
    const { error: invalid } = await service.rpc("instagram_publish_with_price", {
      p_product_id: productId,
      p_amount_usd: 0,
      p_actor: adminId,
    });
    expect(invalid).not.toBeNull();

    await service.from("products").update({ status: "en_reparacion" }).eq("id", productId);
    const { error: notPublishable } = await service.rpc("instagram_publish_with_price", {
      p_product_id: productId,
      p_amount_usd: 900,
      p_actor: adminId,
    });
    expect(notPublishable).not.toBeNull();
  });
});
