import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { estimateCostUsd } from "@/lib/ai/product-suggestion";
import { normalizeScript, reelScriptSchema, type ReelScript } from "@/lib/video/script";
import { AiNotConfiguredError, Anthropic, aiConfigured, aiModel } from "@/services/ai/product-detection";

/**
 * Guion de un reel a partir de cuadros del video que subió el dueño.
 * Lo graba él con su voz: acá nunca se genera audio.
 */

const SYSTEM_PROMPT = `Sos guionista de reels de Instagram para Relojes Carrasco, una relojería de Carrasco, Montevideo, que vende relojes suizos nuevos y usados, y correas. El dueño filmó un video del producto y lo va a narrar con su propia voz. Vas a recibir cuadros del video en orden, cada uno con el segundo en que aparece, y a veces los datos del producto cargados en el sistema.

Escribí el guion para que lo lea a cámara (en voz en off) mientras corre el video:

- Español rioplatense, tratando de "vos". Tono elegante, cercano y sobrio, como quien conoce de relojes. Frases cortas.
- Ritmo: unas 2,5 palabras por segundo. Cada línea tiene que entrar holgada en su tramo ("desde" y "hasta", en segundos). Dejá respirar: no hace falta hablar todo el tiempo.
- Seguí lo que se ve en cada tramo: si en el segundo 6 se ve el fondo del reloj, hablá del fondo en ese tramo.
- La primera línea es el gancho (de 0 a 2,5 segundos como máximo): tiene que despertar curiosidad y entenderse sin sonido.
- "ganchos": 3 ganchos distintos para probar como reels de prueba (máximo 8 palabras cada uno). El primero es el que usa la primera línea. Variá el enfoque: una pregunta, un dato que se ve, una promesa.
- La última línea es el llamado a la acción: escribir por mensaje directo o verlo en Carrasco.
- Datos: usá solo lo que viene en los datos del producto o lo que se lee claramente en la imagen. NUNCA inventes estado, año, caja y papeles, precio, garantía, autenticidad ni historia del reloj. Si el precio viene en los datos, podés decirlo.
- Sin exageraciones ("espectacular", "único", "impecable", "joya"), sin signos de exclamación y sin emojis en el guion.
- "texto_posteo": 2 a 4 líneas para el texto del posteo, sobrias, terminando con el llamado a escribir por mensaje directo. Sin emojis salvo, como mucho, uno discreto.
- "hashtags": de 5 a 10, sin el símbolo #, mezclando marca y modelo con búsquedas locales (por ejemplo relojesuruguay, montevideo).
- "notas": 1 o 2 consejos breves para grabar la voz o el encuadre (por ejemplo, hablar más lento en un tramo, o dejar aire debajo del reloj para los subtítulos).`;

export type ReelScriptProduct = {
  name: string;
  brand: string;
  model: string;
  reference_number: string | null;
  year_approx: number | null;
  condition: string;
  includes_box: boolean;
  includes_documentation: boolean;
  price_usd: number | null;
};

function productBlock(product: ReelScriptProduct | null): string {
  if (!product) return "No hay datos del producto: usá solo lo que se ve.";
  const lines = [
    `Producto: ${product.name}`,
    `Marca: ${product.brand}`,
    product.model ? `Modelo: ${product.model}` : null,
    product.reference_number ? `Referencia: ${product.reference_number}` : null,
    product.year_approx ? `Año aproximado: ${product.year_approx}` : null,
    product.condition ? `Estado: ${product.condition}` : null,
    product.includes_box || product.includes_documentation
      ? `Incluye: ${[product.includes_box ? "caja" : null, product.includes_documentation ? "papeles" : null].filter(Boolean).join(" y ")}`
      : null,
    product.price_usd ? `Precio: US$ ${product.price_usd.toLocaleString("es-UY")}` : null,
  ];
  return `Datos del producto cargados en el sistema:\n${lines.filter(Boolean).join("\n")}`;
}

export async function writeReelScript(input: {
  frames: { time: number; mediaType: "image/webp" | "image/jpeg" | "image/png"; data: string }[];
  durationSec: number;
  product: ReelScriptProduct | null;
}): Promise<{ script: ReelScript; costUsd: number; model: string }> {
  if (!aiConfigured()) throw new AiNotConfiguredError();

  const client = new Anthropic();
  const model = aiModel();

  const content: Anthropic.ContentBlockParam[] = [];
  for (const frame of input.frames) {
    content.push({ type: "text", text: `Segundo ${frame.time.toFixed(1)}:` });
    content.push({ type: "image", source: { type: "base64", media_type: frame.mediaType, data: frame.data } });
  }
  content.push({
    type: "text",
    text: `${productBlock(input.product)}\n\nEl video dura ${input.durationSec.toFixed(1)} segundos. Escribí el guion siguiendo las reglas.`,
  });

  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(reelScriptSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("La IA no devolvió un guion válido.");

  return {
    script: normalizeScript(parsed, input.durationSec),
    costUsd: estimateCostUsd(model, response.usage),
    model,
  };
}
