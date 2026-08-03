import "server-only";

/**
 * Importación de fotos desde un post público de Instagram.
 *
 * Instagram no ofrece API pública para leer imágenes de posts, por lo que
 * se extraen del HTML del post (metadatos og:image y JSON embebido) con
 * varios intentos en orden:
 *   1. Página del post (og:image + display_url del carrusel)
 *   2. Página /embed/captioned/ (pensada para embeber, suele no exigir login)
 *
 * Limitaciones documentadas: solo posts públicos; en carruseles Instagram
 * puede exponer únicamente la primera imagen; si Instagram bloquea la IP
 * del servidor, la importación falla y queda la subida manual.
 */

const SHORTCODE_RE =
  /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]{5,})/;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export function extractInstagramShortcode(url: string): string | null {
  const match = url.match(SHORTCODE_RE);
  return match?.[1] ?? null;
}

function unescapeJsonUrl(raw: string): string {
  return raw.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

/** Extrae URLs de imagen del HTML de Instagram (og:image, display_url, embed). */
export function parseImageUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];

  // 1. Imágenes del carrusel embebidas en JSON ("display_url":"https:\/\/...")
  for (const match of html.matchAll(/"display_url"\s*:\s*"(https:[^"]+)"/g)) {
    urls.push(unescapeJsonUrl(match[1]!));
  }

  // 2. og:image (portada del post)
  const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  if (og?.[1]) urls.push(og[1].replace(/&amp;/g, "&"));

  // 3. Imagen del embed (<img class="EmbeddedMediaImage" src="...">)
  const embed = html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/);
  if (embed?.[1]) urls.push(embed[1].replace(/&amp;/g, "&"));

  // Deduplicar por pathname (la misma foto aparece con distintos query params)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    try {
      const key = new URL(url).pathname;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(url);
      }
    } catch {
      // URL inválida: se descarta
    }
  }
  return unique.slice(0, 10);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchInstagramImageUrls(
  postUrl: string
): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  const shortcode = extractInstagramShortcode(postUrl);
  if (!shortcode) {
    return {
      ok: false,
      error: "El enlace no parece un post de Instagram (use el enlace del post, ej. instagram.com/p/…).",
    };
  }

  // Intento 1: página del post
  const postHtml = await fetchHtml(`https://www.instagram.com/p/${shortcode}/`);
  if (postHtml) {
    const urls = parseImageUrlsFromHtml(postHtml);
    if (urls.length > 0) return { ok: true, urls };
  }

  // Intento 2: versión embed (no suele exigir login)
  const embedHtml = await fetchHtml(
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`
  );
  if (embedHtml) {
    const urls = parseImageUrlsFromHtml(embedHtml);
    if (urls.length > 0) return { ok: true, urls };
  }

  return {
    ok: false,
    error:
      "No se pudieron extraer las fotos. Verifique que el post sea público; si Instagram bloquea la descarga, suba las fotos manualmente.",
  };
}

/** Descarga una imagen de la CDN de Instagram y valida tipo y tamaño. */
export async function downloadImage(
  url: string
): Promise<{ ok: true; data: ArrayBuffer; contentType: string } | { ok: false }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Referer: "https://www.instagram.com/" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false };

    const contentType = response.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp)/.test(contentType)) return { ok: false };

    const data = await response.arrayBuffer();
    if (data.byteLength === 0 || data.byteLength > 10 * 1024 * 1024) return { ok: false };

    return { ok: true, data, contentType: contentType.split(";")[0]! };
  } catch {
    return { ok: false };
  }
}
