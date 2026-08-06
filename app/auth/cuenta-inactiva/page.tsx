import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Cuenta inactiva",
  robots: { index: false, follow: false },
};

export default function InactiveAccountPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-serif text-2xl">Cuenta inactiva</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Su cuenta existe pero aún no fue activada, o fue desactivada por un administrador. Contacte
          al responsable del sistema para restablecer el acceso.
        </p>
      </div>
      <div className="flex gap-3">
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
        <Button asChild>
          <Link href="/catalogo">Ir al sitio público</Link>
        </Button>
      </div>
    </div>
  );
}
