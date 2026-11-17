import { describe, expect, it } from "vitest";
import {
  addUsage,
  budgetExceeded,
  estimateCostUsd,
  readBudget,
  readUsage,
  toFormSuggestion,
  usageMonth,
  type AiSuggestion,
} from "@/lib/ai/product-suggestion";

const base: AiSuggestion = {
  product_type: "reloj",
  brand: "Omega",
  model: "Seamaster",
  reference_number: "166.032",
  movement: "automatico",
  case_material: "Acero",
  strap_material: "Cuero",
  diameter_mm: 36.04,
  dial_color: "Plateado",
  strap_type: null,
  strap_color: null,
  strap_width_mm: null,
  strap_stitching: null,
  title: "Omega Seamaster esfera plateada",
  description: "Caja de acero con esfera plateada e índices aplicados.",
  uncertain: ["  Año de fabricación ", ""],
};

describe("sugerencia de ficha con IA", () => {
  it("pasa los datos del reloj a los campos del formulario", () => {
    const form = toFormSuggestion(base, "reloj");
    expect(form.name).toBe("Omega Seamaster esfera plateada");
    expect(form.brand).toBe("Omega");
    expect(form.reference_number).toBe("166.032");
    expect(form.movement).toBe("automatico");
    expect(form.diameter_mm).toBe(36);
    expect(form.extras).toEqual([{ label: "Color de esfera", value: "Plateado" }]);
    expect(form.uncertain).toEqual(["Año de fabricación"]);
  });

  it("descarta valores vacíos, 'desconocido' y diámetros imposibles", () => {
    const form = toFormSuggestion(
      { ...base, brand: "Desconocido", model: "  ", reference_number: "N/A", diameter_mm: 400 },
      "reloj"
    );
    expect(form.brand).toBeNull();
    expect(form.model).toBeNull();
    expect(form.reference_number).toBeNull();
    expect(form.diameter_mm).toBeNull();
  });

  it("en accesorios no propone datos propios de relojes", () => {
    const form = toFormSuggestion(
      { ...base, product_type: "correa", strap_type: "Correa", strap_color: "Marrón", strap_width_mm: 20 },
      "accesorio"
    );
    expect(form.reference_number).toBeNull();
    expect(form.movement).toBeNull();
    expect(form.case_material).toBeNull();
    expect(form.diameter_mm).toBeNull();
    expect(form.extras).toEqual([
      { label: "Tipo", value: "Correa" },
      { label: "Color", value: "Marrón" },
      { label: "Ancho", value: "20 mm" },
    ]);
  });
});

describe("costo y tope mensual de IA", () => {
  it("calcula el costo según el modelo y usa el más caro si no lo conoce", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 100_000 };
    expect(estimateCostUsd("claude-opus-4-8", usage)).toBe(7.5);
    expect(estimateCostUsd("claude-haiku-4-5", usage)).toBe(1.5);
    expect(estimateCostUsd("modelo-desconocido", usage)).toBe(7.5);
  });

  it("el uso arranca en cero al cambiar de mes o con datos inválidos", () => {
    expect(readUsage({ month: "2026-10", usd: 4, calls: 9 }, "2026-11")).toEqual({
      month: "2026-11",
      usd: 0,
      calls: 0,
    });
    expect(readUsage("basura", "2026-11").usd).toBe(0);
    expect(readUsage({ month: "2026-11", usd: 1.25, calls: 3 }, "2026-11").usd).toBe(1.25);
  });

  it("acumula el gasto y corta al llegar al tope", () => {
    const usage = addUsage({ month: "2026-11", usd: 4.99, calls: 10 }, 0.02);
    expect(usage).toEqual({ month: "2026-11", usd: 5.01, calls: 11 });
    expect(budgetExceeded(usage, 5)).toBe(true);
    expect(budgetExceeded({ month: "2026-11", usd: 4.99, calls: 10 }, 5)).toBe(false);
  });

  it("lee el tope configurado o usa el valor por defecto", () => {
    expect(readBudget({ value: 12 })).toBe(12);
    expect(readBudget({ value: -1 })).toBe(5);
    expect(readBudget(undefined)).toBe(5);
  });

  it("el mes se calcula con la hora de Montevideo", () => {
    expect(usageMonth(new Date("2026-12-01T01:00:00Z"))).toBe("2026-11");
    expect(usageMonth(new Date("2026-12-01T04:00:00Z"))).toBe("2026-12");
  });
});
