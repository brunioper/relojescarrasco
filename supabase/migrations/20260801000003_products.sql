-- ============================================================
-- Relojes Carrasco — Migración 3: dominio de productos
-- products, product_images, purchases, product_costs,
-- product_price_history, product_status_history
-- ============================================================

-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
create table public.products (
  id                     uuid primary key default gen_random_uuid(),

  -- Identificación
  name                   text not null,
  brand                  text not null,
  model                  text not null default '',
  reference_number       text,
  serial_number          text,            -- PRIVADO: nunca se expone públicamente
  slug                   text not null unique,
  year_approx            int check (year_approx is null or (year_approx between 1800 and 2100)),

  -- Detalles técnicos
  movement               public.movement_type not null default 'automatico',
  case_material          text,
  strap_material         text,
  diameter_mm            numeric(5, 1) check (diameter_mm is null or diameter_mm > 0),
  water_resistance       text,
  gender                 text,

  -- Estado y accesorios
  condition              text not null default '',
  includes_box           boolean not null default false,
  includes_documentation boolean not null default false,
  includes_accessories   text,
  public_description     text not null default '',
  internal_notes         text,            -- PRIVADO

  -- Publicación
  status                 public.product_status not null default 'no_publicado',
  is_published           boolean not null default false,
  is_featured            boolean not null default false,
  published_at           timestamptz,

  -- Precio de lista (el histórico vive en product_price_history)
  listing_price_amount   numeric(14, 2) check (listing_price_amount is null or listing_price_amount >= 0),
  listing_price_currency public.currency_code,
  listing_price_usd      numeric(14, 2) check (listing_price_usd is null or listing_price_usd >= 0),
  listing_price_uyu      numeric(14, 2) check (listing_price_uyu is null or listing_price_uyu >= 0),
  listing_exchange_rate  numeric(14, 4) check (listing_exchange_rate is null or listing_exchange_rate > 0),
  listing_rate_date      date,
  listing_updated_at     timestamptz,

  -- Ciclo de vida
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references public.profiles (id),
  updated_by             uuid references public.profiles (id),

  -- Integridad: un producto vendido/archivado/eliminado nunca está publicado
  check (status <> 'vendido' or is_published = false),
  check (status <> 'archivado' or is_published = false),
  check (deleted_at is null or is_published = false),
  -- Si hay precio de lista, el bloque completo debe existir
  check (
    (listing_price_amount is null and listing_price_currency is null)
    or (listing_price_amount is not null and listing_price_currency is not null
        and listing_price_usd is not null and listing_price_uyu is not null
        and listing_exchange_rate is not null)
  )
);

create index idx_products_status on public.products (status) where deleted_at is null;
create index idx_products_published on public.products (is_published, status) where deleted_at is null;
create index idx_products_brand on public.products (brand) where deleted_at is null;
create index idx_products_featured on public.products (is_featured) where deleted_at is null and is_published = true;
create index idx_products_listing_usd on public.products (listing_price_usd) where deleted_at is null;
create index idx_products_created on public.products (created_at desc);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Un producto solo puede pasar a "vendido" si existe su venta activa
-- (la RPC mark_product_sold inserta la venta antes de cambiar el estado).
-- También impide eliminar físicamente productos vendidos.
create or replace function public.guard_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.sales s where s.product_id = old.id and s.is_cancelled = false) then
      raise exception 'Un producto vendido no puede eliminarse definitivamente. Use archivado.';
    end if;
    return old;
  end if;

  if new.status = 'vendido' and old.status is distinct from 'vendido' then
    if not exists (select 1 from public.sales s where s.product_id = new.id and s.is_cancelled = false) then
      raise exception 'Un producto solo puede marcarse como vendido registrando la venta (mark_product_sold).';
    end if;
  end if;

  return new;
end;
$$;

-- Nota: el trigger de DELETE se crea después de la tabla sales (migración 4).

-- ------------------------------------------------------------
-- product_images
-- ------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  is_cover     boolean not null default false,
  sort_order   int not null default 0,
  alt_text     text,
  width        int,
  height       int,
  size_bytes   int,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id)
);

create index idx_product_images_product on public.product_images (product_id, sort_order);
create unique index uq_product_images_cover on public.product_images (product_id) where is_cover = true;

