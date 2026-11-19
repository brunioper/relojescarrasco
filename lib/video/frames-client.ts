import { blobToBase64 } from "@/lib/images-client";
import { frameTimes } from "@/lib/video/script";

/**
 * Lee la duración de un video y saca algunos cuadros en el navegador, para
 * que la IA escriba el guion sin subir nada más que unas imágenes chicas.
 */

export type VideoFrame = { time: number; mediaType: "image/webp" | "image/jpeg"; data: string };

const MAX_SIDE = 768;

function waitFor(target: HTMLVideoElement, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.removeEventListener(event, done);
      reject(new Error("El video tardó demasiado en responder."));
    }, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    target.addEventListener(event, done, { once: true });
  });
}

export async function readVideo(
  source: File | string,
  options: { frames?: number } = {}
): Promise<{ duration: number; frames: VideoFrame[] }> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (typeof source === "string") video.crossOrigin = "anonymous";
  // En el DOM (invisible): algunos navegadores de celular no decodifican cuadros si no.
  video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);

  try {
    const metadata = waitFor(video, "loadeddata", 20_000);
    video.src = url;
    video.load();
    await metadata;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("No se pudo leer la duración del video.");

    const frames: VideoFrame[] = [];
    const count = options.frames ?? 6;
    if (count > 0) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("El navegador no puede leer el video.");

      for (const time of frameTimes(duration, count)) {
        const seeked = waitFor(video, "seeked", 10_000);
        video.currentTime = time;
        await seeked;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
        if (!blob) continue;
        frames.push({
          time,
          mediaType: blob.type === "image/webp" ? "image/webp" : "image/jpeg",
          data: await blobToBase64(blob),
        });
      }
    }
    return { duration, frames };
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
