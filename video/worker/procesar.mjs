#!/usr/bin/env node
/**
 * Arma los reels de los proyectos en cola. Lo corre .github/workflows/video.yml
 * en una máquina de GitHub (gratis en repositorios públicos).
 *
 *   1. Pide al sitio el próximo proyecto (URLs firmadas del video y la voz).
 *   2. Normaliza el video (vertical 1080×1920) y la voz (volumen parejo).
 *   3. Subtítulos: transcribe la voz del dueño con whisper LOCAL (gratis); sin
 *      voz, o si la transcripción falla, usa las líneas del guion.
 *   4. Completa la plantilla y renderiza una versión por gancho.
 *   5. Sube las versiones y avisa al sitio.
 *
 * Nunca genera voz: el audio, si lo hay, es el que grabó el dueño.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { MINIMO_VIDEO, buildProject, variantRows } from "./proyecto.mjs";
import { cleanWords, groupWords, groupsFromScript } from "./subtitulos.mjs";

const run = promisify(execFile);
export const HYPERFRAMES = "hyperframes@0.9.61";
const MAX_SECONDS = 90;
/** Ninguna versión pasa de esto (el bucket admite hasta 50 MB por archivo). */
export const MAX_REEL_BYTES = 40 * 1024 * 1024;
/** Calidad de las versiones: Instagram las vuelve a comprimir, así que más no se nota. */
const REEL_CRF = 23;
/** Proyectos por corrida; los demás quedan para la próxima (cada 5 minutos). */
const MAX_JOBS_PER_RUN = 3;
const SITE = (process.env.SITE_URL ?? "https://www.relojescarrasco.com").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET ?? "";
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../plantilla-reel");

/**
 * Tope de bitrate del video para que una versión de `seconds` segundos no
 * pase MAX_REEL_BYTES, con margen para el audio y el contenedor.
 * @param {number} seconds
 */
export function maxBitrate(seconds) {
  const kbps = Math.floor((MAX_REEL_BYTES * 8) / Math.max(1, seconds) / 1000) - 320;
  return `${Math.max(1500, Math.min(6000, kbps))}k`;
}

/** Palabras con tiempos: [{ text, start, end }]. */
export function readTranscript(json) {
  const list = Array.isArray(json)
    ? json
    : Array.isArray(json?.words)
      ? json.words
      : Array.isArray(json?.segments)
        ? json.segments.flatMap((s) => s.words ?? [])
        : [];
  return list.map((w) => ({ text: w.text ?? w.word ?? "", start: Number(w.start), end: Number(w.end) }));
}

async function durationOf(path) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]);
  return Number(stdout.trim());
}