-- ------------------------------------------------------------
-- purchases (una compra por producto)
-- ------------------------------------------------------------
create table public.purchases (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null unique references public.products (id) on delete restrict,
  purchase_date  date not null,
  amount         numeric(14, 2) not null check (amount >= 0),
  currency       public.currency_code not null,
  exchange_rate  numeric(14, 4) not null check (exchange_rate > 0),
  amount_usd     numeric(14, 2) not null check (amount_usd >= 0),
  amount_uyu     numeric(14, 2) not null check (amount_uyu >= 0),
  supplier_id    uuid references public.suppliers (id),
  payment_method text,
  payment_status public.payment_status not null default 'pendiente',
  amount_paid    numeric(14, 2) not null default 0 check (amount_paid >= 0),
  notes          text,
  receipt_path   text,          -- ruta en bucket privado
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  updated_by     uuid references public.profiles (id)
);

create index idx_purchases_date on public.purchases (purchase_date desc);
create index idx_purchases_supplier on public.purchases (supplier_id);
create index idx_purchases_currency on public.purchases (currency);
create index idx_purchases_payment_status on public.purchases (payment_status);

create trigger trg_purchases_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- product_costs (costos directos: service, reparación, etc.)
-- ------------------------------------------------------------
create table public.product_costs (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete restrict,
  category_id    uuid not null references public.expense_categories (id),
  description    text not null default '',
  cost_date      date not null,
  amount         numeric(14, 2) not null check (amount >= 0),
  currency       public.currency_code not null,
  exchange_rate  numeric(14, 4) not null check (exchange_rate > 0),
  amount_usd     numeric(14, 2) not null check (amount_usd >= 0),
  amount_uyu     numeric(14, 2) not null check (amount_uyu >= 0),
  supplier_id    uuid references public.suppliers (id),
  payment_method text,
  payment_status public.payment_status not null default 'pendiente',
  amount_paid    numeric(14, 2) not null default 0 check (amount_paid >= 0),
  due_date       date,
  receipt_path   text,
  notes          text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  updated_by     uuid references public.profiles (id)
);

create index idx_product_costs_product on public.product_costs (product_id) where deleted_at is null;
create index idx_product_costs_date on public.product_costs (cost_date desc);
create index idx_product_costs_category on public.product_costs (category_id);
create index idx_product_costs_payment_status on public.product_costs (payment_status);

create trigger trg_product_costs_updated_at
  before update on public.product_costs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- product_price_history
-- ------------------------------------------------------------
create table public.product_price_history (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  old_amount     numeric(14, 2),
  old_currency   public.currency_code,
  new_amount     numeric(14, 2) not null check (new_amount >= 0),
  new_currency   public.currency_code not null,
  exchange_rate  numeric(14, 4) not null check (exchange_rate > 0),
  new_amount_usd numeric(14, 2) not null,
  new_amount_uyu numeric(14, 2) not null,
  changed_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now()
);

create index idx_price_history_product on public.product_price_history (product_id, created_at desc);

-- ------------------------------------------------------------
-- product_status_history
-- ------------------------------------------------------------
create table public.product_status_history (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  old_status  public.product_status,
  new_status  public.product_status not null,
  note        text,
  changed_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index idx_status_history_product on public.product_status_history (product_id, created_at desc);

-- Registrar automáticamente todo cambio de estado.
create or replace function public.track_product_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.product_status_history (product_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.product_status_history (product_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_track_product_status
  after insert or update on public.products
  for each row execute function public.track_product_status();

-- ------------------------------------------------------------
-- Auditoría del dominio de productos
-- ------------------------------------------------------------
create trigger trg_audit_products
  after insert or update or delete on public.products
  for each row execute function public.audit_row_change('producto');

create trigger trg_audit_purchases
  after insert or update or delete on public.purchases
  for each row execute function public.audit_row_change('compra');

create trigger trg_audit_product_costs
  after insert or update or delete on public.product_costs
  for each row execute function public.audit_row_change('costo_producto');

create trigger trg_audit_price_history
  after insert on public.product_price_history
  for each row execute function public.audit_row_change('precio_lista');
