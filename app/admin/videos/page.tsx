import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/formatting/date";
import { aiConfigured } from "@/services/ai/product-detection";
import { VideoNuevo } from "@/components/admin/video-nuevo";
import { Badge } from "@/components/ui/badge";
import type { VideoProjectStatus } from "@/types/supabase";

export const metadata = { title: "Videos" };
export const dynamic = "force-dynamic";

const STATUS: Record<VideoProjectStatus, { label: string; variant: "secondary" | "info" | "success" | "destructive" }> = {
  borrador: { label: "Guion y voz", variant: "secondary" },
  en_cola: { label: "En cola", variant: "info" },
  procesando: { label: "Armándose", variant: "info" },
  listo: { label: "Listo", variant: "success" },
  error: { label: "Error", variant: "destructive" },
};

export default async function VideosPage() {
  const ctx = await requireStaffPage();
  const isAdmin = ctx.profile.role === "admin";
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("video_projects")
    .select("id, title, status, created_at, video_duration")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl">Videos</h1>
        <p className="max-w-2xl rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          Para usar esta sección falta aplicar la actualización de la base de datos de la Etapa 9 (ver
          BLOQUEOS.md, punto 7).
        </p>
      </div>
    );
  }

  const { data: products } = isAdmin
    ? await supabase
        .from("products")
        .select("id, name")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Videos</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Subís el video del reloj, la IA te escribe el guion, lo grabás con tu voz y se arman 3 versiones
          con subtítulos y animaciones para probar como reels de prueba.
        </p>
      </div>

      {isAdmin && <VideoNuevo products={products ?? []} aiEnabled={aiConfigured()} />}

      <section className="space-y-3" aria-labelledby="videos-lista">
        <h2 id="videos-lista" className="text-base font-semibold">
          Tus videos
        </h2>
        {(projects ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
            Todavía no subiste ninguno.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {(projects ?? []).map((project) => (
              <li key={project.id}>
                <Link
                  href={`/admin/videos/${project.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{project.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(project.created_at)}
                      {project.video_duration ? ` · ${Number(project.video_duration).toFixed(0)} s` : ""}
                    </span>
                  </span>
                  <Badge variant={STATUS[project.status].variant}>{STATUS[project.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
