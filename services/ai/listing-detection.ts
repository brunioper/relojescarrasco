import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { estimateCostUsd } from "@/lib/ai/product-suggestion";
import { listingSchema, type ListingDetection } from "@/lib/ai/listing";
import {
  AiNotConfiguredError,
  Anthropic,
  SYSTEM_PROMPT,
  aiConfigured,
  aiModel,
} from "@/services/ai/product-detection";

/**
 * Lectura de una historia o publicación de Instagram: la misma ficha que
 * en la carga manual, más si es una oferta concreta, si dice vendido o
 * reservado, y el precio SOLO si está escrito en la imagen.
 */

const INSTAGRAM_RULES = `
Estas imágenes son una historia o una publicación de la cuenta de Instagram del negocio. Además de la ficha, respondé:

- "is_single_product_offer": true solo si la imagen muestra UN reloj (o UNA correa o accesorio) concreto que se ofrece. false si muestra el local, a una persona sin un producto protagonista, varios relojes a la vez, un texto o promoción general, una reseña o un meme.
- "sale_status": "vendido" si en la imagen se lee VENDIDO, SOLD o similar; "reservado" si se lee RESERVADO o SEÑADO; si no, null.
- "visible_price": excepción a la regla del precio. Si el precio está ESCRITO en la imagen (por ejemplo «U$S 1.200», «USD 950», «$ 48.000»), transcribí el número y la moneda: "USD" si dice U$S, US$, USD o dólares; "UYU" si dice $U, UYU o pesos; "desconocida" si solo dice $. Si no hay un precio escrito, null. Nunca lo estimes ni lo deduzcas.`;

export async function detectListingFromImages(input: {
  imageUrls: string[];
  source: "historia" | "publicacion";
}): Promise<{ listing: ListingDetection; costUsd: number; model: string }> {
  if (!aiConfigured()) throw new AiNotConfiguredError();

  const client = new Anthropic();
  const model = aiModel();

  const imageBlocks: Anthropic.ImageBlockParam[] = input.imageUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));

  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    system: `${SYSTEM_PROMPT}\n${INSTAGRAM_RULES}`,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Es ${input.source === "historia" ? "una historia" : "una publicación"} de Instagram. Completá la ficha y los datos de Instagram siguiendo las reglas.`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(listingSchema) },
  });

  const listing = response.parsed_output;
  if (!listing) throw new Error("La IA no devolvió una ficha válida.");

  return { listing, costUsd: estimateCostUsd(model, response.usage), model };
}
