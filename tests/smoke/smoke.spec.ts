import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke test contra un sitio YA desplegado (staging/preview o producción).
 *
 * Solo LEE: no inicia sesión, no envía formularios y no modifica datos.
 * Verifica que las páginas clave cargan sin errores de consola ni
 * recursos rotos. Se usa:
 *   - antes de mergear (contra la versión de prueba de la rama), y
 *   - después de cada deploy a producción (si falla → rollback).
 *
 *   SMOKE_BASE_URL=https://www.relojescarrasco.com npm run test:smoke
 */

const IS_PRODUCTION = /relojescarrasco\.com/.test(process.env.SMOKE_BASE_URL ?? "");

/** Errores de consola y respuestas fallidas del propio sitio durante la navegación. */
function watchPage(page: Page): { problems: string[] } {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Ruido conocido de terceros (píxel bloqueado por el navegador, etc.).
    if (/facebook|fbevents|favicon/i.test(text)) return;
    problems.push(`consola: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`excepción: ${error.message}`));
  page.on("response", (response) => {
    const url = response.url();
    const sameSite = url.startsWith(process.env.SMOKE_BASE_URL ?? "\u0000");
    const isStorage = /supabase\.co\/storage/.test(url);
    if ((sameSite || isStorage) && response.status() >= 400) {
      problems.push(`HTTP ${response.status()}: ${url}`);
    }
  });
  return { problems };
}

// Versiones de prueba protegidas de Vercel: se habilita el acceso con una cookie
// (así el secreto solo viaja a Vercel, nunca a otros dominios).
test.beforeEach(async ({ page }) => {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypass) return;
  await page.request.get(
    `/robots.txt?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`
  );
});

test("portada → catálogo con productos y precios", async ({ page }) => {
  const watcher = watchPage(page);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/catalogo$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const products = page.locator('main a[href^="/catalogo/"]');
  await expect(products.first()).toBeVisible();
  await expect(page.locator("text=/US\\$ [\\d.,]+/").first()).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

test("ficha de producto: fotos, precio y botón de consulta", async ({ page }) => {
  const watcher = watchPage(page);
  await page.goto("/catalogo");
  const href = await page.locator('main a[href^="/catalogo/"]').first().getAttribute("href");
  expect(href).toBeTruthy();

  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("text=/US\\$ [\\d.,]+/").first()).toBeVisible();

  const consultar = page.getByRole("link", { name: /Consultar por (Instagram|WhatsApp)/ }).first();
  await expect(consultar).toBeVisible();
  expect(await consultar.getAttribute("href")).toMatch(/^https:\/\/(ig\.me|wa\.me)\//);

  const types = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (block) => (JSON.parse(block) as { "@type": string })["@type"]
  );
  expect(types).toContain("Product");
  expect(watcher.problems).toEqual([]);
});

test("filtros del catálogo responden", async ({ page }) => {
  const watcher = watchPage(page);
  const response = await page.goto("/catalogo?orden=price_desc&min=abc&tamano=cualquiera");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

test("páginas informativas cargan", async ({ page }) => {
  const watcher = watchPage(page);
  for (const path of [
    "/vende-tu-reloj",
    "/autenticidad-y-garantia",
    "/sobre-nosotros",
    "/contacto",
    "/privacidad",
    "/terminos",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
  }
  expect(watcher.problems).toEqual([]);
});

test("los links de navegación y del pie no están rotos", async ({ page }) => {
  await page.goto("/catalogo");
  const hrefs = await page
    .locator('header a[href^="/"], footer a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThan(4);
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

test("el panel exige iniciar sesión y la pantalla de login carga", async ({ page }) => {
  const watcher = watchPage(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  expect(watcher.problems).toEqual([]);
});

test("una dirección inexistente muestra la página 404 propia", async ({ page }) => {
  const response = await page.goto("/catalogo/este-reloj-no-existe-smoke");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Página no encontrada")).toBeVisible();
});

test("sitemap y robots correctos", async ({ page }) => {
  const request = page.request;
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/catalogo");
  expect(xml).toContain("/vende-tu-reloj");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);

  if (IS_PRODUCTION) {
    // En producción todo debe apuntar al dominio propio, nunca a *.vercel.app.
    expect(xml).not.toContain("vercel.app");
    expect(xml).toContain("https://www.relojescarrasco.com/catalogo");
    expect(await robots.text()).toContain("https://www.relojescarrasco.com/sitemap.xml");
  }
});
