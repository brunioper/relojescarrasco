/**
 * Mensaje del formulario "Vendé tu reloj" (lógica pura, testeable).
 *
 * El formulario no guarda datos en el sitio: arma un mensaje ordenado y
 * lo envía por el canal que elija la persona (Instagram o WhatsApp),
 * donde además puede adjuntar las fotos.
 */

export const SELL_CONDITIONS = [
  "Nuevo o sin uso",
  "Muy buen estado",
  "Buen estado, con marcas de uso",
  "Necesita service o reparación",
] as const;

export type SellWatchInput = {
  name: string;
  brand: string;
  model: string;
  reference?: string;
  year?: string;
  condition?: string;
  hasBox: boolean;
  hasPapers: boolean;
  comments?: string;
};

export function validateSellWatch(input: SellWatchInput): string | null {
  if (!input.name.trim()) return "Escribí tu nombre.";
  if (!input.brand.trim()) return "Indicá la marca del reloj.";
  if (!input.model.trim()) return "Indicá el modelo del reloj (o una descripción breve).";
  return null;
}

export function buildSellWatchMessage(input: SellWatchInput): string {
  const lines = [
    `Hola, soy ${input.name.trim()}. Quiero vender un reloj:`,
    `• Marca: ${input.brand.trim()}`,
    `• Modelo: ${input.model.trim()}`,
  ];
  if (input.reference?.trim()) lines.push(`• Referencia: ${input.reference.trim()}`);
  if (input.year?.trim()) lines.push(`• Año aproximado: ${input.year.trim()}`);
  if (input.condition?.trim()) lines.push(`• Estado: ${input.condition.trim()}`);
  lines.push(`• Caja: ${input.hasBox ? "sí" : "no"}`);
  lines.push(`• Papeles: ${input.hasPapers ? "sí" : "no"}`);
  if (input.comments?.trim()) lines.push(`• Comentarios: ${input.comments.trim()}`);
  lines.push("Les envío las fotos a continuación.");
  return lines.join("\n");
}
