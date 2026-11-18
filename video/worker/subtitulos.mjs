/**
 * Subtítulos de un reel (lógica pura, sin red ni archivos).
 *
 * Con voz: palabras con sus tiempos (de la transcripción de la voz del dueño).
 * Sin voz: las líneas del guion se muestran como texto, repartidas en su tramo.
 */

/** @typedef {{ text: string, start: number, end: number }} Palabra */
/** @typedef {{ start: number, end: number, words: Palabra[] }} Grupo */

const NON_WORD = /^[\s♪�.,;:!?¡¿…\-–—"'()[\]]*$/;

/** Limpia la transcripción: sin símbolos sueltos ni palabras después del final del audio. */
/**
 * @param {Array<{ text?: unknown, start: unknown, end: unknown }>} words
 * @param {{ mediaEnd?: number }} [options]
 * @returns {Palabra[]}
 */
export function cleanWords(words, { mediaEnd } = {}) {
  return words
    .map((w) => ({ text: String(w.text ?? "").trim(), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.text && !NON_WORD.test(w.text) && Number.isFinite(w.start) && Number.isFinite(w.end))
    .filter((w) => mediaEnd === undefined || w.start < mediaEnd - 0.05)
    .map((w) => ({ ...w, end: Math.max(w.end, w.start + 0.08) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Agrupa palabras de a pocas: corta al llegar al máximo, en un punto o coma,
 * o en una pausa. Un grupo arranca al menos a los 0,1 s y no pisa al siguiente.
 */
/**
 * @param {Palabra[]} words
 * @param {{ maxWords?: number, maxChars?: number, pause?: number }} [options]
 * @returns {Grupo[]}
 */
export function groupWords(words, { maxWords = 4, maxChars = 20, pause = 0.15 } = {}) {
  const groups = [];
  let current = [];
  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
  };
  for (const [index, word] of words.entries()) {
    const previous = words[index - 1];
    const chars = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
    if (current.length && (current.length >= maxWords || chars > maxChars || word.start - previous.end >= pause)) {
      flush();
    }
    current.push(word);
    if (/[.!?…,;:]$/.test(word.text)) flush();
  }
  flush();

  return groups.map((group, i) => {
    const next = groups[i + 1];
    const start = Math.max(0.1, group[0].start - 0.05);
    const tail = group[group.length - 1].end + 0.25;
    const end = next ? Math.min(tail, Math.max(next[0].start - 0.05, group[group.length - 1].end)) : tail;
    return { start: round(start), end: round(Math.max(end, start + 0.3)), words: group.map(roundWord) };
  });
}

/** Sin voz: cada línea del guion se divide en grupos repartidos en su tramo. */
/**
 * @param {Array<{ desde: number, hasta: number, texto: string }>} lineas
 * @param {{ maxWords?: number, maxChars?: number }} [options]
 * @returns {Grupo[]}
 */
export function groupsFromScript(lineas, { maxWords = 4, maxChars = 20 } = {}) {
  const groups = [];
  for (const linea of lineas) {
    const words = String(linea.texto).split(/\s+/).filter(Boolean);
    if (!words.length || !(linea.hasta > linea.desde)) continue;
    const chunks = [];
    let chunk = [];
    for (const word of words) {
      const chars = chunk.reduce((n, w) => n + w.length + 1, 0) + word.length;
      if (chunk.length && (chunk.length >= maxWords || chars > maxChars)) {
        chunks.push(chunk);
        chunk = [];
      }
      chunk.push(word);
    }
    if (chunk.length) chunks.push(chunk);
    const span = (linea.hasta - linea.desde) / words.length;
    let cursor = Math.max(0.1, linea.desde);
    for (const chunk of chunks) {
      const start = cursor;
      const end = start + span * chunk.length;
      const step = (end - start) / chunk.length;
      groups.push({
        start: round(start),
        end: round(end),
        words: chunk.map((text, k) => ({ text, start: round(start + k * step), end: round(start + (k + 1) * step) })),
      });
      cursor = end;
    }
  }
  return groups;
}

/** Corta los subtítulos que quedarían después del final del video. */
/**
 * @param {Grupo[]} groups
 * @param {number} limit
 * @returns {Grupo[]}
 */
export function clampGroups(groups, limit) {
  return groups
    .filter((g) => g.start < limit - 0.2)
    .map((g) => ({
      ...g,
      end: round(Math.min(g.end, limit)),
      words: g.words.filter((w) => w.start < limit).map((w) => ({ ...w, end: round(Math.min(w.end, limit)) })),
    }))
    .filter((g) => g.words.length > 0 && g.end > g.start);
}

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Marcado de los grupos para la plantilla (un elemento con tiempo por grupo). */
/** @param {Grupo[]} groups @returns {string} */
export function captionsHtml(groups) {
  return groups
    .map(
      (g, i) =>
        `<div id="sub-${i}" class="grupo clip" data-start="${g.start}" data-duration="${round(g.end - g.start)}" data-track-index="6">` +
        `<span class="caja-sub">` + g.words.map((w) => `<span class="p">${escapeHtml(w.text)}</span>`).join("") + `</span>` +
        `</div>`
    )
    .join("\n        ");
}

/** Lo mínimo que necesita la animación (tiempos absolutos). */
/** @param {Grupo[]} groups */
export function captionsData(groups) {
  return groups.map((g) => ({ start: g.start, end: g.end, words: g.words.map((w) => ({ start: w.start, end: w.end })) }));
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function roundWord(w) {
  return { text: w.text, start: round(w.start), end: round(w.end) };
}
