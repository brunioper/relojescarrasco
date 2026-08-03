import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables, UserRole } from "@/types/supabase";

export type AuthContext = {
  userId: string;
  email: string | null;
  profile: Tables<"profiles">;
};

/**
 * Carga el usuario autenticado y su PERFIL DE CONFIANZA desde la base.
 * El rol y el estado de la cuenta se leen SIEMPRE de la tabla profiles,
 * nunca del navegador, del body de la petición ni de la URL.
 *
 * Cacheado por petición (React cache) para evitar consultas repetidas.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
});

/**
 * Para páginas de servidor: exige sesión + cuenta activa con el rol dado.
 * Redirige a login (sin sesión) o a la página de cuenta inactiva.
 */
export async function requirePageRole(roles: UserRole[]): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/auth/login");
  if (!ctx.profile.is_active) redirect("/auth/cuenta-inactiva");
  if (!roles.includes(ctx.profile.role)) redirect("/admin/sin-permisos");
  return ctx;
}

/**
 * Para Server Actions y Route Handlers: devuelve el contexto o null.
 * El llamador responde con un error seguro (sin lanzar redirects).
 */
export async function requireActionRole(roles: UserRole[]): Promise<AuthContext | null> {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.profile.is_active || !roles.includes(ctx.profile.role)) {
    return null;
  }
  return ctx;
}

export const requireAdminPage = () => requirePageRole(["admin"]);
export const requireStaffPage = () => requirePageRole(["admin", "viewer"]);
export const requireAdminAction = () => requireActionRole(["admin"]);
export const requireStaffAction = () => requireActionRole(["admin", "viewer"]);
