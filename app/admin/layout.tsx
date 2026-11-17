import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  robots: { index: false, follow: false },
};

/** Lo de Instagram que espera una decisión (0 si la tabla todavía no existe). */
async function instagramToReview(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("instagram_imports")
    .select("id", { count: "exact", head: true })
    .in("status", ["pendiente", "borrador", "error"]);
  return error ? 0 : (count ?? 0);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Doble barrera: el middleware ya exige sesión; aquí se exige
  // perfil ACTIVO con rol admin o viewer leído de la base.
  const ctx = await requireStaffPage();

  return (
    <AdminShell
      userName={ctx.profile.full_name || ctx.email || "Usuario"}
      userRole={ctx.profile.role}
      badges={{ "/admin/instagram": await instagramToReview() }}
    >
      {children}
    </AdminShell>
  );
}
