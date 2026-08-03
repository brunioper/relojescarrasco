import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Sin permisos",
  robots: { index: false, follow: false },
};

export default function NoPermissionsPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-serif text-2xl">Acceso restringido</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Su cuenta no tiene permisos para acceder a esta sección.
        </p>
      </div>
      <Button asChild>
        <Link href="/admin/dashboard">Volver al dashboard</Link>
      </Button>
    </div>
  );
}