async function ffmpeg(args) {
  await run("ffmpeg", ["-loglevel", "error", "-y", ...args], { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Último objeto JSON de la salida de un comando (con --json, HyperFrames
 * imprime el resumen al final).
 * @param {string} text
 */
export function lastJson(text) {
  for (const line of text.trim().split("\n").reverse()) {
    try {
      const value = JSON.parse(line);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // No es JSON: sigue con la línea anterior.
    }
  }
  return null;
}

async function transcribe(voicePath, workDir) {
  const dir = join(workDir, "transcripcion");
  await mkdir(dir, { recursive: true });
  // whisper local, modelo multilingüe en español. Nunca el motor de HeyGen (es pago).
  const { stdout } = await run(
    "npx",
    ["--yes", HYPERFRAMES, "transcribe", voicePath, "--engine", "whisper", "--model", "small", "--language", "es", "--json", "--dir", dir],
    { maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 }
  );
  const summary = lastJson(stdout);
  console.log(`Transcripción: ${summary?.wordCount ?? "?"} palabras (${summary?.engine ?? "whisper"} ${summary?.model ?? ""}).`);
  // HyperFrames la guarda en <dir>/transcript.json y avisa la ruta en el resumen.
  const path = typeof summary?.transcriptPath === "string" ? summary.transcriptPath : join(dir, "transcript.json");
  return readTranscript(JSON.parse(await readFile(path, "utf8")));
}

/** Subtítulos desde la voz; si no hay voz o no se pudo transcribir, desde el guion. */
async function captionGroups({ voice, voiceDuration, lineas, workDir }) {
  if (voice) {
    try {
      const groups = groupWords(cleanWords(await transcribe(voice, workDir), { mediaEnd: voiceDuration }));
      if (groups.length > 0) return { groups, source: "voz" };
      console.warn("La transcripción no devolvió palabras: se usan las líneas del guion.");
    } catch (error) {
      console.warn(`No se pudo transcribir la voz: se usan las líneas del guion. (${error instanceof Error ? error.message : error})`);
    }
  }
  return { groups: groupsFromScript(lineas), source: "guion" };
}

/**
 * Arma las versiones a partir de archivos locales. Lo usan el armado real y
 * la prueba de CI (video/worker/prueba.mjs).
 */
export async function armar({ rawVideo, rawVoice, voiceOffset = 0, script, title, product, workDir, quality = "looks" }) {
  const clip = join(workDir, "clip.mp4");
  await ffmpeg([
    "-i", rawVideo,
    "-t", String(MAX_SECONDS),
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-g", "30", "-movflags", "+faststart",
    clip,
  ]);
  const videoDuration = await durationOf(clip);
  if (!(videoDuration >= MINIMO_VIDEO)) {
    throw new Error(`El video dura ${videoDuration.toFixed(1)} s: tiene que durar al menos ${MINIMO_VIDEO} s.`);
  }

  let voice = null;
  let voiceDuration = 0;
  if (rawVoice) {
    voice = join(workDir, "voz.m4a");
    // Se recorta el desfase entre que arrancó la grabación y que arrancó el video.
    const offset = Math.min(10, Math.max(0, Number(voiceOffset) || 0));
    await ffmpeg([
      ...(offset > 0 ? ["-ss", offset.toFixed(2)] : []),
      "-i", rawVoice, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "160k", voice,
    ]);
    voiceDuration = await durationOf(voice);
  }

  const { groups, source } = await captionGroups({ voice, voiceDuration, lineas: script?.lineas ?? [], workDir });

  const projectDir = join(workDir, "proyecto");
  const built = await buildProject({
    templateDir: TEMPLATE_DIR,
    outDir: projectDir,
    clipPath: clip,
    voicePath: voice,
    videoDuration,
    voiceDuration,
    groups,
  });

  const hooks = (script?.ganchos ?? []).filter(Boolean);
  const rows = variantRows({ hooks: hooks.length ? hooks : [title], product: product ?? {} });
  await writeFile(join(projectDir, "rows.json"), JSON.stringify({ rows }));
  await run(
    "npx",
    [
      "--yes", HYPERFRAMES, "render", "--batch", "rows.json", "--output", "renders/{name}.mp4",
      "--quality", quality, "--crf", String(REEL_CRF), "--max-bitrate", maxBitrate(built.total), "--strict-variables",
    ],
    { cwd: projectDir, maxBuffer: 64 * 1024 * 1024, timeout: 25 * 60 * 1000 }
  );

  const reels = [];
  for (const [index, row] of rows.entries()) {
    const path = join(projectDir, "renders", `${row.name}.mp4`);
    const { size } = await stat(path);
    if (!size) throw new Error(`La versión ${index + 1} salió vacía.`);
    if (size > MAX_REEL_BYTES + 5 * 1024 * 1024) throw new Error(`La versión ${index + 1} salió demasiado pesada.`);
    reels.push({
      name: row.name,
      file: `${row.name}.mp4`,
      path,
      size,
      gancho: row.gancho,
      estilo: row.estilo,
      duration: Math.round((await durationOf(path)) * 10) / 10,
    });
  }
  return { reels, total: built.total, captions: built.captions, captionSource: source, withVoice: Boolean(voice) };
}

// ------------------------------------------------------------
// Armado real: toma los proyectos en cola del sitio
// ------------------------------------------------------------
async function api(path, body = {}) {
  const response = await fetch(SITE + path, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error ?? `El sitio respondió ${response.status} en ${path}`);
  return json;
}

/** Descarga un archivo y devuelve cuántos bytes ocupa. */
async function download(url, path) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar un archivo (${response.status}).`);
  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(path, data);
  return data.length;
}

async function processJob(job, workDir) {
  const rawVideo = join(workDir, "original");
  const videoBytes = await download(job.videoUrl, rawVideo);
  let rawVoice = null;
  let voiceBytes = 0;
  if (job.voiceUrl) {
    rawVoice = join(workDir, "voz-original");
    voiceBytes = await download(job.voiceUrl, rawVoice);
  }

  const result = await armar({
    rawVideo,
    rawVoice,
    voiceOffset: job.voiceOffset,
    script: job.script,
    title: job.title,
    product: job.product,
    workDir,
  });

  const uploads = await api("/api/video/trabajo/subidas", { id: job.id, files: result.reels.map((r) => r.file) });
  for (const [index, reel] of result.reels.entries()) {
    const response = await fetch(uploads.urls[reel.file], {
      method: "PUT",
      headers: { "content-type": "video/mp4", "x-upsert": "true" },
      body: await readFile(reel.path),
    });
    if (!response.ok) throw new Error(`No se pudo subir la versión ${index + 1} (${response.status}).`);
  }

  return {
    reels: result.reels.map(({ name, file, gancho, estilo, duration }) => ({ name, file, gancho, estilo, duration })),
    captions: result.captions,
    captionSource: result.captionSource,
    withVoice: result.withVoice,
    storageBytes: videoBytes + voiceBytes + result.reels.reduce((sum, reel) => sum + reel.size, 0),
  };
}

async function main() {
  if (!SECRET) throw new Error("Falta CRON_SECRET.");
  for (let done = 0; done < MAX_JOBS_PER_RUN; done++) {
    const job = await api("/api/video/trabajo/tomar");
    if (!job) {
      if (done === 0) console.log("No hay videos en cola.");
      return;
    }
    console.log(`Armando los reels de «${job.title}».`);
    const workDir = await mkdtemp(join(tmpdir(), "reel-"));
    try {
      const result = await processJob(job, workDir);
      await api("/api/video/trabajo/terminar", { id: job.id, ok: true, ...result });
      console.log(`Listo: ${result.reels.length} versiones (subtítulos desde ${result.captionSource}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`No se pudo armar: ${message}`);
      await api("/api/video/trabajo/terminar", { id: job.id, ok: false, error: message.slice(0, 300) }).catch(() => {});
      process.exitCode = 1;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
