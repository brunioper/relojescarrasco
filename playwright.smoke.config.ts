import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke test contra un sitio ya desplegado (no levanta servidor local).
 *
 *   SMOKE_BASE_URL=https://www.relojescarrasco.com npm run test:smoke
 *
 * Para versiones de prueba de Vercel protegidas, definir además
 * VERCEL_AUTOMATION_BYPASS_SECRET (Vercel → Settings → Deployment Protection).
 */
const baseURL = process.env.SMOKE_BASE_URL;
if (!baseURL) {
  throw new Error("Definí SMOKE_BASE_URL con la URL del sitio a verificar.");
}

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "es-UY",
    timezoneId: "America/Montevideo",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
});
