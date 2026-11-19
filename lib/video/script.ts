import { z } from "zod/v4";

/**
 * Guion de un reel escrito por la IA mirando el video (lógica pura).
 * El dueño lo graba con su voz; nunca se genera una voz artificial.
 */

export const reelScriptSchema = z.object({
  ganchos: z.array(z.string()),
  lineas: z.array(
    z.object({
      desde: z.number(),
      hasta: z.number(),
      texto: z.string(),
    })
  ),
  texto_posteo: z.string(),
  hashtags: z.array(z.string()),
  notas: z.string(),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;

/** Ritmo cómodo para hablar a cámara en español rioplatense. */
export const WORDS_PER_SECOND = 2.6;
export const HOOK_COUNT = 3;
export const MAX_VIDEO_SECONDS = 90;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** Días que se guardan los archivos de un video; el guion y el texto quedan. */
export const KEEP_FILES_DAYS = 15;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** Ordena, recorta a la duración del video y descarta lo vacío o repetido. */
export function normalizeScript(script: ReelScript, durationSec: number): ReelScript {
  const lineas = script.lineas
    .map((line) => ({
      desde: Math.max(0, Math.min(durationSec, Math.round(line.desde * 10) / 10)),
      hasta: Math.max(0, Math.min(durationSec, Math.round(line.hasta * 10) / 10)),
      texto: clean(line.texto),
    }))
    .filter((line) => line.texto && line.hasta > line.desde)
    .sort((a, b) => a.desde - b.desde);

  const ganchos = [...new Set(script.ganchos.map(clean).filter(Boolean))].slice(0, HOOK_COUNT);
  const hashtags = [
    ...new Set(
      script.hashtags
        .map((tag) => tag.replace(/^#+/, "").replace(/\s+/g, "").trim())
        .filter((tag) => /^[\p{L}\p{N}_]+$/u.test(tag))
    ),
  ].slice(0, 12);

  return {
    ganchos,
    lineas,
    texto_posteo: script.texto_posteo.trim().slice(0, 2000),
    hashtags,
    notas: clean(script.notas).slice(0, 500),
  };
}

/** ¿Entra la línea en su tramo hablando a un ritmo normal? */
export function lineFits(line: { desde: number; hasta: number; texto: string }): boolean {
  const words = line.texto.split(" ").filter(Boolean).length;
  const seconds = line.hasta - line.desde;
  return seconds > 0 && words / seconds <= WORDS_PER_SECOND + 0.6;
}

/** Texto listo para pegar en Instagram. */
export function postText(script: Pick<ReelScript, "texto_posteo" | "hashtags">): string {
  const tags = script.hashtags.map((tag) => `#${tag}`).join(" ");
  return tags ? `${script.texto_posteo}\n\n${tags}` : script.texto_posteo;
}

/** Momentos del video que mira la IA (repartidos, evitando el primer y el último cuadro). */
export function frameTimes(durationSec: number, count = 6): number[] {
  const usable = Math.max(0.5, durationSec - 0.4);
  return Array.from({ length: count }, (_, i) => Math.round(((usable * (i + 0.5)) / count) * 10) / 10);
}
