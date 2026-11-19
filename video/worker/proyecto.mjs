import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { captionsData, captionsHtml, clampGroups } from "./subtitulos.mjs";

/**
 * Arma un proyecto de HyperFrames listo para renderizar a partir de la
 * plantilla, el video, la voz (opcional) y los subtítulos.
 */

export const CIERRE_DURACION = 3.2;
/** El cierre empieza un poco antes del final del video, sobre sus últimos cuadros. */
export const CIERRE_SOLAPE = 0.25;
export const MINIMO_VIDEO = 6;

const TEMPLATE_FILES = ["index.html", "hyperframes.json", "package.json", "meta.json", "assets/logo.png"];

/** @param {number} videoDuration */
export function timings(videoDuration) {
  const video = round(Math.max(MINIMO_VIDEO, videoDuration));
  const cierre = round(video - CIERRE_SOLAPE);
  return {
    video,
    cierre,
    cierreDuracion: CIERRE_DURACION,
    total: round(cierre + CIERRE_DURACION),
    // El rótulo arranca a los 2,9 s y se va antes del cierre.
    rotulo: round(Math.max(1, cierre - 0.1 - 2.9)),
  };
}

/**
 * @param {string} html
 * @param {{ videoDuration: number, voiceDuration: number, groups: import("./subtitulos.mjs").Grupo[] }} input
 */
export function fillTemplate(html, { videoDuration, voiceDuration, groups }) {
  const t = timings(videoDuration);
  const limited = clampGroups(groups, t.cierre);
  const voz =
    voiceDuration && voiceDuration > 0
      ? `<audio id="voz" class="clip" data-start="0" data-duration="${round(Math.min(voiceDuration, t.cierre))}" data-track-index="1" data-volume="1" src="assets/voz.m4a"></audio>`
      : "";
  const replacements = {
    __TOTAL__: String(t.total),
    __VIDEO__: String(t.video),
    __ROTULO__: String(t.rotulo),
    __CIERRE__: String(t.cierre),
    __CIERRE_DUR__: String(t.cierreDuracion),
    __SUBTITULOS_JSON__: JSON.stringify(captionsData(limited)),
  };
  let out = html
    .replace("<!--VOZ-->", voz)
    .replace("<!--SUBTITULOS-->", captionsHtml(limited));
  for (const [marker, value] of Object.entries(replacements)) out = out.split(marker).join(value);
  const leftover = out.match(/__[A-Z_]+__/);
  if (leftover) throw new Error(`Quedó un marcador sin completar en la plantilla: ${leftover[0]}`);
  return { html: out, ...t, captions: limited.length };
}

export async function buildProject({ templateDir, outDir, clipPath, voicePath, videoDuration, voiceDuration, groups }) {
  await mkdir(join(outDir, "assets"), { recursive: true });
  for (const file of TEMPLATE_FILES) {
    if (file === "index.html") continue;
    await copyFile(join(templateDir, file), join(outDir, file));
  }
  await copyFile(clipPath, join(outDir, "assets/clip.mp4"));
  if (voicePath) await copyFile(voicePath, join(outDir, "assets/voz.m4a"));

  const template = await readFile(join(templateDir, "index.html"), "utf8");
  const filled = fillTemplate(template, {
    videoDuration,
    voiceDuration: voicePath ? voiceDuration : 0,
    groups,
  });
  await writeFile(join(outDir, "index.html"), filled.html);
  return filled;
}

/** Filas para `hyperframes render --batch`: una por versión. */
/**
 * @param {{ hooks: string[], product: { brand?: string | null, model?: string | null, reference?: string | null, price?: string | null } }} input
 * @returns {Array<{ name: string, gancho: string, estilo: string, marca: string, modelo: string, referencia: string, precio: string, cierre: string, usuario: string, web: string }>}
 */
export function variantRows({ hooks, product }) {
  const estilos = ["elegante", "impacto", "pregunta"];
  const base = {
    marca: product.brand ?? "",
    modelo: product.model ?? "",
    referencia: product.reference ? `Ref. ${product.reference}` : "",
    precio: product.price ?? "",
    cierre: "Consultá por mensaje directo",
    usuario: "@relojes_carrasco",
    web: "relojescarrasco.com",
  };
  return hooks.slice(0, 3).map((gancho, i) => ({
    name: `version-${i + 1}`,
    gancho,
    estilo: estilos[i % estilos.length],
    ...base,
  }));
}

function round(n) {
  return Math.round(n * 100) / 100;
}
