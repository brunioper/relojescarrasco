import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/auth", "/auth/", "/api/"],
      },
    ],
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
