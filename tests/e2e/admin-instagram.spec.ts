import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Bandeja de Instagram (Etapa 6): las dos decisiones que toma el dueño.
 * Las piezas se crean directo en la base, como lo haría la revisión
 * automática (que en CI no tiene Instagram ni IA).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Rolex Datejust 36 del seed.
const SEEDED_ROLEX = "10000000-0000-4000-8000-000000000001";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createPendingImport(options: { title: string; brand: string; model: string; matches: string[] }) {
  const mediaId = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const path = `instagram/${mediaId}/0.png`;
  const upload = await service.storage.from("product-images").upload(path, PNG_1PX, {
    contentType: "image/png",
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const { error } = await service.from("instagram_imports").insert({
    media_id: mediaId,
    source: "historia",
    media_type: "IMAGE",
    posted_at: new Date().toISOString(),
    image_paths: [path],
    status: "pendiente",
    reason: options.matches.length > 0 ? "Se parece a un producto que ya está en el catálogo: ¿es el mismo?" : "No se pudo leer la marca: revisalo y crealo desde acá.",
    matched_product_ids: options.matches,
    ai_result: {
      product_type: "reloj",
      brand: options.brand,
      model: options.model,
      reference_number: null,
      title: options.title,
      visible_price: null,
    },
  });
  if (error) throw error;
}

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill("admin@relojescarrasco.test");
  await page.getByLabel("Contraseña").fill("Admin1234!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/admin\//, { timeout: 20000 });
}

test.describe.serial("bandeja de Instagram", () => {
  test("es el mismo reloj: agrega las fotos al producto existente", async ({ page }) => {
    const title = `Rolex Datejust historia ${Date.now()}`;
    await createPendingImport({ title, brand: "Rolex", model: "Datejust", matches: [SEEDED_ROLEX] });

    await login(page);
    await page.goto("/admin/instagram");
    await expect(page.getByRole("heading", { level: 1, name: "Instagram" })).toBeVisible();
    await expect(page.getByLabel("Token de acceso de Instagram")).toBeVisible();

    const card = page.locator("article", { hasText: title });
    await expect(card.getByText("Para aprobar")).toBeVisible();
    await card.getByRole("button", { name: "Es este: agregar fotos" }).click();
    await expect(page.getByText("Fotos agregadas al producto.")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("article", { hasText: title }).getByText("Resuelto")).toBeVisible({ timeout: 15000 });
  });

  test("es otro reloj: lo crea y lo publica con el precio cargado", async ({ page }) => {
    const title = `Longines historia ${Date.now()}`;
    await createPendingImport({ title, brand: "Longines", model: "Spirit", matches: [] });

    await login(page);
    await page.goto("/admin/instagram");
    const card = page.locator("article", { hasText: title });
    await card.getByRole("button", { name: "Revisar y crear producto" }).click();
    await card.getByLabel("Precio en dólares (opcional)").fill("2350");
    await card.getByRole("button", { name: "Crear y publicar" }).click();
    await expect(page.getByText("Producto creado y publicado.")).toBeVisible({ timeout: 20000 });

    await page.goto(`/catalogo?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=/US\\$ 2\\.350/").first()).toBeVisible();
  });
});
