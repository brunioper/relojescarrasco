/**
 * URL canónica del sitio (sitemap, robots, metadatos y links compartidos).
 *
 * En producción la URL canónica es el dominio propio. Si la variable
 * NEXT_PUBLIC_SITE_URL (o la clave `site_url` del panel) quedó apuntando
 * a un dominio *.vercel.app, se ignora: de lo contrario Google indexa el
 * dominio técnico de Vercel en lugar del dominio real del negocio.
 */

export const PRODUCTION_SITE_URL = "https://www.relojescarrasco.com";

function clean(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function isVercelDomain(url: string): boolean {
  return /\.vercel\.app$/i.test(new URL(url).hostname);
}

export function resolveSiteUrl(input: {
  envUrl?: string | null;
  settingsUrl?: string | null;
  vercelEnv?: string | null;
}): string {
  const isProduction = input.vercelEnv === "production";
  const candidates = [clean(input.settingsUrl), clean(input.envUrl)].filter(
    (c): c is string => c !== null
  );

  for (const candidate of candidates) {
    if (isProduction && isVercelDomain(candidate)) continue;
    return candidate;
  }

  return isProduction ? PRODUCTION_SITE_URL : "http://localhost:3000";
}

/** URL canónica según el entorno actual (solo servidor). */
export function siteUrl(settingsUrl?: string | null): string {
  return resolveSiteUrl({
    envUrl: process.env.NEXT_PUBLIC_SITE_URL,
    settingsUrl,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
