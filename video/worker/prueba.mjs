#!/usr/bin/env node
/**
 * Prueba del armado completo en esta máquina, sin el sitio ni Supabase: un
 * video de prueba, una voz en español (espeak-ng, solo para la prueba) y las
 * 3 versiones en calidad borrador, más la revisión de HyperFrames sobre el
 * proyecto armado. La corre .github/workflows/reels-prueba.yml cuando cambia
 * algo de video/.
 *
 *   node video/worker/prueba.mjs [carpeta-de-salida]
 *
 * Con REQUIRE_TRANSCRIPTION=1 falla si whisper no devuelve palabras.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { HYPERFRAMES, MAX_REEL_BYTES, armar } from "./procesar.mjs";
import { CIERRE_DURACION, CIERRE_SOLAPE } from "./proyecto.mjs";

const run = promisify(execFile);
const outDir = resolve(process.argv[2] ?? "reels-prueba");
const requireTranscription = process.env.REQUIRE_TRANSCRIPTION === "1";

const SCRIPT = {
  ganchos: ["¿Buscás un Datejust?", "Esfera azul, Jubilee", "¿Lo querés ver de cerca?"],
  lineas: [
    { desde: 0, hasta: 2.5, texto: "¿Buscás un Datejust?" },
    { desde: 2.5, hasta: 6, texto: "Esfera azul y brazalete Jubilee." },
    { desde: 6, hasta: 9, texto: "Escribinos por mensaje directo." },
  ],
  texto_posteo: "Rolex Datejust 41.",
  hashtags: ["rolex"],
  notas: "",
};

const workDir = await mkdtemp(join(tmpdir(), "reel-prueba-"));
try {
  const rawVideo = join(workDir, "original.mp4");
  // Video horizontal a propósito: tiene que salir recortado a vertical.
  await run("ffmpeg", [
    "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=9",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", rawVideo,
  ]);

  let rawVoice = null;
  try {
    rawVoice = join(workDir, "voz.wav");
    await run("espeak-ng", [
      "-v", "es-419", "-s", "140", "-w", rawVoice,
      "¿Buscás un Datejust? Esfera azul y brazalete Jubilee. Escribinos por mensaje directo.",
    ]);
  } catch {
    rawVoice = null;
    assert.ok(!requireTranscription, "Falta espeak-ng para generar la voz de prueba.");
    console.warn("Sin espeak-ng: se prueba sin voz.");
  }

  const started = Date.now();
  const result = await armar({
    rawVideo,
    rawVoice,
    script: SCRIPT,
    title: "Prueba",
    product: { brand: "Rolex", model: "Datejust", reference: "126334", price: "US$ 16.000" },
    workDir,
    quality: "draft",
  });
  const seconds = Math.round((Date.now() - started) / 1000);

  assert.equal(result.reels.length, 3, "Tienen que salir 3 versiones.");
  const expected = 9 - CIERRE_SOLAPE + CIERRE_DURACION;
  for (const reel of result.reels) {
    assert.ok(reel.size > 50_000 && reel.size < MAX_REEL_BYTES, `${reel.file}: tamaño raro (${reel.size} bytes).`);
    assert.ok(Math.abs(reel.duration - expected) < 0.6, `${reel.file}: dura ${reel.duration} s y debería durar ${expected} s.`);
  }
  assert.ok(result.captions > 0, "No salieron subtítulos.");
  if (requireTranscription) assert.equal(result.captionSource, "voz", "whisper no devolvió palabras.");

  // Revisión de HyperFrames sobre el proyecto ya armado: sin errores y nada
  // fuera de la zona que no tapa la interfaz de Instagram.
  const checked = await run("npx", ["--yes", HYPERFRAMES, "check", "--json"], {
    cwd: join(workDir, "proyecto"),
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  }).catch((error) => ({ stdout: String(error.stdout ?? "") }));
  const report = JSON.parse(checked.stdout);
  assert.ok(report.lint && report.runtime && report.layout, "La revisión de HyperFrames no corrió completa.");
  assert.ok(!report.browserSkipped, "La revisión de HyperFrames no pudo abrir el navegador.");
  const findings = ["lint", "runtime", "layout"].flatMap((stage) => report[stage]?.findings ?? []);
  const problems = findings.filter(
    (f) => f.severity === "error" || (f.code === "outside_safe_zone" && /instagram/i.test(f.message))
  );
  assert.equal(problems.length, 0, `La revisión de la plantilla encontró: ${problems.map((f) => f.message).join(" | ")}`);

  await mkdir(outDir, { recursive: true });
  for (const reel of result.reels) await copyFile(reel.path, join(outDir, reel.file));
  console.log(
    JSON.stringify(
      {
        ok: true,
        segundos: seconds,
        subtitulos: result.captions,
        desde: result.captionSource,
        revision: {
          avisos: findings.length,
          muestrasDeLayout: report.layout.samples?.length ?? 0,
        },
        versiones: result.reels.map(({ file, size, duration, estilo }) => ({ file, size, duration, estilo })),
      },
      null,
      2
    )
  );
} finally {
  await rm(workDir, { recursive: true, force: true });
}
