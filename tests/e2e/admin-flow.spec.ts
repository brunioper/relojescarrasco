import { expect, test, type Page } from "@playwright/test";

/**
 * Flujo completo del administrador (ciclo de vida de un reloj):
 * login → crear → fotos → compra → costo → precio → publicar →
 * verlo público → vender → desaparece del catálogo → aparece en reportes.
 *
 * Requiere Supabase local con seed y el dev server (lo levanta Playwright).
 */

const ADMIN_EMAIL = "admin@relojescarrasco.test";
const ADMIN_PASSWORD = "Admin1234!";
const VIEWER_EMAIL = "viewer@relojescarrasco.test";
const VIEWER_PASSWORD = "Viewer1234!";

// PNG rojo de 1×1 (fixture mínima válida para el pipeline de compresión).
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/admin\//, { timeout: 20000 });
}

test.describe.serial("ciclo de vida completo de un reloj", () => {
  const watchName = `Tudor Black Bay E2E ${Date.now()}`;

  test("1-8: crear, fotos, compra, costo, precio y publicación", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // 2. Crear el reloj
    await page.goto("/admin/productos/nuevo");
    await page.getByLabel("Nombre del reloj *").fill(watchName);
    await page.getByLabel("Marca *").fill("Tudor");
    await page.getByLabel("Modelo").fill("Black Bay 58");
    await page.getByLabel("Descripción pública").fill("Reloj de prueba E2E, excelente estado.");
    await page.getByRole("button", { name: "Crear reloj" }).click();
    await page.waitForURL(/\/admin\/productos\/[0-9a-f-]{36}/, { timeout: 20000 });
    const productUrl = page.url();

    // 3-4. Subir dos imágenes y verificar portada
    await page.getByRole("tab", { name: /Imágenes/ }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: "foto-1.png", mimeType: "image/png", buffer: PNG_1PX },
      { name: "foto-2.png", mimeType: "image/png", buffer: PNG_1PX },
    ]);
    await expect(page.getByText(/imágenes subidas|imagen subida/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Portada")).toBeVisible({ timeout: 15000 });

    // 5. Registrar la compra
    await page.getByRole("tab", { name: "Compra y costos" }).click();
    await page.getByLabel("Precio de compra *").fill("900");
    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(page.getByText("Compra guardada.")).toBeVisible({ timeout: 15000 });

    // 6. Agregar un costo de reparación
    await page.getByRole("button", { name: "Agregar costo" }).click();
    await page.getByLabel("Importe *").fill("2000");
    await page.getByLabel("Descripción").fill("Cambio de junta E2E");
    await page.getByRole("button", { name: "Guardar costo" }).click();
    await expect(page.getByText("Costo agregado.")).toBeVisible({ timeout: 15000 });

    // 7. Definir el precio de lista en USD
    await page.getByRole("tab", { name: "Precio de lista" }).click();
    await page.getByLabel("Precio de lista *").fill("1500");
    await page.getByRole("button", { name: "Guardar precio" }).click();
    await expect(page.getByText(/Precio de lista actualizado/)).toBeVisible({ timeout: 15000 });

    // 8. Publicar
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Producto publicado en el catálogo.")).toBeVisible({
      timeout: 15000,
    });

    // 9-11. Verlo en el catálogo público con el formato de precio obligatorio
    await page.goto("/catalogo?q=Tudor");
    const card = page.getByRole("link", { name: new RegExp(watchName.slice(0, 20)) });
    await expect(card).toBeVisible({ timeout: 15000 });

    // 10. Precio primario USD con UYU aprox. entre paréntesis
    await expect(page.locator("text=/US\\$ 1\\.500/").first()).toBeVisible();
    await expect(page.locator("text=/\\(\\$ [\\d.,]+ UYU aprox\\.\\)/").first()).toBeVisible();

    // 11. Página de detalle
    await card.click();
    await expect(page.getByRole("heading", { name: watchName })).toBeVisible();
    await expect(page.locator("text=/US\\$ 1\\.500/").first()).toBeVisible();

    // 12. Marcar como vendido
    await page.goto(productUrl);
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await page.getByLabel("Precio real de venta *").fill("1400");
    await page.getByRole("button", { name: "Confirmar venta" }).click();
    await expect(page.getByText(/Venta registrada/)).toBeVisible({ timeout: 20000 });

    // 13. Desapareció del catálogo disponible
    await page.goto("/catalogo?q=Tudor");
    await expect(page.getByRole("link", { name: new RegExp(watchName.slice(0, 20)) })).toHaveCount(
      0,
      { timeout: 15000 }
    );

    // 14. Aparece en ventas y reportes
    await page.goto("/admin/ventas");
    await expect(page.getByText(watchName)).toBeVisible();

    await page.goto("/admin/reportes?periodo=hoy");
    await expect(page.getByText(watchName)).toBeVisible();
  });
});

test.describe("restricciones del rol viewer", () => {
  test("16: un viewer no ve acciones de edición", async ({ page }) => {
    await login(page, VIEWER_EMAIL, VIEWER_PASSWORD);

    await page.goto("/admin/productos");
    await expect(page.getByRole("link", { name: "Nuevo reloj" })).toHaveCount(0);

    // Puede consultar el dashboard
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // La configuración es solo para administradores
    await page.goto("/admin/configuracion");
    await expect(page).toHaveURL(/sin-permisos/);
  });
});
