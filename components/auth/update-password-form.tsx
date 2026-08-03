"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updatePasswordAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, null);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {state && !state.ok && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar contraseña
      </Button>
    </form>
  );
}
