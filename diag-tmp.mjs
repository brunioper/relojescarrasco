import { chromium } from "@playwright/test";

const BASE = "https://relojescarrasco.vercel.app";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
const page = await browser.newPage();

// Capturar TODAS las respuestas de storage
page.on("response", async (res) => {
  if (res.url().includes("/storage/v1/")) {
    let body = "";
    try { body = await res.text(); } catch {}
    console.log("STORAGE", res.status(), res.request().method(), res.url().slice(0, 130));
    console.log("BODY:", body.slice(0, 400));
  }
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE-ERR:", msg.text().slice(0, 300));
});

await page.goto(`${BASE}/auth/login`);
await page.getByLabel("Email").fill("admin@admin.com");
await page.getByLabel("Contraseña").fill("Admin12345!");
await page.getByRole("button", { name: "Iniciar sesión" }).click();
await page.waitForURL(/\/admin\//, { timeout: 30000 }).catch(() => console.log("LOGIN-FAIL: no llegó a /admin — URL:", page.url()));
console.log("URL tras login:", page.url());

// Ir al primer producto
await page.goto(`${BASE}/admin/productos`);
const firstProduct = page.locator('table a[href^="/admin/productos/"]').first();
await firstProduct.click();
await page.waitForURL(/\/admin\/productos\/[0-9a-f-]{36}/, { timeout: 20000 });
console.log("Producto:", page.url());

await page.getByRole("tab", { name: /Imágenes/ }).click();
const input = page.locator('input[type="file"]');
await input.setInputFiles([{ name: "diag.png", mimeType: "image/png", buffer: PNG }]);

// Esperar a que ocurra el upload (o el error)
await page.waitForTimeout(10000);
await browser.close();
