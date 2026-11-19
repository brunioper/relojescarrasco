import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * El archivo que el dueño pega en el SQL Editor de Supabase debe ser
 * siempre una copia exacta de la migración probada por el CI.
 */
const STAGES = [
  {
    production: "supabase/produccion/etapa-2-variantes.sql",
    migration: "supabase/migrations/20261116000001_variants_sale_mode_sold.sql",
  },
  {
    production: "supabase/produccion/etapa-6-instagram.sql",
    migration: "supabase/migrations/20261117000001_instagram_imports.sql",
  },
];

describe("SQL de producción", () => {
  for (const stage of STAGES) {
    it(`${stage.production} contiene la migración tal cual, dentro de una transacción`, () => {
      const migration = readFileSync(stage.migration, "utf8");
      const production = readFileSync(stage.production, "utf8");
      expect(production).toContain(migration);
      expect(production.indexOf("begin;")).toBeLessThan(production.indexOf(migration));
      expect(production.indexOf("commit;")).toBeGreaterThan(production.indexOf(migration));
    });

    it(`${stage.migration} es aditiva: no borra tablas, columnas ni filas`, () => {
      const migration = readFileSync(stage.migration, "utf8").replace(/--.*$/gm, "");
      expect(migration).not.toMatch(/\bdrop\s+(table|column|type|schema)\b/i);
      expect(migration).not.toMatch(/\btruncate\b/i);
      expect(migration).not.toMatch(/\bdelete\s+from\b/i);
      expect(migration).not.toMatch(/\balter\s+table\s+\S+\s+drop\b/i);
    });
  }
});
