import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Actualizar contraseña",
  robots: { index: false, follow: false },
};

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="font-serif text-xl">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mínimo 10 caracteres, con letras y números.
        </p>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
