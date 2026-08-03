import "server-only";

import { cache } from "react";
import { createAnonClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

/**
 * Configuración pública del sitio (leída con el cliente anónimo:
 * solo las claves de la allowlist de la vista public_settings).
 */

export type PublicSettings = {
  businessName: string;
  contactEmail: string;
  whatsappNumber: string;
  instagramUrl: string;
  address: string;
  catalogueIntro: string;
  footerText: string;
  privacyText: string;
  termsText: string;
  seoTitle: string;
  seoDescription: string;
  siteUrl: string;
  showUyuConversion: boolean;
};

function readString(map: Map<string, Json>, key: string, fallback = ""): string {
  const raw = map.get(key);
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const v = (raw as { value?: Json }).value;
    if (typeof v === "string") return v;
  }
  return fallback;
}

function readBoolean(map: Map<string, Json>, key: string, fallback: boolean): boolean {
  const raw = map.get(key);
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const v = (raw as { value?: Json }).value;
    if (typeof v === "boolean") return v;
  }
  return fallback;
}

export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  const supabase = createAnonClient();
  const { data } = await supabase.from("public_settings").select("key, value");

  const map = new Map<string, Json>((data ?? []).map((row) => [row.key, row.value]));

  return {
    businessName: readString(map, "business_name", "Relojes Carrasco"),
    contactEmail: readString(map, "contact_email"),
    whatsappNumber: readString(map, "whatsapp_number"),
    instagramUrl: readString(map, "instagram_url"),
    address: readString(map, "address"),
    catalogueIntro: readString(map, "catalogue_intro"),
    footerText: readString(map, "footer_text"),
    privacyText: readString(map, "privacy_text"),
    termsText: readString(map, "terms_text"),
    seoTitle: readString(map, "seo_title", "Relojes Carrasco"),
    seoDescription: readString(map, "seo_description"),
    siteUrl: readString(map, "site_url"),
    showUyuConversion: readBoolean(map, "show_uyu_conversion", true),
  };
});

/**
 * Cotización activa del catálogo público (UYU por USD) vía RPC segura.
 * null si aún no hay cotizaciones cargadas.
 */
export const getCatalogueRate = cache(async (): Promise<number | null> => {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("get_catalogue_rate");
  if (error || data === null) return null;
  const rate = Number(data);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
});
