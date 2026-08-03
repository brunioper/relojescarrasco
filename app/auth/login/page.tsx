import type { Metadata } from "next";
import Link from "next/link";
import { Watch } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/60 text-gold">
            <Watch className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <h1 className="font-serif text-2xl">Relojes Carrasco</h1>
          <p className="text-sm text-muted-foreground">Panel de administración</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {params.error === "enlace-invalido" && (
            <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              El enlace de acceso no es válido o expiró. Inicie sesión o solicite uno nuevo.
            </p>
          )}
          <LoginForm next={params.next} />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← Volver al sitio
          </Link>
        </p>
      </div>
    </div>
  );
}
