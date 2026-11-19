import { z } from "zod/v4";

/**
 * Sugerencia de ficha generada por IA a partir de las fotos (lógica
 * pura: esquema, costo estimado y tope mensual). Sin acceso a red.
 *
 * Regla de oro: la IA solo completa lo que SE VE en las fotos. Año,
 * estado, caja y papeles, precio y compatibilidad nunca se sugieren:
 * los completa una persona.
 */

const text = z.string().nullable();

/** Lo que devuelve el modelo (salida estructurada). */
export const aiSuggestionSchema = z.object({
  product_type: z.enum(["reloj", "correa", "accesorio", "desconocido"]),
  brand: text,
  model: text,
  reference_number: text,
  movement: z.enum(["automatico", "manual", "cuarzo", "solar", "otro"]).nullable(),
  case_material: text,
  strap_material: text,
  diameter_mm: z.number().nullable(),
  dial_color: text,
  strap_type: text,
  strap_color: text,
  strap_width_mm: z.number().nullable(),
  strap_stitching: text,
  title: z.string(),
  description: z.string(),
  uncertain: z.array(z.string()),
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

const clean = (value: string | null | undefined, max: number): string | null => {
  const trimmed = (value ?? "").trim();
  if (!trimmed || /^(desconocid[oa]|no visible|n\/a|null|none|-)$/i.test(trimmed)) return null;
  return trimmed.slice(0, max);
};

export type FormSuggestion = {
  name: string | null;
  brand: string | null;
  model: string | null;
  reference_number: string | null;
  movement: AiSuggestion["movement"];
  case_material: string | null;
  strap_material: string | null;
  diameter_mm: number | null;
  public_description: string | null;
  /** Datos detectados que no tienen campo propio (se muestran al revisar). */
  extras: { label: string; value: string }[];
  /** Lo que la IA no pudo confirmar. */
  uncertain: string[];
};

/** Traduce la respuesta del modelo a los campos del formulario, descartando valores dudosos. */
export function toFormSuggestion(ai: AiSuggestion, category: "reloj" | "accesorio"): FormSuggestion {
  const isWatch = category === "reloj";
  const diameter =
    isWatch && ai.diameter_mm !== null && ai.diameter_mm >= 15 && ai.diameter_mm <= 60
      ? Math.round(ai.diameter_mm * 10) / 10
      : null;

  const extras: FormSuggestion["extras"] = [];
  const push = (label: string, value: string | null) => {
    if (value) extras.push({ label, value });
  };
  if (isWatch) {
    push("Color de esfera", clean(ai.dial_color, 60));
  } else {
    push("Tipo", clean(ai.strap_type, 60));
    push("Color", clean(ai.strap_color, 60));
    if (ai.strap_width_mm !== null && ai.strap_width_mm > 5 && ai.strap_width_mm <= 40) {
      push("Ancho", `${ai.strap_width_mm} mm`);
    }
    push("Costura", clean(ai.strap_stitching, 60));
  }

  return {
    name: clean(ai.title, 200),
    brand: clean(ai.brand, 100),
    model: clean(ai.model, 100),
    reference_number: isWatch ? clean(ai.reference_number, 60) : null,
    movement: isWatch ? ai.movement : null,
    case_material: isWatch ? clean(ai.case_material, 100) : null,
    strap_material: clean(ai.strap_material, 100),
    diameter_mm: diameter,
    public_description: clean(ai.description, 5000),
    extras,
    uncertain: ai.uncertain.map((u) => u.trim()).filter(Boolean).slice(0, 12),
  };
}

// ------------------------------------------------------------
// Costo y tope mensual
// ------------------------------------------------------------

/** Precio por millón de tokens (USD). Modelos no listados usan el más caro, para no subestimar. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export const DEFAULT_AI_MODEL = "claude-opus-4-8";
export const DEFAULT_MONTHLY_BUDGET_USD = 5;
export const MAX_AI_IMAGES = 8;

export function estimateCostUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number }
): number {
  const price = PRICES[model] ?? PRICES[DEFAULT_AI_MODEL]!;
  const cost = (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}

export type AiUsage = { month: string; usd: number; calls: number };

/** "2026-11" en la zona horaria de Montevideo. */
export function usageMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .slice(0, 7);
}

/** Lee el uso guardado; si es de otro mes (o inválido), arranca en cero. */
export function readUsage(raw: unknown, month: string): AiUsage {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (r.month === month && typeof r.usd === "number" && typeof r.calls === "number") {
      return { month, usd: Math.max(0, r.usd), calls: Math.max(0, Math.floor(r.calls)) };
    }
  }
  return { month, usd: 0, calls: 0 };
}

export function addUsage(usage: AiUsage, costUsd: number): AiUsage {
  return {
    month: usage.month,
    usd: Math.round((usage.usd + Math.max(0, costUsd)) * 10000) / 10000,
    calls: usage.calls + 1,
  };
}

export function readBudget(raw: unknown): number {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = (raw as Record<string, unknown>).value;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return DEFAULT_MONTHLY_BUDGET_USD;
}

export function budgetExceeded(usage: AiUsage, budgetUsd: number): boolean {
  return usage.usd >= budgetUsd;
}
