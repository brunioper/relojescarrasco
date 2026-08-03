import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/components/auth/reset-request-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="font-serif text-xl">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Te enviaremos un enlace para restablecer tu contraseña.
          </p>
          <ResetRequestForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="hover:text-foreground">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
