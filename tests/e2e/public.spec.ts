import { expect, test } from "@playwright/test";

/**
 * Sitio público — requiere Supabase local con seed (supabase db reset).
 */

test.describe("catálogo público", () => {
  test("la portada carga con destacados y precios en formato USD (UYU aprox.)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Relojes con historia");

    // Precio del catálogo: "US$ 5.200 ($ ... UYU aprox.)"
    const priceText = page.locator("text=/US\\$ [\\d.,]+/").first();
    await expect(priceText).toBeVisible();
    await expect(page.locator("text=/UYU aprox\\./").first()).toBeVisible();
  });

  test("el catálogo lista solo relojes disponibles publicados", async ({ page }) => {
    await page.goto("/catalogo");

    await expect(page.getByRole("link", { name: /Rolex Datejust 36/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Omega Seamaster/ })).toBeVisible();

    // Vendidos, archivados y sin publicar NO aparecen.
    await expect(page.getByText("Longines Conquest Heritage")).toHaveCount(0);
    await expect(page.getByText("Citizen Eco-Drive Titanium")).toHaveCount(0);
    await expect(page.getByText("Festina cronógrafo")).toHaveCount(0);
    await expect(page.getByText("Orient Bambino V4")).toHaveCount(0);
  });

  test("búsqueda y filtros funcionan por URL (server-side)", async ({ page }) => {
    await page.goto("/catalogo?q=rolex");
    await expect(page.getByRole("link", { name: /Rolex Datejust/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Omega/ })).toHaveCount(0);

    await page.goto("/catalogo?marca=Tissot");
    await expect(page.getByRole("link", { name: /Tissot PRX/ })).toBeVisible();

    await page.goto("/catalogo?min=3000");
    await expect(page.getByRole("link", { name: /Rolex Datejust/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tissot PRX/ })).toHaveCount(0);
  });

  test("la página de detalle muestra precio, especificaciones y WhatsApp", async ({ page }) => {
    await page.goto("/catalogo/rolex-datejust-36-16233");

    await expect(page.getByRole("heading", { name: "Rolex Datejust 36" })).toBeVisible();
    // Precio primario USD con conversión entre paréntesis
    await expect(page.locator("text=/US\\$ 5\\.200/").first()).toBeVisible();
    await expect(page.locator("text=/UYU aprox\\./").first()).toBeVisible();
    // Aviso de conversión aproximada
    await expect(
      page.locator("text=/conversión aproximada/").first()
    ).toBeVisible();
    // Botón de WhatsApp con mensaje del producto
    const whatsapp = page.getByRole("link", { name: /Consultar por WhatsApp/ });
    await expect(whatsapp).toBeVisible();
    const href = await whatsapp.getAttribute("href");
    expect(href).toContain("wa.me");
    expect(href).toContain(encodeURIComponent("Rolex Datejust 36"));
    // Especificaciones técnicas
    await expect(page.getByText("Automático").first()).toBeVisible();
  });

  test("no expone datos financieros privados en el HTML público", async ({ page }) => {
    const response = await page.goto("/catalogo/rolex-datejust-36-16233");
    const html = (await response?.text()) ?? "";

    // Datos privados del seed que jamás deben filtrarse:
    expect(html).not.toContain("SN-PRIV-0001"); // número de serie privado
    expect(html).not.toContain("3800"); // precio de compra
    expect(html).not.toContain("151240"); // compra convertida
    expect(html).not.toContain("Comprado a coleccionista"); // nota interna
    expect(html).not.toContain("bracelet estirado"); // nota interna
  });

  test("un producto vendido devuelve 404 en su URL pública", async ({ page }) => {
    const response = await page.goto("/catalogo/longines-conquest-heritage");
    expect(response?.status()).toBe(404);
  });

  test("página 404 personalizada", async ({ page }) => {
    await page.goto("/catalogo/no-existe-este-reloj");
    await expect(page.getByText("Página no encontrada")).toBeVisible();
  });

  test("páginas legales y de contacto accesibles", async ({ page }) => {
    await page.goto("/sobre-nosotros");
    await expect(page.getByRole("heading", { name: "Sobre nosotros" })).toBeVisible();

    await page.goto("/contacto");
    await expect(page.getByRole("heading", { name: "Contacto" })).toBeVisible();

    await page.goto("/privacidad");
    await expect(page.getByRole("heading", { name: /privacidad/i })).toBeVisible();

    await page.goto("/terminos");
    await expect(page.getByRole("heading", { name: /Términos/i })).toBeVisible();
  });
});

test.describe("seguridad de rutas", () => {
  test("el panel de administración exige sesión", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("la API de exportación exige sesión", async ({ request }) => {
    const response = await request.get(
      "/api/admin/export?report=ventas&format=csv&from=2026-01-01&to=2026-12-31"
    );
    expect(response.status()).toBe(401);
  });

  test("la API de documentos privados exige sesión", async ({ request }) => {
    const response = await request.get("/api/admin/documents?path=purchases/x.pdf");
    expect(response.status()).toBe(401);
  });
});
