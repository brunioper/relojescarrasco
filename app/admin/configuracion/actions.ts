"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAction } from "@/lib/auth/session";
import { fail, ok, safeErrorMessage, type ActionResult } from "@/lib/action-result";
import { settingsSchema } from "@/lib/validation/schemas";
import { uuidSchema } from "@/lib/validation/money";
import { z } from "zod";

/** Guarda la configuración general de la aplicación. */
export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para modificar la configuración.");

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Verifique los datos de configuración.", parsed.error.flatten().fieldErrors);
  }

  const s = parsed.data;
  const now = new Date().toISOString();
  const rows = [
    { key: "business_name", value: { value: s.business_name } },
    { key: "contact_email", value: { value: s.contact_email } },
    { key: "whatsapp_number", value: { value: s.whatsapp_number } },
    { key: "instagram_url", value: { value: s.instagram_url } },
    { key: "address", value: { value: s.address } },
    { key: "catalogue_intro", value: { value: s.catalogue_intro } },
    { key: "footer_text", value: { value: s.footer_text } },
    { key: "privacy_text", value: { value: s.privacy_text } },
    { key: "terms_text", value: { value: s.terms_text } },
    { key: "seo_title", value: { value: s.seo_title } },
    { key: "seo_description", value: { value: s.seo_description } },
    { key: "site_url", value: { value: s.site_url } },
    { key: "show_reserved_products", value: { value: s.show_reserved_products } },
    { key: "show_uyu_conversion", value: { value: s.show_uyu_conversion } },
    { key: "exchange_rate_warning_days", value: { value: s.exchange_rate_warning_days } },
  ].map((row) => ({ ...row, updated_by: ctx.userId, updated_at: now }));

  const supabase = await createClient();
  const { error } = await supabase.from("application_settings").upsert(rows);
  if (error) return fail(safeErrorMessage(error));

  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
  revalidatePath("/catalogo");
  return ok(null);
}

// ------------------------------------------------------------
// Gestión de usuarios (roles y estado de cuentas)
// ------------------------------------------------------------
const roleUpdateSchema = z.object({
  user_id: uuidSchema,
  role: z.enum(["admin", "viewer"]),
  is_active: z.boolean(),
});

export async function updateUserRoleAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireAdminAction();
  if (!ctx) return fail("No tiene permisos para gestionar usuarios.");

  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");

  // Un administrador no puede cambiarse a sí mismo (el trigger de la
  // base también lo impide; esta es la barrera amable).
  if (parsed.data.user_id === ctx.userId) {
    return fail("No puede modificar su propio rol o estado de cuenta.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, is_active: parsed.data.is_active })
    .eq("id", parsed.data.user_id);

  if (error) return fail(safeErrorMessage(error));
  revalidatePath("/admin/configuracion");
  return ok(null);
}
