import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod/v4";
import { requireStaffPage } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { reelScriptSchema } from "@/lib/video/script";
import { aiConfigured } from "@/services/ai/product-detection";
import { signedDownloadUrl } from "@/services/video/storage";
import { VideoEstudio, type StudioReel } from "@/components/admin/video-estudio";

export const metadata = { title: "Video" };
export const dynamic = "force-dynamic";

const reelsSchema = z.array(
  z.object({
    name: z.string(),
    gancho: z.string(),
    estilo: z.string(),
    duration: z.number(),
    path: z.string(),
  })
);

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase.from("video_projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const admin = createAdminClient();
  const videoUrl =
    project.video_path && !project.files_deleted ? await signedDownloadUrl(admin, project.video_path) : null;
  const voiceUrl =
    project.voice_path && !project.files_deleted ? await signedDownloadUrl(admin, project.voice_path) : null;

  const parsedReels = reelsSchema.safeParse(project.reels);
  const base = slugify(project.title) || "reel";
  const reels: StudioReel[] = [];
  for (const reel of parsedReels.success ? parsedReels.data : []) {
    reels.push({
      name: reel.name,
      gancho: reel.gancho,
      estilo: reel.estilo,
      duration: reel.duration,
      url: await signedDownloadUrl(admin, reel.path),
      downloadUrl: await signedDownloadUrl(admin, reel.path, { downloadAs: `${base}-${reel.name}.mp4` }),
    });
  }

  const script = reelScriptSchema.safeParse(project.script);

  return (
    <div className="space-y-4">
      <Link href="/admin/videos" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Videos
      </Link>
      <VideoEstudio
        project={{
          id: project.id,
          title: project.title,
          status: project.status,
          error: project.error,
          duration: Number(project.video_duration) || 0,
          script: script.success ? script.data : null,
          hasVoice: Boolean(project.voice_path),
          filesDeleted: project.files_deleted,
        }}
        videoUrl={videoUrl}
        voiceUrl={voiceUrl}
        reels={reels}
        aiEnabled={aiConfigured()}
        isAdmin={ctx.profile.role === "admin"}
      />
    </div>
  );
}
