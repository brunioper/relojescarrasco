import { requireAdminPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";
import { UsersManager } from "@/components/admin/users-manager";
import type { Json } from "@/types/supabase";
import type { SettingsInput } from "@/lib/validation/schemas";

export const metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

function readValue(map: Map<string, Json>, key: string, fallback: string | number | boolean) {
  const raw = map.get(key);
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const v = (raw as { value?: Json }).value;
    if (v !== undefined && v !== null) return v as string | number | boolean;
  }
  return fallback;
}

export default async function SettingsPage() {
  const ctx = await requireAdminPage();
  const supabase = await createClient();

  const [{ data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("application_settings").select("key, value"),
    supabase.from("profiles").select("id, full_name, role, is_active").order("created_at"),
  ]);

  const map = new Map<string, Json>((settings ?? []).map((row) => [row.key, row.value]));

  const defaults: SettingsInput = {
    business_name: String(readValue(map, "business_name", "Relojes Carrasco")),
    contact_email: String(readValue(map, "contact_email", "")),
    whatsapp_number: String(readValue(map, "whatsapp_number", "")),
    instagram_url: String(readValue(map, "instagram_url", "")),
    address: String(readValue(map, "address", "")),
    catalogue_intro: String(readValue(map, "catalogue_intro", "")),
    footer_text: String(readValue(map, "footer_text", "")),
    privacy_text: String(readValue(map, "privacy_text", "")),
    terms_text: String(readValue(map, "terms_text", "")),
    seo_title: String(readValue(map, "seo_title", "")),
    seo_description: String(readValue(map, "seo_description", "")),
    site_url: String(readValue(map, "site_url", "")),
    show_reserved_products: Boolean(readValue(map, "show_reserved_products", false)),
    show_uyu_conversion: Boolean(readValue(map, "show_uyu_conversion", true)),
    exchange_rate_warning_days: Number(readValue(map, "exchange_rate_warning_days", 7)),
    catalogue_rate_mode: "latest",
    catalogue_rate_value: null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Datos del negocio, catálogo público y usuarios del panel.
        </p>
      </div>

      <SettingsForm defaults={defaults} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios del panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Los usuarios se crean desde el panel de Supabase (Authentication → Users). Aquí se les
            asigna rol y se activan. Nadie puede modificar su propio rol ni desactivarse a sí mismo.
          </p>
          <UsersManager users={profiles ?? []} currentUserId={ctx.userId} />
        </CardContent>
      </Card>
    </div>
  );
}
