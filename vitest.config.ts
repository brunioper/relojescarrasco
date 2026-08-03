import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    projects: [
      {
        resolve: {
        alias: {
          "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
          "@": path.resolve(__dirname, "."),
        },
      },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: {
        alias: {
          "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
          "@": path.resolve(__dirname, "."),
        },
      },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          testTimeout: 30000,
          hookTimeout: 30000,
          // Integration tests hit a real (local) Supabase instance and share
          // seeded state — run them sequentially to avoid interference.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
