import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { frameTimes, lineFits, normalizeScript, postText, type ReelScript } from "@/lib/video/script";
import {
  captionsHtml,
  clampGroups,
  cleanWords,
  groupWords,
  groupsFromScript,
} from "@/video/worker/subtitulos.mjs";
import { fillTemplate, timings, variantRows } from "@/video/worker/proyecto.mjs";
import { MAX_REEL_BYTES, lastJson, maxBitrate, readTranscript } from "@/video/worker/procesar.mjs";

const word = (text: string, start: number, end: number) => ({ text, start, end });

describe("subtítulos desde la voz", () => {
  it("limpia símbolos y palabras después del final del audio", () => {
    const words = cleanWords(
      [word("Hola", 0.2, 0.5), word("♪", 0.6, 0.9), word("", 1, 1.2), word("gracias", 9.9, 10.4)],
      { mediaEnd: 9.95 }
    );
    expect(words.map((w) => w.text)).toEqual(["Hola"]);
  });

  it("agrupa de a pocas palabras y corta en signos y pausas", () => {
    const groups = groupWords([
      word("Este", 0.3, 0.5),
      word("Rolex", 0.5, 0.9),
      word("Datejust,", 0.9, 1.4),
      word("esfera", 1.5, 1.8),
      word("azul", 1.8, 2.1),
      word("con", 2.6, 2.7),
      word("diamantes", 2.7, 3.2),
    ]);
    expect(groups.map((g) => g.words.map((w) => w.text).join(" "))).toEqual([
      "Este Rolex Datejust,",
      "esfera azul",
      "con diamantes",
    ]);
    for (let i = 1; i < groups.length; i++) expect(groups[i]!.start).toBeGreaterThanOrEqual(groups[i - 1]!.end);
    expect(groups[0]!.start).toBeGreaterThanOrEqual(0.1);
  });

  it("no arma grupos más largos que una línea", () => {
    const groups = groupWords([word("Automático", 0, 0.5), word("certificado", 0.5, 1), word("cronómetro", 1, 1.5)]);
    for (const g of groups) expect(g.words.map((w) => w.text).join(" ").length).toBeLessThanOrEqual(24);
  });
});

describe("subtítulos desde el guion (sin voz)", () => {
  it("reparte cada línea en su tramo, en orden y sin pasarse", () => {
    const groups = groupsFromScript([
      { desde: 3, hasta: 6, texto: "Rolex Datejust de 41 milímetros, esfera azul." },
      { desde: 6.5, hasta: 9, texto: "Escribinos por mensaje directo." },
    ]);
    expect(groups[0]!.start).toBe(3);
    expect(groups.filter((g) => g.end <= 6.01).length).toBeGreaterThan(1);
    expect(groups.at(-1)!.end).toBeLessThanOrEqual(9.01);
    for (const g of groups) expect(g.words.map((w) => w.text).join(" ").length).toBeLessThanOrEqual(24);
  });

  it("recorta lo que queda después del cierre", () => {
    const groups = clampGroups(groupsFromScript([{ desde: 1, hasta: 10, texto: "uno dos tres cuatro cinco seis siete ocho" }]), 5);
    expect(groups.every((g) => g.end <= 5)).toBe(true);
  });

  it("escapa el texto al armar el HTML", () => {
    const html = captionsHtml([{ start: 1, end: 2, words: [{ text: "<b>hola</b>", start: 1, end: 2 }] }]);
    expect(html).toContain("&lt;b&gt;hola&lt;/b&gt;");
    expect(html).toContain('id="sub-0"');
    expect(html).toContain('class="grupo clip"');
  });
});

