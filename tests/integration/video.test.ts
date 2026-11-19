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
 * Etapa 9 contra la base real: los proyectos de video los ve el personal y
 * los maneja solo un administrador; el bucket de videos es privado.
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
  if (!available) throw new Error("Supabase local no disponible o sin datos de prueba. Ejecutar: supabase start");
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

describe("proyectos de video", () => {
  it("un administrador los crea, edita y borra; el personal los ve; el público no", async () => {
    const { data: project, error } = await admin
      .from("video_projects")
      .insert({ title: "Reel de prueba", video_duration: 12.5, created_by: adminId })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(project?.status).toBe("borrador");

    const { data: asViewer } = await viewer.from("video_projects").select("id").eq("id", project!.id);
    expect(asViewer).toHaveLength(1);
    const { data: asAnon } = await anon.from("video_projects").select("id").eq("id", project!.id);
    expect(asAnon ?? []).toHaveLength(0);

    const { data: viewerUpdate } = await viewer
      .from("video_projects")
      .update({ status: "en_cola" })
      .eq("id", project!.id)
      .select("id");
    expect(viewerUpdate ?? []).toHaveLength(0);

    const { error: viewerInsert } = await viewer.from("video_projects").insert({ title: "Intruso" });
    expect(viewerInsert).not.toBeNull();

    const { error: updateError } = await admin
      .from("video_projects")
      .update({ status: "en_cola", script: { ganchos: ["Hola"] } })
      .eq("id", project!.id);
    expect(updateError).toBeNull();

    const { error: deleteError } = await admin.from("video_projects").delete().eq("id", project!.id);
    expect(deleteError).toBeNull();
  });

  it("rechaza estados desconocidos y desfases de voz imposibles", async () => {
    const { error: badStatus } = await service
      .from("video_projects")
      .insert({ title: "x", status: "inventado" as never });
    expect(badStatus).not.toBeNull();
    const { error: badOffset } = await service.from("video_projects").insert({ title: "x", voice_offset: 30 });
    expect(badOffset).not.toBeNull();
    const { error: badSize } = await service.from("video_projects").insert({ title: "x", storage_bytes: -1 });
    expect(badSize).not.toBeNull();
  });
});

describe("bucket de videos", () => {
  it("es privado: solo se accede con una URL firmada", async () => {
    const path = `proyectos/prueba-${Date.now()}/video.mp4`;
    const { data: signed, error } = await service.storage.from("videos").createSignedUploadUrl(path);
    expect(error).toBeNull();

    const upload = await anon.storage
      .from("videos")
      .uploadToSignedUrl(path, signed!.token, new Blob([new Uint8Array([0, 0, 0, 24])], { type: "video/mp4" }), {
        contentType: "video/mp4",
      });
    expect(upload.error).toBeNull();

    const { data: publicDownload } = await anon.storage.from("videos").download(path);
    expect(publicDownload).toBeNull();
    const { data: adminDownload } = await admin.storage.from("videos").download(path);
    expect(adminDownload).toBeNull();

    const { data: url } = await service.storage.from("videos").createSignedUrl(path, 60);
    const response = await fetch(url!.signedUrl);
    expect(response.ok).toBe(true);

    await service.storage.from("videos").remove([path]);
  });
});
