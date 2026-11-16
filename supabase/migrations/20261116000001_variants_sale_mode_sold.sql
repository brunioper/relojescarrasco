-- ============================================================
-- Relojes Carrasco — Migración 13: variantes, compatibilidad,
-- modo de venta, nuevo/usado y vendidos recientes
--
-- TODO ES ADITIVO: no borra ni modifica datos existentes. El sitio
-- anterior sigue funcionando igual con esta migración aplicada.
-- Se puede ejecutar más de una vez sin efectos (idempotente).
--
--  1. products.sale_mode  catálogo / consultar / comprar (interruptor
--     por producto; deja listo el pago online para más adelante).
--  2. products.is_new     nuevo o usado (hoy el estado es texto libre).
--  3. product_variants    variantes de una correa/accesorio (ancho,
--     material, color) con stock propio. El stock del producto pasa a
--     ser la suma de sus variantes (lo mantiene un trigger).
--  4. product_compatibility  con qué marca/modelo de reloj es
--     compatible una correa.
--  5. sales.variant_id + sell_variant_stock + cancel_sale: la venta
--     descuenta (y la cancelación devuelve) el stock de la variante.
--  6. Vistas públicas: el catálogo expone sale_mode, is_new, variantes
--     y compatibilidad; public_sold_products muestra vendidos recientes
--     SIN precio ni datos privados.
-- ============================================================

-- ------------------------------------------------------------
-- 1 y 2. Modo de venta y nuevo/usado
-- ------------------------------------------------------------
do $$ begin
  create type public.product_sale_mode as enum ('catalogo', 'consultar', 'comprar');
exception when duplicate_object then null; end $$;

alter table public.products
  add column if not exists sale_mode public.product_sale_mode not null default 'consultar';

alter table public.products
  add column if not exists is_new boolean not null default false;

comment on column public.products.sale_mode is
  'catalogo: solo se muestra. consultar: botón de consulta (Instagram/WhatsApp). comprar: se puede comprar online.';

-- ------------------------------------------------------------
-- 3. Variantes
-- ------------------------------------------------------------
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  width_mm       numeric(4, 1) check (width_mm is null or (width_mm > 0 and width_mm <= 60)),
  material       text,
  color          text,
  sku            text,
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  -- Precio propio de la variante (USD). null = usa el precio del producto.
  price_usd      numeric(14, 2) check (price_usd is null or price_usd >= 0),
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  updated_by     uuid references public.profiles (id)
);

create index if not exists idx_product_variants_product
  on public.product_variants (product_id, sort_order);

-- No repetir la misma combinación dentro de un producto.
create unique index if not exists uq_product_variants_combo
  on public.product_variants (
    product_id,
    coalesce(width_mm, 0),
    lower(coalesce(material, '')),
    lower(coalesce(color, ''))
  );

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_product_variants on public.product_variants;
create trigger trg_audit_product_variants
  after insert or update or delete on public.product_variants
  for each row execute function public.audit_row_change('variante');

-- Las variantes son solo para accesorios.
create or replace function public.guard_variant_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.category = 'accesorio'
  ) then
    raise exception 'VALIDATION: las variantes solo se pueden cargar en accesorios.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_variant_product on public.product_variants;
create trigger trg_guard_variant_product
  before insert or update of product_id on public.product_variants
  for each row execute function public.guard_variant_product();

-- El stock del producto es la suma del stock de sus variantes activas.
-- Así el catálogo, los reportes y el resto del sistema siguen leyendo
-- products.stock_quantity sin cambios.
create or replace function public.sync_product_stock_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  v_product_id := coalesce(new.product_id, old.product_id);

  update public.products p
  set stock_quantity = (
    select coalesce(sum(v.stock_quantity), 0)
    from public.product_variants v
    where v.product_id = v_product_id and v.is_active = true
  )
  where p.id = v_product_id
    and p.category = 'accesorio'
    and exists (select 1 from public.product_variants v where v.product_id = v_product_id);

  return null;
end;
$$;

drop trigger if exists trg_sync_product_stock on public.product_variants;
create trigger trg_sync_product_stock
  after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock_from_variants();

-- Y a la inversa: si un accesorio tiene variantes, nadie puede dejar su
-- stock total distinto de la suma (por ejemplo al guardar el formulario
-- del producto): la base lo recalcula siempre.
create or replace function public.enforce_variant_stock_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_total int;
begin
  if new.category = 'accesorio' then
    select count(*), coalesce(sum(v.stock_quantity) filter (where v.is_active), 0)
    into v_count, v_total
    from public.product_variants v
    where v.product_id = new.id;

    if v_count > 0 then
      new.stock_quantity := v_total;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_variant_stock_total on public.products;
create trigger trg_enforce_variant_stock_total
  before update on public.products
  for each row execute function public.enforce_variant_stock_total();

alter table public.product_variants enable row level security;

drop policy if exists "product_variants_select_staff" on public.product_variants;
create policy "product_variants_select_staff" on public.product_variants
  for select to authenticated using (public.is_active_staff());
