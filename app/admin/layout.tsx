import { requireStaffPage } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Doble barrera: el middleware ya exige sesión; aquí se exige
  // perfil ACTIVO con rol admin o viewer leído de la base.
  const ctx = await requireStaffPage();

  return (
    <AdminShell
      userName={ctx.profile.full_name || ctx.email || "Usuario"}
      userRole={ctx.profile.role}
    >
      {children}
    </AdminShell>
  );
}
