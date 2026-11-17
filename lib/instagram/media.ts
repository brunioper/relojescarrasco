/**
 * Historias y publicaciones devueltas por la API de Instagram (lógica pura).
 */

export type GraphMedia = {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  permalink?: string;
};

export type MediaSource = "historia" | "publicacion";

export type SourcedMedia = GraphMedia & { source: MediaSource };

export const MAX_IMAGES_PER_ITEM = 10;

/**
 * Imagen usable de una pieza de Instagram. Los videos (y las historias con
 * música con derechos, que no traen media_url) usan su miniatura.
 */
export function imageUrlOf(media: GraphMedia): string | null {
  if (media.media_type === "VIDEO") return media.thumbnail_url ?? null;
  if (media.media_type === "IMAGE") return media.media_url ?? null;
  return null;
}

/**
 * Piezas nuevas para procesar: publicadas desde que se conectó la cuenta,
 * todavía no vistas, de la más vieja a la más nueva.
 */
export function selectNewMedia(
  items: SourcedMedia[],
  options: { watchSince: Date; knownIds: Set<string>; max: number }
): SourcedMedia[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id) || options.knownIds.has(item.id)) return false;
      seen.add(item.id);
      const posted = item.timestamp ? new Date(item.timestamp) : null;
      return posted !== null && !Number.isNaN(posted.getTime()) && posted >= options.watchSince;
    })
    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())
    .slice(0, options.max);
}

/** Extensión de archivo para guardar una imagen descargada. */
export function imageExtension(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}
