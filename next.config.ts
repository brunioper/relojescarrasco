import type { NextConfig } from "next";

// En los despliegues de prueba (Preview) de Vercel la integración de Supabase
// define SUPABASE_URL pero no NEXT_PUBLIC_SUPABASE_URL: se usa como respaldo
// para que las ramas tengan una versión de prueba funcionando.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// URL del propio despliegue de prueba (para links y metadatos en Preview).
const previewSiteUrl =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;
const siteUrlEnv = process.env.NEXT_PUBLIC_SITE_URL || previewSiteUrl;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "localhost";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    ...(supabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl } : {}),
    ...(siteUrlEnv ? { NEXT_PUBLIC_SITE_URL: siteUrlEnv } : {}),
  },
  images: {
    // Las fotos de producto ya se comprimen y convierten a WebP en el
    // navegador antes de subirlas (ver components/admin/image-manager.tsx),
    // así que no necesitan pasar además por el optimizador de imágenes de
    // Vercel — eso solo consume la cuota mensual (plan gratuito) sin
    // beneficio real y termina en errores 402 al agotarse.
    unoptimized: true,
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        protocol: supabaseUrl?.startsWith("https") ? "https" : "http",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/auth/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
