import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Estudio de reels (Etapa 9): un video con guion se manda a armar.
 * El proyecto se crea directo en la base (en CI no hay IA ni GitHub Actions).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill("admin@relojescarrasco.test");
  await page.getByLabel("Contraseña").fill("Admin1234!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/admin\//, { timeout: 20000 });
}

test("un video con guion se manda a armar las 3 versiones", async ({ page }) => {
  const title = `Reel E2E ${Date.now()}`;
  const { data: project, error } = await service
    .from("video_projects")
    .insert({
      title,
      video_duration: 12,
      video_path: `proyectos/e2e-${Date.now()}/video.mp4`,
      script: {
        ganchos: ["¿Buscás un Datejust?", "Esfera azul", "¿Lo querés ver?"],
        lineas: [
          { desde: 0, hasta: 2.5, texto: "¿Buscás un Datejust?" },
          { desde: 3, hasta: 7, texto: "Esfera azul y brazalete Jubilee." },
          { desde: 8, hasta: 12, texto: "Escribinos por mensaje directo." },
        ],
        texto_posteo: "Rolex Datejust 41.",
        hashtags: ["rolex"],
        notas: "Hablá despacio.",
      },
    })
    .select("id")
    .single();
  if (error) throw error;

  await login(page);
  await page.goto("/admin/videos");
  await expect(page.getByRole("heading", { level: 1, name: "Videos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Elegir video" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(title) }).click();

  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByLabel("Gancho 1")).toHaveValue("¿Buscás un Datejust?");
  await expect(page.getByText("Hablá despacio.")).toBeVisible();

  await page.getByRole("button", { name: "Generar los reels" }).click();
  await expect(page.getByText(/En cola: en unos 10 a 20 minutos/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("En cola", { exact: true })).toBeVisible({ timeout: 15000 });

  await service.from("video_projects").delete().eq("id", project.id);
});
