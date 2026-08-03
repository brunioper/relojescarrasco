"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LOGIN_ATTEMPTS_COOKIE,
  decodeAttempts,
  encodeAttempts,
  recordFailure,
  requiredDelayMs,
} from "@/lib/auth/rate-limit";
import { loginSchema, resetRequestSchema, passwordUpdateSchema } from "@/lib/validation/schemas";
import { publicEnv } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/**
 * Server Actions de autenticación.
 * Rate limiting progresivo + auditoría de logins.
 */

async function clientIpAndAgent(): Promise<{ ip: string | null; agent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null,
    agent: h.get("user-agent"),
  };
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return fail("Verifique los datos ingresados.", parsed.error.flatten().fieldErrors);
  }

  const cookieStore = await cookies();
  const attempts = decodeAttempts(cookieStore.get(LOGIN_ATTEMPTS_COOKIE)?.value);
  const delayMs = requiredDelayMs(attempts);

  if (delayMs > 0) {
    const seconds = Math.ceil(delayMs / 1000);
    return fail(
      `Demasiados intentos fallidos. Espere ${seconds} segundo${seconds === 1 ? "" : "s"} e intente nuevamente.`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // Registrar intento fallido: cookie firmada + auditoría best-effort.
    const nextState = recordFailure(attempts);
    cookieStore.set(LOGIN_ATTEMPTS_COOKIE, encodeAttempts(nextState), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 900,
      path: "/auth",
    });

    try {
      const { ip, agent } = await clientIpAndAgent();
      const admin = createAdminClient();
      await admin.from("audit_logs").insert({
        action: "login_fallido",
        entity_type: "auth",
        new_values: { email: parsed.data.email },
        ip_address: ip,
        user_agent: agent,
      });
    } catch {
      // La auditoría de fallos nunca debe romper el flujo de login.
    }

    return fail("Email o contraseña incorrectos.");
  }

  // Perfil de confianza: cuenta activa requerida.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return fail(
      "Su cuenta está inactiva. Contacte al administrador para activarla."
    );
  }

  cookieStore.delete(LOGIN_ATTEMPTS_COOKIE);
  await supabase.rpc("log_audit", {
    p_action: "login",
    p_entity_type: "auth",
    p_entity_id: data.user.id,
  });

  // Redirección segura: solo rutas internas del panel.
  const next = parsed.data.next;
  redirect(next && next.startsWith("/admin") ? next : "/admin/dashboard");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.rpc("log_audit", {
      p_action: "logout",
      p_entity_type: "auth",
      p_entity_id: user.id,
    });
  }
  await supabase.auth.signOut();
  redirect("/auth/login");
}

export async function requestPasswordResetAction(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fail("Ingrese un email válido.");
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/actualizar-password`,
  });

  // Respuesta idéntica exista o no la cuenta (sin enumeración de usuarios).
  return ok({ sent: true });
}

export async function updatePasswordAction(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const parsed = passwordUpdateSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "La contraseña no cumple los requisitos.",
      parsed.error.flatten().fieldErrors
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("El enlace expiró. Solicite un nuevo correo de recuperación.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail("No se pudo actualizar la contraseña. Solicite un nuevo enlace.");
  }

  await supabase.rpc("log_audit", {
    p_action: "password_actualizada",
    p_entity_type: "auth",
    p_entity_id: user.id,
  });

  redirect("/admin/dashboard");
}