describe("proyecto de HyperFrames", () => {
  const template = readFileSync("video/plantilla-reel/index.html", "utf8");

  it("completa todos los marcadores de la plantilla", () => {
    const filled = fillTemplate(template, {
      videoDuration: 13.2,
      voiceDuration: 12,
      groups: [{ start: 1, end: 2, words: [{ text: "hola", start: 1, end: 2 }] }],
    });
    expect(filled.html).not.toMatch(/__[A-Z_]+__/);
    expect(filled.html).toContain('id="voz"');
    expect(filled.html).toContain('data-duration="' + filled.total + '"');
    expect(filled.captions).toBe(1);
  });

  it("sin voz no agrega audio; el video corto se estira al mínimo", () => {
    const filled = fillTemplate(template, { videoDuration: 3, voiceDuration: 0, groups: [] });
    expect(filled.html).not.toContain('id="voz"');
    expect(timings(3).video).toBe(6);
    expect(filled.total).toBeGreaterThan(filled.video);
  });

  it("una versión por gancho, con estilos distintos y los datos del producto", () => {
    const rows = variantRows({
      hooks: ["Uno", "Dos", "Tres", "Cuatro"],
      product: { brand: "Rolex", model: "Datejust", reference: "126334", price: "US$ 16.000" },
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.estilo)).toEqual(["elegante", "impacto", "pregunta"]);
    expect(rows[0]).toMatchObject({ name: "version-1", gancho: "Uno", referencia: "Ref. 126334", usuario: "@relojes_carrasco" });
  });

  it("limita el bitrate para que ninguna versión pase el tope de peso", () => {
    expect(maxBitrate(12)).toBe("6000k");
    const longest = 90 + 3.2;
    const kbps = Number.parseInt(maxBitrate(longest), 10);
    // Video al tope + audio de 192 kbps: entra en el máximo por archivo.
    expect(((kbps + 192) * 1000 * longest) / 8).toBeLessThan(MAX_REEL_BYTES);
  });

  it("toma el resumen JSON del final de la salida de HyperFrames", () => {
    const stdout = 'npm warn algo\n{"ok":true,"wordCount":12,"transcriptPath":"/tmp/t/transcript.json"}\n';
    expect(lastJson(stdout)).toMatchObject({ wordCount: 12, transcriptPath: "/tmp/t/transcript.json" });
    expect(lastJson("sin json")).toBeNull();
  });

  it("lee la transcripción en sus formatos posibles", () => {
    expect(readTranscript([{ id: "w0", text: "Hola", start: 0, end: 0.5 }])).toEqual([{ text: "Hola", start: 0, end: 0.5 }]);
    expect(readTranscript({ words: [{ word: "Hola", start: 0, end: 0.5 }] })).toEqual([{ text: "Hola", start: 0, end: 0.5 }]);
    expect(readTranscript({ segments: [{ words: [{ text: "Hola", start: 0, end: 1 }] }] })).toHaveLength(1);
  });
});

const script = (overrides: Partial<ReelScript> = {}): ReelScript => ({
  ganchos: ["¿Buscás un Datejust?", "¿Buscás un Datejust?", "Esfera azul", "Cuarto"],
  lineas: [
    { desde: 5, hasta: 9, texto: "  Segunda   línea " },
    { desde: 0, hasta: 2.5, texto: "Primera" },
    { desde: 9, hasta: 40, texto: "Se pasa del video" },
    { desde: 3, hasta: 3, texto: "Vacía" },
  ],
  texto_posteo: "Rolex Datejust 41.",
  hashtags: ["#rolex", "relojes uruguay", "datejust", "rolex"],
  notas: "Hablá  despacio.",
  ...overrides,
});

describe("guion", () => {
  it("ordena, recorta al video y limpia ganchos y hashtags", () => {
    const normalized = normalizeScript(script(), 12);
    expect(normalized.ganchos).toEqual(["¿Buscás un Datejust?", "Esfera azul", "Cuarto"]);
    expect(normalized.lineas.map((l) => l.texto)).toEqual(["Primera", "Segunda línea", "Se pasa del video"]);
    expect(normalized.lineas.at(-1)!.hasta).toBe(12);
    expect(normalized.hashtags).toEqual(["rolex", "relojesuruguay", "datejust"]);
    expect(normalized.notas).toBe("Hablá despacio.");
  });

  it("avisa cuando una línea no entra en su tramo", () => {
    expect(lineFits({ desde: 0, hasta: 3, texto: "Rolex Datejust con esfera azul" })).toBe(true);
    expect(lineFits({ desde: 0, hasta: 1, texto: "Rolex Datejust de cuarenta y un milímetros" })).toBe(false);
  });

  it("arma el texto del posteo con hashtags y reparte los cuadros que mira la IA", () => {
    expect(postText({ texto_posteo: "Hola", hashtags: ["rolex"] })).toBe("Hola\n\n#rolex");
    const times = frameTimes(12, 6);
    expect(times).toHaveLength(6);
    expect(times[0]).toBeGreaterThan(0);
    expect(times.at(-1)!).toBeLessThan(12);
  });
});
