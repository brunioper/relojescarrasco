import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de Supabase Auth (enlaces de recuperación / verificación).
 * Intercambia el código por una sesión y redirige de forma SEGURA:
 * solo a rutas internas de la aplicación.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/admin/dashboard";
  // Redirección segura: solo paths internos (nunca URLs absolutas externas).
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=enlace-invalido`);
}