drop policy if exists "product_variants_insert_admin" on public.product_variants;
create policy "product_variants_insert_admin" on public.product_variants
  for insert to authenticated with check (public.is_admin());
drop policy if exists "product_variants_update_admin" on public.product_variants;
create policy "product_variants_update_admin" on public.product_variants
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "product_variants_delete_admin" on public.product_variants;
create policy "product_variants_delete_admin" on public.product_variants
  for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- 4. Compatibilidad correa ↔ reloj
-- ------------------------------------------------------------
create table if not exists public.product_compatibility (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  brand       text not null check (btrim(brand) <> ''),
  -- null = compatible con todos los modelos de la marca.
  model       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id)
);

create unique index if not exists uq_product_compatibility
  on public.product_compatibility (product_id, lower(brand), lower(coalesce(model, '')));
create index if not exists idx_product_compatibility_brand
  on public.product_compatibility (lower(brand));

alter table public.product_compatibility enable row level security;

drop policy if exists "product_compatibility_select_staff" on public.product_compatibility;
create policy "product_compatibility_select_staff" on public.product_compatibility
  for select to authenticated using (public.is_active_staff());
drop policy if exists "product_compatibility_insert_admin" on public.product_compatibility;
create policy "product_compatibility_insert_admin" on public.product_compatibility
  for insert to authenticated with check (public.is_admin());
drop policy if exists "product_compatibility_delete_admin" on public.product_compatibility;
create policy "product_compatibility_delete_admin" on public.product_compatibility
  for delete to authenticated using (public.is_admin());

-- El público nunca lee estas tablas directamente (solo las vistas).
revoke all on public.product_variants from anon;
revoke all on public.product_compatibility from anon;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select, insert, update, delete on public.product_compatibility to authenticated;

-- ------------------------------------------------------------
-- 5. Ventas por variante
-- ------------------------------------------------------------
alter table public.sales
  add column if not exists variant_id uuid references public.product_variants (id) on delete set null;

create index if not exists idx_sales_variant on public.sales (variant_id) where variant_id is not null;

