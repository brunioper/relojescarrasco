import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

/**
 * Mantenimiento de sesión + protección de rutas en el middleware.
 *
 * - Refresca el token de Supabase en cada petición (cookies httpOnly).
 * - Bloquea /admin para usuarios sin sesión (redirige a /auth/login).
 * - La autorización fina (rol admin/viewer, cuenta activa) se verifica
 *   ADEMÁS en el layout de /admin y en cada Server Action: el middleware
 *   es solo la primera barrera.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Cookies de sesión endurecidas en producción.
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
            })
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() valida el JWT contra Supabase (no getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/admin");
  const isAuthPage = path.startsWith("/auth/login");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    // Redirección segura post-login: solo rutas internas.
    url.searchParams.set("next", path.startsWith("/admin") ? path : "/admin/dashboard");
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
