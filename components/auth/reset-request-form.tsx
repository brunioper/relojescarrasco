"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { requestPasswordResetAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, null);

  if (state?.ok) {
    return (
      <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
        Si el email existe en el sistema, recibirás un enlace de recuperación en unos minutos.
        Revisá también la carpeta de spam.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {state && !state.ok && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar enlace
      </Button>
    </form>
  );
}
