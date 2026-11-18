"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Loader2, Mic, RotateCcw, Sparkles, Square, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteVideoProjectAction,
  prepareVoiceUploadAction,
  removeVoiceAction,
  requestReelsAction,
  saveScriptAction,
  saveVoiceAction,
} from "@/app/admin/videos/actions";
import { readVideo } from "@/lib/video/frames-client";
import { KEEP_FILES_DAYS, lineFits, postText, type ReelScript } from "@/lib/video/script";
import type { VideoProjectStatus } from "@/types/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type StudioReel = {
  name: string;
  gancho: string;
  estilo: string;
  duration: number;
  url: string | null;
  downloadUrl: string | null;
};

const STATUS: Record<VideoProjectStatus, { label: string; variant: "secondary" | "info" | "success" | "destructive" }> = {
  borrador: { label: "Guion y voz", variant: "secondary" },
  en_cola: { label: "En cola", variant: "info" },
  procesando: { label: "Armándose", variant: "info" },
  listo: { label: "Listo", variant: "success" },
  error: { label: "Error", variant: "destructive" },
};

const STYLE_LABEL: Record<string, string> = { elegante: "Elegante", impacto: "Impacto", pregunta: "Pregunta" };

const EMPTY_SCRIPT: ReelScript = {
  ganchos: ["", "", ""],
  lineas: [{ desde: 0, hasta: 3, texto: "" }],
  texto_posteo: "",
  hashtags: [],
  notas: "",
};

export function VideoEstudio({
  project,
  videoUrl,
  voiceUrl,
  reels,
  aiEnabled,
  isAdmin,
}: {
  project: {
    id: string;
    title: string;
    status: VideoProjectStatus;
    error: string | null;
    duration: number;
    script: ReelScript | null;
    hasVoice: boolean;
    filesDeleted: boolean;
  };
  videoUrl: string | null;
  voiceUrl: string | null;
  reels: StudioReel[];
  aiEnabled: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const working = project.status === "en_cola" || project.status === "procesando";

  // Mientras se arma, se actualiza solo.
  React.useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(timer);
  }, [working, router]);

  const remove = async () => {
    if (!window.confirm("¿Borrar este video, la voz y los reels? No se puede deshacer.")) return;
    const result = await deleteVideoProjectAction(project.id);
    if (!result.ok) return toast.error(result.error);
    toast.success("Borrado.");
    router.push("/admin/videos");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl">{project.title}</h1>
          <Badge variant={STATUS[project.status].variant}>{STATUS[project.status].label}</Badge>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={remove}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Borrar
          </Button>
        )}
      </div>

      {project.filesDeleted ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          Los archivos de este video se borraron para no llenar el espacio gratuito (se guardan{" "}
          {KEEP_FILES_DAYS} días, o menos si hace falta lugar para videos nuevos). El guion quedó guardado
          abajo.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="space-y-4">
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              className="aspect-[9/16] w-full rounded-xl bg-black object-contain"
            />
          )}
          {isAdmin && videoUrl && (
            <Grabador
              projectId={project.id}
              videoRef={videoRef}
              lines={project.script?.lineas ?? []}
              voiceUrl={voiceUrl}
              hasVoice={project.hasVoice}
              disabled={working}
            />
          )}
        </div>

        <ScriptEditor
          projectId={project.id}
          script={project.script}
          duration={project.duration}
          videoUrl={videoUrl}
          aiEnabled={aiEnabled}
          editable={isAdmin && !working}
        />
      </div>

      <Generar project={project} isAdmin={isAdmin} working={working} />

      {reels.length > 0 && project.status === "listo" && <Resultados reels={reels} script={project.script} />}
    </div>
  );
}

// ------------------------------------------------------------
// Grabación de la voz (teleprompter)
// ------------------------------------------------------------
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
}

