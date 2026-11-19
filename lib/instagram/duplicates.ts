/**
 * ¿Lo que se ve en una historia o publicación ya está en el catálogo?
 *
 * Lógica pura (sin acceso a datos). Es deliberadamente conservadora: ante
 * la duda devuelve coincidencias, porque una coincidencia de más solo pide
 * una aprobación, mientras que una de menos publica un duplicado.
 */

export type CatalogCandidate = {
  id: string;
  name: string;
  brand: string;
  model: string | null;
  reference_number: string | null;
  category: "reloj" | "accesorio";
  status: string;
};

export type DetectedProduct = {
  category: "reloj" | "accesorio";
  brand: string | null;
  model: string | null;
  reference_number: string | null;
};

export type CatalogMatch = {
  productId: string;
  reason: "referencia" | "modelo" | "marca";
};

/** Minúsculas, sin acentos ni signos, espacios simples. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Referencia comparable: "166.032" y "166032" son la misma. */
export function normalizeReference(value: string | null | undefined): string {
  return normalizeText(value).replace(/ /g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j]!;
      previous[j] = Math.min(
        above + 1,
        previous[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[b.length]!;
}

/** Misma marca, tolerando errores de tipeo ("Citzen", "Tag Heur"). */
export function sameBrand(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const shortest = Math.min(x.length, y.length);
  if (shortest < 5) return false;
  return levenshtein(x, y) <= (shortest >= 8 ? 2 : 1);
}

/** Mismo modelo: iguales, o todas las palabras del más corto están en el otro. */
export function sameModel(detected: string | null | undefined, existing: string | null | undefined): boolean {
  const x = normalizeText(detected);
  const y = normalizeText(existing);
  if (!x || !y) return false;
  if (x === y) return true;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  if (shorter.replace(/ /g, "").length < 3) return false;
  const words = new Set(longer.split(" "));
  return shorter.split(" ").every((word) => words.has(word));
}

const REASON_ORDER: Record<CatalogMatch["reason"], number> = { referencia: 0, modelo: 1, marca: 2 };

export function findCatalogMatches(
  detected: DetectedProduct,
  candidates: CatalogCandidate[],
  limit = 5
): CatalogMatch[] {
  const reference = normalizeReference(detected.reference_number);
  const matches: CatalogMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.status === "archivado" || candidate.category !== detected.category) continue;

    const candidateReference = normalizeReference(candidate.reference_number);
    if (reference.length >= 3 && reference === candidateReference) {
      matches.push({ productId: candidate.id, reason: "referencia" });
      continue;
    }

    if (!sameBrand(detected.brand, candidate.brand)) continue;

    if (detected.model) {
      // Si el producto no tiene modelo cargado, se compara contra su nombre.
      if (sameModel(detected.model, candidate.model || candidate.name)) {
        matches.push({ productId: candidate.id, reason: "modelo" });
      }
    } else {
      // Se leyó la marca pero no el modelo: puede ser cualquiera de esa marca.
      matches.push({ productId: candidate.id, reason: "marca" });
    }
  }

  return matches.sort((a, b) => REASON_ORDER[a.reason] - REASON_ORDER[b.reason]).slice(0, limit);
}
