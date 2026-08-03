import { describe, expect, it } from "vitest";

// services/instagram.ts importa lib/env.ts (para las credenciales opcionales
// de oEmbed), que valida las variables públicas al cargar el módulo.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x".repeat(30);
process.env.SUPABASE_SERVICE_ROLE_KEY = "y".repeat(30);

const { extractInstagramShortcode, parseImageUrlsFromHtml } = await import("@/services/instagram");

describe("extracción de shortcode de Instagram", () => {
  it("acepta enlaces de post, reel y tv", () => {
    expect(extractInstagramShortcode("https://www.instagram.com/p/Cxy_12-Ab3d/")).toBe("Cxy_12-Ab3d");
    expect(extractInstagramShortcode("https://instagram.com/reel/AbCdEf123/?igsh=x")).toBe("AbCdEf123");
    expect(extractInstagramShortcode("https://www.instagram.com/tv/XYZ98765/")).toBe("XYZ98765");
  });

  it("acepta enlaces con nombre de usuario en la ruta", () => {
    expect(
      extractInstagramShortcode("https://www.instagram.com/relojescarrasco/p/Cxy12Ab3d/")
    ).toBe("Cxy12Ab3d");
  });

  it("rechaza enlaces que no son de posts", () => {
    expect(extractInstagramShortcode("https://www.instagram.com/relojescarrasco/")).toBeNull();
    expect(extractInstagramShortcode("https://ejemplo.com/p/ABC123/")).toBeNull();
    expect(extractInstagramShortcode("no es un enlace")).toBeNull();
  });
});

describe("extracción de URLs de imagen del HTML", () => {
  it("extrae og:image", () => {
    const html = '<meta property="og:image" content="https://scontent.cdninstagram.com/v/foto1.jpg?x=1&amp;y=2" />';
    expect(parseImageUrlsFromHtml(html)).toEqual([
      "https://scontent.cdninstagram.com/v/foto1.jpg?x=1&y=2",
    ]);
  });

  it("extrae display_url del carrusel con unescape de JSON", () => {
    const html =
      '{"display_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/carrusel1.jpg?a=1\\u0026b=2"},{"display_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/carrusel2.jpg"}';
    const urls = parseImageUrlsFromHtml(html);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://scontent.cdninstagram.com/v/carrusel1.jpg?a=1&b=2");
    expect(urls[1]).toBe("https://scontent.cdninstagram.com/v/carrusel2.jpg");
  });

  it("deduplica la misma foto con distintos query params", () => {
    const html =
      '{"display_url":"https:\\/\\/cdn.ig\\/foto.jpg?v=1"}<meta property="og:image" content="https://cdn.ig/foto.jpg?v=2" />';
    expect(parseImageUrlsFromHtml(html)).toHaveLength(1);
  });

  it("extrae la imagen del embed", () => {
    const html = '<img class="EmbeddedMediaImage" alt="" src="https://cdn.ig/embed.jpg?x=1&amp;y=2">';
    expect(parseImageUrlsFromHtml(html)).toEqual(["https://cdn.ig/embed.jpg?x=1&y=2"]);
  });

  it("limita a 10 imágenes", () => {
    const html = Array.from(
      { length: 15 },
      (_, i) => `{"display_url":"https:\\/\\/cdn.ig\\/foto${i}.jpg"}`
    ).join(",");
    expect(parseImageUrlsFromHtml(html)).toHaveLength(10);
  });

  it("HTML sin imágenes devuelve vacío", () => {
    expect(parseImageUrlsFromHtml("<html><body>login requerido</body></html>")).toEqual([]);
  });
});