function Grabador({
  projectId,
  videoRef,
  lines,
  voiceUrl,
  hasVoice,
  disabled,
}: {
  projectId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  lines: ReelScript["lineas"];
  voiceUrl: string | null;
  hasVoice: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"listo" | "cuenta" | "grabando" | "revisar" | "subiendo">("listo");
  const [countdown, setCountdown] = React.useState(3);
  const [now, setNow] = React.useState(0);
  const [take, setTake] = React.useState<{ blob: Blob; url: string; offset: number } | null>(null);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const current = lines.find((l) => now >= l.desde && now < l.hasta) ?? null;
  const next = lines.find((l) => l.desde >= (current?.hasta ?? now)) ?? null;

  const record = async () => {
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      toast.error("Permití el uso del micrófono para grabar.");
      return;
    }

    setPhase("cuenta");
    for (let n = 3; n > 0; n--) {
      setCountdown(n);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const chunks: Blob[] = [];
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.current = rec;
    rec.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    let offset = 0;
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
      setTake({ blob, url: URL.createObjectURL(blob), offset });
      setPhase("revisar");
      video.ontimeupdate = null;
      video.onended = null;
    };

    const startedAt = performance.now();
    rec.start();
    video.muted = true;
    video.currentTime = 0;
    video.ontimeupdate = () => setNow(video.currentTime);
    video.onended = () => rec.state !== "inactive" && rec.stop();
    video.addEventListener("playing", () => (offset = (performance.now() - startedAt) / 1000), { once: true });
    setPhase("grabando");
    await video.play().catch(() => toast.error("No se pudo reproducir el video."));
  };

  const stop = () => {
    videoRef.current?.pause();
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  };

  const listen = async () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !take) return;
    video.muted = true;
    video.currentTime = 0;
    audio.currentTime = take.offset;
    await Promise.all([video.play(), audio.play()]).catch(() => undefined);
  };

  const upload = async (blob: Blob, offset: number) => {
    setPhase("subiendo");
    const prepared = await prepareVoiceUploadAction(projectId, blob.type);
    if (!prepared.ok) {
      toast.error(prepared.error);
      setPhase(take ? "revisar" : "listo");
      return;
    }
    const { error } = await createClient()
      .storage.from("videos")
      .uploadToSignedUrl(prepared.data.path, prepared.data.token, blob, { contentType: blob.type.split(";")[0] });
    if (error) {
      toast.error("No se pudo subir el audio. Probá de nuevo.");
      setPhase(take ? "revisar" : "listo");
      return;
    }
    const saved = await saveVoiceAction(projectId, prepared.data.path, offset);
    if (!saved.ok) {
      toast.error(saved.error);
      setPhase("listo");
      return;
    }
    toast.success("Voz guardada.");
    setTake(null);
    setPhase("listo");
    router.refresh();
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="grabar-voz">
      <h2 id="grabar-voz" className="text-sm font-semibold">
        Tu voz
      </h2>

      {(phase === "cuenta" || phase === "grabando") && (
        <div className="rounded-lg bg-primary p-4 text-primary-foreground" aria-live="polite">
          {phase === "cuenta" ? (
            <p className="text-center font-serif text-5xl">{countdown}</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest text-primary-foreground/70">
                Ahora · {now.toFixed(0)} s
              </p>
              <p className="mt-1 text-xl font-semibold leading-snug">{current?.texto ?? "…"}</p>
              {next && <p className="mt-2 text-sm text-primary-foreground/65">Sigue: {next.texto}</p>}
            </>
          )}
        </div>
      )}

      {phase === "revisar" && take && (
        <div className="space-y-2">
          <audio ref={audioRef} src={take.url} controls className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={listen}>
              Escuchar con el video
            </Button>
            <Button size="sm" onClick={() => void upload(take.blob, take.offset)}>
              Usar esta toma
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void record()}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Grabar de nuevo
            </Button>
          </div>
        </div>
      )}

      {phase === "listo" && (
        <>
          {hasVoice && voiceUrl ? (
            <div className="space-y-2">
              <audio src={voiceUrl} controls className="w-full" />
              <p className="text-xs text-muted-foreground">Esta es la voz que se va a usar.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tocá Grabar: el video corre sin sonido y el guion aparece a medida que pasa. Sin voz, el guion se
              muestra como texto en pantalla.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void record()} disabled={disabled || lines.length === 0}>
              <Mic className="h-4 w-4" aria-hidden="true" /> {hasVoice ? "Grabar otra toma" : "Grabar"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={disabled}>
              <Upload className="h-4 w-4" aria-hidden="true" /> Subir un audio
            </Button>
            {hasVoice && (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={async () => {
                  const result = await removeVoiceAction(projectId);
                  if (!result.ok) toast.error(result.error);
                  router.refresh();
                }}
              >
                Quitar la voz
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            aria-label="Audio grabado aparte"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file, 0);
            }}
          />
        </>
      )}

      {phase === "grabando" && (
        <Button size="sm" variant="destructive" onClick={stop}>
          <Square className="h-4 w-4" aria-hidden="true" /> Terminar
        </Button>
      )}
      {phase === "subiendo" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Subiendo la voz…
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Guion
// ------------------------------------------------------------
function ScriptEditor({
  projectId,
  script,
  duration,
  videoUrl,
  aiEnabled,
  editable,
}: {
  projectId: string;
  script: ReelScript | null;
  duration: number;
  videoUrl: string | null;
  aiEnabled: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ReelScript | null>(script);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "guardar" | "ia">(null);

  React.useEffect(() => {
    setDraft(script);
    setDirty(false);
  }, [script]);

  const update = (next: ReelScript) => {
    setDraft(next);
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    setBusy("guardar");
    const result = await saveScriptAction(projectId, {
      ...draft,
      ganchos: draft.ganchos.filter((g) => g.trim()),
    });
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Guion guardado.");
    setDirty(false);
    router.refresh();
  };

  const rewrite = async () => {
    if (!videoUrl) return;
    if (dirty && !window.confirm("Se reemplaza el guion que editaste. ¿Seguimos?")) return;
    setBusy("ia");
    try {
      const { frames } = await readVideo(videoUrl, { frames: 6 });
      const response = await fetch("/api/admin/video/guion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, duration, frames }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!body?.ok) toast.error(body?.error ?? "No se pudo escribir el guion.");
      else toast.success("Guion nuevo listo.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el video.");
    }
    setBusy(null);
  };

  if (!draft) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Guion</h2>
        <p className="text-sm text-muted-foreground">Todavía no hay guion.</p>
        {editable && (
          <div className="flex flex-wrap gap-2">
            {aiEnabled && videoUrl && (
              <Button onClick={rewrite} disabled={busy !== null}>
                {busy === "ia" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Escribir con IA
              </Button>
            )}
            <Button variant="outline" onClick={() => update(EMPTY_SCRIPT)}>
              Escribir a mano
            </Button>
          </div>
        )}
      </section>
    );
  }

  const setHook = (index: number, value: string) => {
    const ganchos = [...draft.ganchos];
    while (ganchos.length < 3) ganchos.push("");
    ganchos[index] = value;
    update({ ...draft, ganchos });
  };
  const setLine = (index: number, patch: Partial<ReelScript["lineas"][number]>) =>
    update({ ...draft, lineas: draft.lineas.map((l, i) => (i === index ? { ...l, ...patch } : l)) });

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5" aria-labelledby="guion">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="guion" className="text-base font-semibold">
          Guion
        </h2>
        {editable && (
          <div className="flex gap-2">
            {aiEnabled && videoUrl && (
              <Button size="sm" variant="outline" onClick={rewrite} disabled={busy !== null}>
                {busy === "ia" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Reescribir con IA
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={!dirty || busy !== null}>
              {busy === "guardar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Ganchos (uno por versión, los primeros 3 segundos)</Label>
        {[0, 1, 2].map((index) => (
          <Input
            key={index}
            value={draft.ganchos[index] ?? ""}
            onChange={(e) => setHook(index, e.target.value)}
            disabled={!editable}
            maxLength={70}
            placeholder={`Gancho ${index + 1}`}
            aria-label={`Gancho ${index + 1}`}
          />
        ))}
      </div>

      <div className="space-y-3">
        <Label>Lo que decís, tramo por tramo</Label>
        {draft.lineas.map((line, index) => (
          <div key={index} className="space-y-1.5 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={line.desde}
                onChange={(e) => setLine(index, { desde: Number(e.target.value) })}
                disabled={!editable}
                className="h-8 w-20"
                aria-label={`Desde (tramo ${index + 1})`}
              />
              a
              <Input
                type="number"
                step="0.1"
                min="0"
                value={line.hasta}
                onChange={(e) => setLine(index, { hasta: Number(e.target.value) })}
                disabled={!editable}
                className="h-8 w-20"
                aria-label={`Hasta (tramo ${index + 1})`}
              />
              segundos
              {editable && draft.lineas.length > 1 && (
                <button
                  type="button"
                  className="ml-auto underline-offset-4 hover:underline"
                  onClick={() => update({ ...draft, lineas: draft.lineas.filter((_, i) => i !== index) })}
                >
                  Quitar
                </button>
              )}
            </div>
            <Textarea
              rows={2}
              value={line.texto}
              onChange={(e) => setLine(index, { texto: e.target.value })}
              disabled={!editable}
              aria-label={`Texto del tramo ${index + 1}`}
            />
            {line.texto.trim() && !lineFits(line) && (
              <p className="text-xs text-amber-700">Es mucho texto para ese tramo: acortalo o alargá el tramo.</p>
            )}
          </div>
        ))}
        {editable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const last = draft.lineas[draft.lineas.length - 1];
              const desde = Math.min(duration, last ? last.hasta : 0);
              update({ ...draft, lineas: [...draft.lineas, { desde, hasta: Math.min(duration, desde + 3), texto: "" }] });
            }}
          >
            Agregar tramo
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="texto-posteo">Texto del posteo</Label>
        <Textarea
          id="texto-posteo"
          rows={4}
          value={draft.texto_posteo}
          onChange={(e) => update({ ...draft, texto_posteo: e.target.value })}
          disabled={!editable}
        />
        <Label htmlFor="hashtags">Hashtags</Label>
        <Input
          id="hashtags"
          value={draft.hashtags.map((t) => `#${t}`).join(" ")}
          onChange={(e) =>
            update({
              ...draft,
              hashtags: e.target.value
                .split(/\s+/)
                .map((t) => t.replace(/^#+/, ""))
                .filter(Boolean),
            })
          }
          disabled={!editable}
        />
      </div>

      {draft.notas && (
        <p className="rounded-md bg-accent/60 px-3 py-2 text-sm">
          <span className="font-medium">Consejo: </span>
          {draft.notas}
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Generar y resultados
// ------------------------------------------------------------
function Generar({
  project,
  isAdmin,
  working,
}: {
  project: { id: string; status: VideoProjectStatus; error: string | null; hasVoice: boolean; filesDeleted: boolean };
  isAdmin: boolean;
  working: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const request = async () => {
    setBusy(true);
    const result = await requestReelsAction(project.id);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("En cola: en unos 10 a 20 minutos están listos.");
    router.refresh();
  };

  if (project.filesDeleted) return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5" aria-live="polite">
      <div className="text-sm">
        {working ? (
          <p className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Armando las 3 versiones. Tarda unos 10 a 20 minutos; esta página se actualiza sola.
          </p>
        ) : project.status === "error" ? (
          <p className="text-destructive">No se pudo armar: {project.error ?? "error desconocido"}.</p>
        ) : (
          <p className="text-muted-foreground">
            Se arman 3 versiones, una por gancho, con {project.hasVoice ? "tu voz y subtítulos" : "el guion como texto en pantalla"},
            el rótulo del reloj y el cierre con @relojes_carrasco.
          </p>
        )}
      </div>
      {isAdmin && !working && (
        <Button onClick={request} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {project.status === "listo" ? "Volver a generar" : project.status === "error" ? "Reintentar" : "Generar los reels"}
        </Button>
      )}
    </section>
  );
}

function Resultados({ reels, script }: { reels: StudioReel[]; script: ReelScript | null }) {
  const text = script ? postText(script) : "";
  return (
    <section className="space-y-4" aria-labelledby="resultados">
      <div>
        <h2 id="resultados" className="text-base font-semibold">
          Reels listos
        </h2>
        <p className="text-sm text-muted-foreground">
          Para probarlos: en Instagram, al publicar cada versión elegí «Prueba» (reels de prueba), así se muestra
          primero a quienes no te siguen y te quedás con la que mejor funcione.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {reels.map((reel) => (
          <figure key={reel.name} className="space-y-2">
            {reel.url ? (
              <video src={reel.url} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-xl bg-black" />
            ) : (
              <div className="aspect-[9/16] w-full rounded-xl bg-muted" />
            )}
            <figcaption className="space-y-1 text-sm">
              <p className="font-medium">{reel.gancho}</p>
              <p className="text-muted-foreground">
                {STYLE_LABEL[reel.estilo] ?? reel.estilo} · {reel.duration.toFixed(0)} s
              </p>
              {reel.downloadUrl && (
                <Button asChild size="sm" variant="outline">
                  <a href={reel.downloadUrl} download>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" /> Descargar
                  </a>
                </Button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {text && (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Texto del posteo</p>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                toast.success("Copiado.");
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar
            </Button>
          </div>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{text}</p>
        </div>
      )}
    </section>
  );
}
