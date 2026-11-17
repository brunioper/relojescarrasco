-- ============================================================
-- Etapa 6 — Instagram → catálogo (pegar en Supabase → SQL Editor → Run)
--
-- Agrega dos tablas nuevas y una función. No modifica ni borra nada
-- existente. Es una copia exacta de la migración que prueba el CI.
-- ============================================================

begin;

-- ============================================================
-- Relojes Carrasco — Etapa 6: historias y publicaciones de Instagram → catálogo
--
-- Una revisión periódica lee las historias y publicaciones nuevas de la
-- cuenta, las pasa por la IA y:
--   - si es un producto nuevo, lo crea (y lo publica si se lee el precio);
--   - si se parece a algo que ya está en el catálogo, espera aprobación.
--
-- Migración aditiva: no modifica ni borra nada existente.
-- ============================================================

-- ------------------------------------------------------------
-- Conexión con la cuenta de Instagram (una sola fila).
-- Guarda el token CIFRADO. Solo la usa el servidor con la clave
-- service role: RLS activado y SIN políticas (anon y authenticated
-- no pueden leerla ni escribirla).
-- ------------------------------------------------------------
create table public.instagram_connection (
  id                 smallint primary key default 1 check (id = 1),
  ig_user_id         text not null,
  username           text not null,
  token_ciphertext   text not null,
  token_refreshed_at timestamptz not null default now(),
  token_expires_at   timestamptz,
  -- Solo se importa lo publicado desde este momento (nunca el historial).
  watch_since        timestamptz not null default now(),
  auto_publish       boolean not null default true,
  connected_by       uuid references public.profiles (id),
  connected_at       timestamptz not null default now(),
  last_checked_at    timestamptz,
  last_error         text,
  updated_at         timestamptz not null default now()
);

create trigger trg_instagram_connection_updated_at
  before update on public.instagram_connection
  for each row execute function public.set_updated_at();

alter table public.instagram_connection enable row level security;

comment on table public.instagram_connection is
  'Conexión con Instagram (token cifrado). Solo service role: RLS sin políticas.';

-- ------------------------------------------------------------
-- Bandeja de importaciones: una fila por historia o publicación vista.
-- ------------------------------------------------------------
create table public.instagram_imports (
  id                  uuid primary key default gen_random_uuid(),
  media_id            text not null unique,
  source              text not null check (source in ('historia', 'publicacion')),
  media_type          text not null,
  permalink           text,
  posted_at           timestamptz not null,
  -- Copias de las fotos en el bucket público product-images (instagram/<media_id>/…).
  image_paths         text[] not null default '{}',
  status              text not null default 'procesando' check (status in (
                        'procesando', -- tomada por una revisión en curso
                        'publicado',  -- se creó el producto y quedó publicado
                        'borrador',   -- se creó el producto; falta el precio para publicar
                        'pendiente',  -- se parece a algo del catálogo (o falta la marca): espera aprobación
                        'descartado', -- no es un producto a la venta, o lo descartó una persona
                        'aprobado',   -- una persona lo resolvió (agregó fotos o creó el producto)
                        'sin_ia',     -- falta la IA (sin clave o tope mensual): se reintenta
                        'error'
                      )),
  reason              text,
  ai_result           jsonb,
  detected_price_usd  numeric(14, 2),
  matched_product_ids uuid[] not null default '{}',
  product_id          uuid references public.products (id) on delete set null,
  attempts            integer not null default 0,
  reviewed_by         uuid references public.profiles (id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_instagram_imports_status on public.instagram_imports (status, posted_at desc);
create index idx_instagram_imports_posted on public.instagram_imports (posted_at desc);

create trigger trg_instagram_imports_updated_at
  before update on public.instagram_imports
  for each row execute function public.set_updated_at();

alter table public.instagram_imports enable row level security;

-- El personal la ve; solo un administrador la resuelve. Las filas nuevas
-- las crea únicamente el servidor (service role).
create policy "instagram_imports_staff_read"
  on public.instagram_imports for select
  to authenticated
  using (public.is_active_staff());

create policy "instagram_imports_admin_update"
  on public.instagram_imports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- Publicación con precio leído de Instagram.
-- Misma lógica que set_listing_price (precio en USD, historial) +
-- estado disponible + publicado, con el usuario indicado como autor.
-- Solo la ejecuta el servidor: nunca desde el navegador.
-- ------------------------------------------------------------
create or replace function public.instagram_publish_with_price(
  p_product_id uuid,
  p_amount_usd numeric,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric;
  v_product public.products%rowtype;
  v_usd numeric(14, 2);
  v_uyu numeric(14, 2);
begin
  if p_amount_usd is null or p_amount_usd <= 0 then
    raise exception 'VALIDATION: el precio debe ser mayor que cero.';
  end if;

  v_rate := public.get_catalogue_rate();
  if v_rate is null or v_rate <= 0 then
    raise exception 'VALIDATION: no hay una cotización del dólar cargada.';
  end if;

  select * into v_product from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND: el producto no existe.';
  end if;

  if v_product.status not in ('disponible', 'reservado', 'no_publicado') then
    raise exception 'VALIDATION: el producto no se puede publicar en su estado actual.';
  end if;

  v_usd := round(p_amount_usd, 2);
  v_uyu := round(p_amount_usd * v_rate, 2);

  insert into public.product_price_history
    (product_id, old_amount, old_currency, new_amount, new_currency,
     exchange_rate, new_amount_usd, new_amount_uyu, changed_by)
  values
    (p_product_id, v_product.listing_price_amount, v_product.listing_price_currency,
     v_usd, 'USD', v_rate, v_usd, v_uyu, p_actor);

  update public.products set
    listing_price_amount   = v_usd,
    listing_price_currency = 'USD',
    listing_price_usd      = v_usd,
    listing_price_uyu      = v_uyu,
    listing_exchange_rate  = v_rate,
    listing_rate_date      = current_date,
    listing_updated_at     = now(),
    status                 = case when v_product.status = 'reservado' then 'reservado'::public.product_status
                                  else 'disponible'::public.product_status end,
    is_published           = true,
    published_at           = now(),
    updated_by             = p_actor
  where id = p_product_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, new_values)
  values (p_actor, 'instagram_publicar', 'producto', p_product_id,
          jsonb_build_object('precio_usd', v_usd));
end;
$$;

revoke execute on function public.instagram_publish_with_price(uuid, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.instagram_publish_with_price(uuid, numeric, uuid)
  to service_role;

commit;

-- Verificación: debe devolver 2 filas.
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('instagram_connection', 'instagram_imports');
