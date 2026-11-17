"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  connectInstagramAction,
  disconnectInstagramAction,
  setAutoPublishAction,
} from "@/app/admin/instagram/actions";
import type { InstagramConnection } from "@/services/instagram-sync/connection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/formatting/date";

/** La revisión automática corre cada 15 minutos: más de 2 horas sin revisar es un problema. */
const STALE_MS = 2 * 60 * 60 * 1000;

export function InstagramConnectionCard({
  connection,
  isAdmin,
  aiReady,
  scheduleReady,
}: {
  connection: InstagramConnection | null;
  isAdmin: boolean;
  aiReady: boolean;
  scheduleReady: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState<null | "conectar" | "revisar" | "desconectar">(null);
  const [now] = React.useState(() => Date.now());

  const connect = async () => {
    setBusy("conectar");
    const result = await connectInstagramAction(token);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Conectado como @${result.data.username}.`);
    setToken("");
    router.refresh();
  };

  const checkNow = async () => {
    setBusy("revisar");
    try {
      const response = await fetch("/api/admin/instagram/revisar", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (body?.ok) toast.success(body.message ?? "Revisión hecha.");
      else toast.error(body?.message ?? "No se pudo revisar Instagram.");
    } catch {
      toast.error("No se pudo revisar Instagram.");
    }
    setBusy(null);
    router.refresh();
  };

  const disconnect = async () => {
    setBusy("desconectar");
    const result = await disconnectInstagramAction();
    setBusy(null);
    if (!result.ok) toast.error(result.error);
    router.refresh();
  };

  const toggleAutoPublish = async (enabled: boolean) => {
    const result = await setAutoPublishAction(enabled);
    if (!result.ok) toast.error(result.error);
    router.refresh();
  };

  const lastCheck = connection?.last_checked_at ? new Date(connection.last_checked_at).getTime() : null;
  const stale = connection !== null && (lastCheck === null || now - lastCheck > STALE_MS);

  const warnings = [
    !aiReady ? "Falta activar la IA (BLOQUEOS, punto 4): sin ella, lo nuevo queda esperando." : null,
    !scheduleReady ? "Falta la clave de la revisión automática (CRON_SECRET, BLOQUEOS punto 6)." : null,
    connection?.last_error ?? null,
    stale && scheduleReady
      ? "La revisión automática no corrió en las últimas 2 horas. Usá «Revisar ahora» y avisame si sigue así."
      : null,
  ].filter((w): w is string => Boolean(w));

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="ig-conexion">
      <h2 id="ig-conexion" className="text-base font-semibold">
        Conexión
      </h2>

      {connection ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Conectado como @{connection.username}
            </p>
            <p className="text-muted-foreground">
              Se importa lo publicado desde el {formatDateTime(connection.watch_since)}. Última revisión:{" "}
              {connection.last_checked_at ? formatDateTime(connection.last_checked_at) : "todavía ninguna"}.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={checkNow} disabled={busy !== null}>
                {busy === "revisar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
                Revisar ahora
              </Button>
              <Button variant="ghost" onClick={disconnect} disabled={busy !== null}>
                Desconectar
              </Button>
            </div>
          )}
        </div>
      ) : isAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="ig-token">Token de acceso de Instagram</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="ig-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pegá el token que genera Meta para tu cuenta"
            />
            <Button onClick={connect} disabled={busy !== null || token.trim().length < 20}>
              {busy === "conectar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Conectar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cómo conseguirlo: BLOQUEOS.md, punto 6. Se guarda cifrado y se renueva solo. Desde que
            conectes, se importa solo lo nuevo (nunca las publicaciones viejas).
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Instagram todavía no está conectado.</p>
      )}

      {connection && (
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Switch
            checked={connection.auto_publish}
            disabled={!isAdmin}
            onCheckedChange={(checked) => void toggleAutoPublish(checked)}
            aria-label="Publicar automáticamente"
          />
          <span>
            <span className="block font-medium">Publicar automáticamente</span>
            <span className="text-muted-foreground">
              Si la imagen muestra el precio en dólares, el producto nuevo se publica solo. Apagado,
              se crea sin publicar y lo publicás vos.
            </span>
          </span>
        </label>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
