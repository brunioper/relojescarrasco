"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clapperboard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createVideoProjectAction } from "@/app/admin/videos/actions";
import { readVideo } from "@/lib/video/frames-client";
import { KEEP_FILES_DAYS, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from "@/lib/video/script";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Step = "idle" | "leyendo" | "subiendo" | "guion";

const STEP_LABEL: Record<Step, string> = {
  idle: "",
  leyendo: "Leyendo el video…",
  subiendo: "Subiendo el video…",
  guion: "La IA está mirando el video y escribiendo el guion…",
};

/** Subir un video nuevo: se sube directo al bucket y la IA escribe el guion. */
export function VideoNuevo({
  products,
  aiEnabled,
}: {
  products: { id: string; name: string }[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [productId, setProductId] = React.useState("");
  const [step, setStep] = React.useState<Step>("idle");

  const start = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Elegí un archivo de video.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("El video pesa más de 50 MB. Grabalo en 1080p (Ajustes → Cámara → Grabar video) o recortalo.");
      return;
    }

    try {
      setStep("leyendo");
      const { duration, frames } = await readVideo(file, { frames: aiEnabled ? 6 : 0 });
      if (duration > MAX_VIDEO_SECONDS + 0.5) {
        toast.error(`El video dura más de ${MAX_VIDEO_SECONDS} segundos. Recortalo y probá de nuevo.`);
        setStep("idle");
        return;
      }

      const created = await createVideoProjectAction({
        productId: productId || null,
        durationSec: duration,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!created.ok) {
        toast.error(created.error);
        setStep("idle");
        return;
      }

      setStep("subiendo");
      const { error } = await createClient()
        .storage.from("videos")
        .uploadToSignedUrl(created.data.path, created.data.token, file, {
          contentType: file.type.split(";")[0],
        });
      if (error) {
        toast.error("No se pudo subir el video. Revisá la conexión y probá de nuevo.");
        setStep("idle");
        return;
      }

      if (aiEnabled && frames.length > 0) {
        setStep("guion");
        const response = await fetch("/api/admin/video/guion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: created.data.id, duration, frames }),
        });
        const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!body?.ok) toast.error(body?.error ?? "No se pudo escribir el guion; podés reintentarlo adentro.");
      }

      router.push(`/admin/videos/${created.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el video.");
      setStep("idle");
    }
  };

  const busy = step !== "idle";

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="video-nuevo">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-deep">
          <Clapperboard className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <h2 id="video-nuevo" className="text-base font-semibold">
            Nuevo reel
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Subí el video del reloj (vertical, de 6 a {MAX_VIDEO_SECONDS} segundos, hasta 50 MB).{" "}
            {aiEnabled
              ? "La IA lo mira y te escribe el guion para que lo grabes con tu voz."
              : "Escribí el guion a mano: la IA todavía no está activada."}{" "}
            Los archivos se guardan {KEEP_FILES_DAYS} días; el guion queda siempre.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="video-producto">Producto (opcional, para el guion y el rótulo)</Label>
          <select
            id="video-producto"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={busy}
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Sin producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={busy} size="lg">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Procesando…" : "Elegir video"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        aria-label="Video del reloj"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void start(file);
        }}
      />
      {busy && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {STEP_LABEL[step]}
        </p>
      )}
    </section>
  );
}
