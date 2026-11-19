import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  DEFAULT_AI_MODEL,
  aiSuggestionSchema,
  estimateCostUsd,
  type AiSuggestion,
} from "@/lib/ai/product-suggestion";

/**
 * Detección de producto desde fotos con la API de Claude (visión).
 *
 * Corre SOLO en el servidor: la API key (ANTHROPIC_API_KEY) nunca llega
 * al navegador. El modelo se puede cambiar con ANTHROPIC_MODEL.
 */

export type DetectionImage =
  | { kind: "base64"; mediaType: "image/webp" | "image/jpeg" | "image/png"; data: string }
  | { kind: "url"; url: string };

const SYSTEM_PROMPT = `Sos un experto en relojería que ayuda a cargar el catálogo de Relojes Carrasco, una relojería de Montevideo, Uruguay, que vende relojes suizos nuevos y usados, y correas y accesorios.

Vas a recibir entre 1 y 8 fotos de UN mismo producto. Tu tarea es completar su ficha solo con lo que se puede VER en las fotos.

Reglas estrictas:
- No inventes. Si un dato no se ve con claridad en las fotos, devolvé null en ese campo y nombralo en "uncertain".
- Marca, modelo y referencia: solo si están escritos en la esfera, el fondo, la caja, la hebilla o los papeles fotografiados, o si el modelo es inconfundible por su diseño. Una referencia nunca se deduce: se lee.
- Diámetro: solo si aparece escrito o medido en la foto. Nunca lo estimes a ojo.
- Movimiento: solo si se lee en la esfera o el fondo (por ejemplo "Automatic", "Quartz") o si se ve el mecanismo.
- Materiales y colores: describí lo que se ve ("acero", "acero y oro", "cuero"). Si no podés distinguir oro macizo de enchapado, decí "tono dorado" y agregalo a "uncertain".
- NUNCA menciones ni estimes: año de fabricación, estado de conservación, si incluye caja o papeles, precio, autenticidad ni compatibilidad con otros modelos. Esos datos los completa una persona.
- Si las fotos muestran una correa o un accesorio en lugar de un reloj, completá los campos de correa (tipo, material, color, ancho solo si está escrito, costura).

Título ("title"): corto y sobrio, en el formato «Marca Modelo» más un rasgo distintivo si ayuda (por ejemplo «Omega Seamaster esfera azul»). Sin adjetivos de venta.

Descripción ("description"): 2 a 4 oraciones en español rioplatense neutro, tono elegante y sobrio, tratando de "vos" solo si hace falta. Describí lo que se ve: caja, esfera, índices, agujas, brazalete o correa. Sin exageraciones ("espectacular", "único", "impecable"), sin signos de exclamación, sin emojis y sin ninguno de los datos prohibidos de arriba.

"uncertain": lista breve, en español, de lo que no pudiste confirmar y conviene que una persona revise.`;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY no configurada");
    this.name = "AiNotConfiguredError";
  }
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_AI_MODEL;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function detectProductFromImages(input: {
  images: DetectionImage[];
  category: "reloj" | "accesorio";
  hint?: string | null;
}): Promise<{ suggestion: AiSuggestion; costUsd: number; model: string }> {
  if (!aiConfigured()) throw new AiNotConfiguredError();

  const client = new Anthropic();
  const model = aiModel();

  const imageBlocks: Anthropic.ImageBlockParam[] = input.images.map((image) =>
    image.kind === "url"
      ? { type: "image", source: { type: "url", url: image.url } }
      : { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }
  );

  const instructions = [
    `El administrador indicó que el producto es: ${input.category === "reloj" ? "un reloj" : "una correa o accesorio"}.`,
    input.hint?.trim() ? `Nota del administrador: ${input.hint.trim().slice(0, 300)}` : null,
    "Completá la ficha siguiendo las reglas.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: instructions }] }],
    output_config: { format: zodOutputFormat(aiSuggestionSchema) },
  });

  const suggestion = response.parsed_output;
  if (!suggestion) {
    throw new Error("La IA no devolvió una ficha válida.");
  }

  return {
    suggestion,
    costUsd: estimateCostUsd(model, response.usage),
    model,
  };
}

export { Anthropic };