-- Vende unidades de UNA variante. Reutiliza sell_accessory_stock para
-- toda la lógica de venta, cobro y caja, y luego ajusta el stock de la
-- variante (el trigger recalcula el total del producto).
create or replace function public.sell_variant_stock(
  p_variant_id uuid,
  p_quantity int,
  p_sale_date date,
  p_amount numeric,
  p_currency public.currency_code,
  p_exchange_rate numeric,
  p_customer_id uuid default null,
  p_payment_method text default null,
  p_amount_received numeric default 0,
  p_cash_account_id uuid default null,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant public.product_variants%rowtype;
  v_sale_id uuid;
begin
  perform public.assert_admin();

  select * into v_variant from public.product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: la variante no existe.';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'VALIDATION: la cantidad debe ser al menos 1.';
  end if;
  if v_variant.stock_quantity < p_quantity then
    raise exception 'VALIDATION: stock insuficiente de la variante (disponible: %).', v_variant.stock_quantity;
  end if;

  -- Valida producto, fechas e importes; inserta venta, cobro y caja;
  -- descuenta products.stock_quantity.
  v_sale_id := public.sell_accessory_stock(
    v_variant.product_id, p_quantity, p_sale_date, p_amount, p_currency, p_exchange_rate,
    p_customer_id, p_payment_method, p_amount_received, p_cash_account_id, p_due_date, p_notes
  );

  update public.sales set variant_id = p_variant_id where id = v_sale_id;

  -- Descuenta la variante; el trigger deja products.stock_quantity = suma.
  update public.product_variants
  set stock_quantity = stock_quantity - p_quantity
  where id = p_variant_id;

  return v_sale_id;
end;
$$;

revoke execute on function public.sell_variant_stock(
  uuid, int, date, numeric, public.currency_code, numeric, uuid, text, numeric, uuid, date, text
) from anon, public;
grant execute on function public.sell_variant_stock(
  uuid, int, date, numeric, public.currency_code, numeric, uuid, text, numeric, uuid, date, text
) to authenticated;

-- Cancelar venta: si fue de una variante, devuelve el stock a la variante
-- (el trigger recalcula el total). Resto del comportamiento sin cambios.
create or replace function public.cancel_sale(
  p_sale_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_sale public.sales%rowtype;
  v_category public.product_category;
begin
  v_uid := public.assert_admin();

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'NOT_FOUND: la venta no existe.';
  end if;
  if v_sale.is_cancelled then
    raise exception 'VALIDATION: la venta ya está cancelada.';
  end if;

  update public.sales set
    is_cancelled = true,
    cancelled_at = now(),
    cancelled_reason = coalesce(p_reason, ''),
    payment_status = 'cancelado',
    updated_by = v_uid
  where id = p_sale_id;

  select category into v_category from public.products where id = v_sale.product_id;

  if v_category = 'accesorio' then
    if v_sale.variant_id is not null
       and exists (select 1 from public.product_variants where id = v_sale.variant_id) then
      update public.product_variants
      set stock_quantity = stock_quantity + v_sale.quantity
      where id = v_sale.variant_id;
    else
      update public.products set
        stock_quantity = coalesce(stock_quantity, 0) + v_sale.quantity,
        updated_by = v_uid
      where id = v_sale.product_id;
    end if;
  else
    update public.products set
      status = 'disponible',
      is_published = false,
      updated_by = v_uid
    where id = v_sale.product_id;
  end if;

  perform public.log_audit('cancelar_venta', 'venta', p_sale_id,
    jsonb_build_object('is_cancelled', false),
    jsonb_build_object('is_cancelled', true, 'reason', p_reason));
end;
$$;

revoke execute on function public.cancel_sale(uuid, text) from anon;

-- ------------------------------------------------------------
-- 6a. Vista pública del catálogo (mismas columnas + nuevas al final)
-- ------------------------------------------------------------
create or replace view public.public_catalogue_products
with (security_barrier = true, security_invoker = false)
as
select
  p.id,
  p.slug,
  p.name,
  p.brand,
  p.model,
  p.reference_number,
  p.year_approx,
  p.movement,
  p.case_material,
  p.strap_material,
  p.diameter_mm,
  p.water_resistance,
  p.gender,
  p.condition,
  p.includes_box,
  p.includes_documentation,
  p.includes_accessories,
  p.public_description,
  p.status,
  p.is_featured,
  p.listing_price_usd as price_usd,
  p.published_at,
  p.listing_updated_at,
  p.updated_at,
  cover.storage_path as cover_image_path,
  cover.alt_text as cover_image_alt,
  coalesce(gallery.images, '[]'::jsonb) as images,
  p.category,
  p.stock_quantity,
  p.sale_mode,
  p.is_new,
  coalesce(variants.items, '[]'::jsonb) as variants,
  coalesce(compat.items, '[]'::jsonb) as compatibility
from public.products p
left join lateral (
  select pi.storage_path, pi.alt_text
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_cover desc, pi.sort_order asc, pi.created_at asc
  limit 1
) cover on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'path', pi.storage_path,
      'alt', coalesce(pi.alt_text, p.name),
      'is_cover', pi.is_cover,
      'sort_order', pi.sort_order,
      'width', pi.width,
      'height', pi.height
    ) order by pi.is_cover desc, pi.sort_order asc, pi.created_at asc
  ) as images
  from public.product_images pi
  where pi.product_id = p.id
) gallery on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', v.id,
      'width_mm', v.width_mm,
      'material', v.material,
      'color', v.color,
      'stock', v.stock_quantity,
      'price_usd', coalesce(v.price_usd, p.listing_price_usd)
    ) order by v.sort_order asc, v.width_mm asc nulls last, v.created_at asc
  ) as items
  from public.product_variants v
  where v.product_id = p.id and v.is_active = true
) variants on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object('brand', c.brand, 'model', c.model)
    order by c.brand asc, c.model asc nulls first
  ) as items
  from public.product_compatibility c
  where c.product_id = p.id
) compat on true
where p.is_published = true
  and p.deleted_at is null
  and p.listing_price_usd is not null
  and (
    (p.category = 'reloj' and (
      p.status = 'disponible'
      or (
        p.status = 'reservado'
        and coalesce((
          select (s.value ->> 'value')::boolean
          from public.application_settings s
          where s.key = 'show_reserved_products'
        ), false)
      )
    ))
    or
    (p.category = 'accesorio' and p.status = 'disponible' and p.stock_quantity > 0)
  );

comment on view public.public_catalogue_products is
  'Única superficie de lectura de productos para visitantes anónimos. Sin datos financieros ni privados.';

grant select on public.public_catalogue_products to anon, authenticated;

-- ------------------------------------------------------------
-- 6b. Vendidos recientes (prueba social)
-- Solo relojes vendidos, SIN precio, comprador ni fecha exacta.
-- Se puede apagar con la configuración show_sold_products = false.
-- ------------------------------------------------------------
create or replace view public.public_sold_products
with (security_barrier = true, security_invoker = false)
as
select
  p.id,
  p.name,
  p.brand,
  p.model,
  p.reference_number,
  cover.storage_path as cover_image_path,
  date_trunc('month', s.sale_date)::date as sold_month
from public.products p
join lateral (
  select sa.sale_date
  from public.sales sa
  where sa.product_id = p.id and sa.is_cancelled = false
  order by sa.sale_date desc
  limit 1
) s on true
join lateral (
  select pi.storage_path
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_cover desc, pi.sort_order asc, pi.created_at asc
  limit 1
) cover on true
where p.category = 'reloj'
  and p.status = 'vendido'
  and p.deleted_at is null
  and coalesce((
    select (st.value ->> 'value')::boolean
    from public.application_settings st
    where st.key = 'show_sold_products'
  ), true);

comment on view public.public_sold_products is
  'Relojes vendidos para mostrar como prueba social. Nunca expone precio, comprador ni fecha exacta.';

grant select on public.public_sold_products to anon, authenticated;
