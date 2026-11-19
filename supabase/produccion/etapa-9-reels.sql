-- ============================================================
-- Etapa 9 — Estudio de reels (pegar en Supabase → SQL Editor → Run)
--
-- Agrega una tabla nueva y un bucket privado para los videos.
-- No modifica ni borra nada existente. Es una copia exacta de la
-- migración que prueba el CI.
-- ============================================================

begin;

-- ============================================================
-- Relojes Carrasco — Etapa 9: estudio de reels
--
-- El dueño sube un video del reloj, la IA escribe el guion mirando el
-- video, el dueño graba su voz y una tarea en GitHub Actions arma los
-- reels (subtítulos, animaciones y varias versiones para reels de prueba).
--
-- Migración aditiva: no modifica ni borra nada existente.
-- ============================================================

create table public.video_projects (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references public.products (id) on delete set null,
  title           text not null check (char_length(title) between 1 and 200),
  -- Archivos en el bucket privado "videos" (proyectos/<id>/…).
  video_path      text,
  video_duration  numeric(6, 2) check (video_duration is null or video_duration > 0),
  voice_path      text,
  -- Segundos entre que arranca la grabación y que arranca el video (se recortan de la voz).
  voice_offset    numeric(5, 2) not null default 0 check (voice_offset >= 0 and voice_offset <= 10),
  script          jsonb,
  status          text not null default 'borrador' check (status in (
                    'borrador',   -- video subido; guion y voz en preparación
                    'en_cola',    -- el dueño pidió generar los reels
                    'procesando', -- la tarea de GitHub lo está armando
                    'listo',      -- reels generados
                    'error'
                  )),
  reels           jsonb not null default '[]'::jsonb,
  error           text,
  attempts        integer not null default 0,
  processing_at   timestamptz,
  files_deleted   boolean not null default false,
  -- Lo que ocupan sus archivos: el estudio tiene un tope para no llenar el
  -- almacenamiento gratuito que comparte con las fotos del catálogo.
  storage_bytes   bigint not null default 0 check (storage_bytes >= 0),
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_video_projects_status on public.video_projects (status, created_at);
create index idx_video_projects_created on public.video_projects (created_at desc);

create trigger trg_video_projects_updated_at
  before update on public.video_projects
  for each row execute function public.set_updated_at();

alter table public.video_projects enable row level security;

create policy "video_projects_staff_read"
  on public.video_projects for select
  to authenticated
  using (public.is_active_staff());

create policy "video_projects_admin_insert"
  on public.video_projects for insert
  to authenticated
  with check (public.is_admin());

create policy "video_projects_admin_update"
  on public.video_projects for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "video_projects_admin_delete"
  on public.video_projects for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- Bucket privado para videos y audios. Nadie lo lee directo: el
-- servidor entrega URLs firmadas y de corta duración a un
-- administrador o a la tarea que arma los reels.
-- 50 MB es el máximo por archivo del plan gratuito de Supabase.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,
  52428800,
  array[
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/aac',
    'audio/x-m4a', 'audio/wav', 'audio/x-wav'
  ]
)
on conflict (id) do nothing;

commit;

-- Verificación: debe devolver 2 filas (la tabla y el bucket).
select 'tabla' as que, table_name as nombre from information_schema.tables
where table_schema = 'public' and table_name = 'video_projects'
union all
select 'bucket', id from storage.buckets where id = 'videos';
