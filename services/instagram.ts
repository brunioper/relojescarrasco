import "server-only";

import { serverEnv } from "@/lib/env";

/**
 * Importación de fotos desde un post público de Instagram.
 *
 * Instagram bloquea de forma agresiva las descargas hechas desde IPs de
 * servidores/nube (como las de Vercel), incluso para posts públicos: no
 * es un error de la aplicación, es su protección antibots. Por eso el
 * orden de intentos es:
 *
 *   1. oEmbed OFICIAL de Meta (graph.facebook.com/instagram_oembed) —
 *      requiere META_APP_ID + META_APP_SECRET (gratis, sin revisión de
 *      la app; ver docs/LIMITATIONS.md). Es una llamada de API legítima,
 *      no scraping, por lo que es el método confiable. Limitación:
 *      Meta solo entrega la foto de portada (thumbnail_url), nunca
 *      el carrusel completo.
 *   2. Scraping del HTML del post (og:image + JSON embebido) como
 *      respaldo sin configuración adicional. Suele fallar desde
 *      servidores, pero no cuesta nada intentarlo.
 *   3. Página /embed/captioned/ como último intento de scraping.
 *
 * Si nada funciona (lo más común sin oEmbed configurado), la app
 * indica claramente que se suban las fotos manualmente.
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

/**
 * oEmbed oficial de Meta para Instagram. A diferencia del scraping,
 * es una llamada de API legítima (no imita un navegador) y por eso
 * no la bloquean las protecciones antibots de Instagram.
 * Requiere una app gratuita de Meta for Developers (sin revisión):
 * ver docs/LIMITATIONS.md § "Importación de fotos desde Instagram".
 */
async function fetchViaOfficialOEmbed(postUrl: string): Promise<string[] | null> {
  const { META_APP_ID: appId, META_APP_SECRET: appSecret } = serverEnv();
  if (!appId || !appSecret) return null;

  try {
    const endpoint = new URL("https://graph.facebook.com/v21.0/instagram_oembed");
    endpoint.searchParams.set("url", postUrl);
    endpoint.searchParams.set("access_token", `${appId}|${appSecret}`);

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { thumbnail_url?: string };
    return body.thumbnail_url ? [body.thumbnail_url] : null;
  } catch {
    return null;
  }
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

  // Intento 1: oEmbed oficial de Meta (confiable, pero solo trae la portada)
  const oEmbedUrls = await fetchViaOfficialOEmbed(postUrl);
  if (oEmbedUrls && oEmbedUrls.length > 0) return { ok: true, urls: oEmbedUrls };

  // Intento 2: página del post (scraping; Instagram suele bloquear IPs de servidor)
  const postHtml = await fetchHtml(`https://www.instagram.com/p/${shortcode}/`);
  if (postHtml) {
    const urls = parseImageUrlsFromHtml(postHtml);
    if (urls.length > 0) return { ok: true, urls };
  }

  // Intento 3: versión embed (no suele exigir login)
  const embedHtml = await fetchHtml(
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`
  );
  if (embedHtml) {
    const urls = parseImageUrlsFromHtml(embedHtml);
    if (urls.length > 0) return { ok: true, urls };
  }

  const hasOEmbedCreds = Boolean(serverEnv().META_APP_ID && serverEnv().META_APP_SECRET);
  return {
    ok: false,
    error: hasOEmbedCreds
      ? "No se pudo obtener la foto del post. Verifique que el enlace sea correcto y que el post sea público."
      : "Instagram bloqueó la descarga automática (protección antibots del servidor). Para que funcione de forma confiable, configure la importación oficial de Meta (ver documentación) o suba las fotos manualmente.",
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
