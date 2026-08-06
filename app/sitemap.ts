import type { MetadataRoute } from "next";
import { fetchAllSlugs } from "@/services/catalogue";
import { publicEnv } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const products = await fetchAllSlugs();

  return [
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/sobre-nosotros`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contacto`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    ...products.map((p) => ({
      url: `${base}/catalogo/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
