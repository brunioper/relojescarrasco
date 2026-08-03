"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveSettingsAction } from "@/app/admin/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettingsInput } from "@/lib/validation/schemas";

export function SettingsForm({ defaults }: { defaults: SettingsInput }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [showReserved, setShowReserved] = React.useState(defaults.show_reserved_products);
  const [showUyu, setShowUyu] = React.useState(defaults.show_uyu_conversion);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const result = await saveSettingsAction({
      business_name: fd.get("business_name"),
      contact_email: fd.get("contact_email") ?? "",
      whatsapp_number: fd.get("whatsapp_number") ?? "",
      instagram_url: fd.get("instagram_url") ?? "",
      address: fd.get("address") ?? "",
      catalogue_intro: fd.get("catalogue_intro") ?? "",
      footer_text: fd.get("footer_text") ?? "",
      privacy_text: fd.get("privacy_text") ?? "",
      terms_text: fd.get("terms_text") ?? "",
      seo_title: fd.get("seo_title") ?? "",
      seo_description: fd.get("seo_description") ?? "",
      site_url: fd.get("site_url") ?? "",
      show_reserved_products: showReserved,
      show_uyu_conversion: showUyu,
      exchange_rate_warning_days: fd.get("exchange_rate_warning_days"),
      catalogue_rate_mode: "latest", // se gestiona desde Cotizaciones
    });
    setSaving(false);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Configuración guardada.");
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negocio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="business_name">Nombre del negocio *</Label>
            <Input id="business_name" name="business_name" required defaultValue={defaults.business_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_email">Email de contacto</Label>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={defaults.contact_email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp_number">WhatsApp (internacional, sin +)</Label>
            <Input
              id="whatsapp_number"
              name="whatsapp_number"
              placeholder="59899123456"
              defaultValue={defaults.whatsapp_number}
            />
            <p className="text-xs text-muted-foreground">
              Se usa en los botones de consulta del sitio público.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instagram_url">Instagram (URL)</Label>
            <Input id="instagram_url" name="instagram_url" defaultValue={defaults.instagram_url} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Dirección (opcional)</Label>
            <Input id="address" name="address" defaultValue={defaults.address} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo público</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="catalogue_intro">Introducción del catálogo</Label>
            <Textarea id="catalogue_intro" name="catalogue_intro" rows={2} defaultValue={defaults.catalogue_intro} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="footer_text">Texto del pie de página</Label>
            <Textarea id="footer_text" name="footer_text" rows={2} defaultValue={defaults.footer_text} />
          </div>
          <div className="flex flex-wrap gap-8">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={showReserved} onCheckedChange={setShowReserved} />
              Mostrar relojes reservados en el catálogo
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={showUyu} onCheckedChange={setShowUyu} />
              Mostrar conversión aproximada a UYU
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exchange_rate_warning_days">
              Avisar si la cotización tiene más de (días)
            </Label>
            <Input
              id="exchange_rate_warning_days"
              name="exchange_rate_warning_days"
              type="number"
              min="1"
              max="365"
              defaultValue={defaults.exchange_rate_warning_days}
              className="w-28"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO y textos legales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="seo_title">Título SEO</Label>
              <Input id="seo_title" name="seo_title" defaultValue={defaults.seo_title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site_url">URL del sitio</Label>
              <Input id="site_url" name="site_url" defaultValue={defaults.site_url} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo_description">Descripción SEO</Label>
            <Textarea id="seo_description" name="seo_description" rows={2} defaultValue={defaults.seo_description} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="privacy_text">Política de privacidad</Label>
            <Textarea id="privacy_text" name="privacy_text" rows={4} defaultValue={defaults.privacy_text} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="terms_text">Términos y condiciones</Label>
            <Textarea id="terms_text" name="terms_text" rows={4} defaultValue={defaults.terms_text} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar configuración
      </Button>
    </form>
  );
}
