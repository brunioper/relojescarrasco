-- ============================================================
-- RELOJES CARRASCO — SETUP COMPLETO DE PRODUCCIÓN
-- Pegar TODO este archivo en: Supabase Dashboard → SQL Editor → Run
-- (equivale a supabase db push: esquema + funciones + RLS + buckets)
-- Ejecutar UNA sola vez en un proyecto vacío.
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000001_init_types_and_utils.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 1: extensiones, tipos y utilidades
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tipos enumerados
-- ------------------------------------------------------------
create type public.currency_code as enum ('USD', 'UYU');

create type public.user_role as enum ('admin', 'viewer');

create type public.product_status as enum (
  'disponible',
  'reservado',
  'vendido',
  'en_reparacion',
  'no_publicado',
  'archivado'
);

create type public.movement_type as enum (
  'automatico',
  'manual',
  'cuarzo',
  'solar',
  'otro'
);

create type public.payment_status as enum (
  'pagado',
  'parcial',
  'pendiente',
  'cancelado'
);

create type public.payment_transaction_type as enum (
  'venta',
  'compra',
  'costo_producto',
  'gasto_general',
  'gasto_venta'
);

create type public.cash_transaction_type as enum (
  'cobro_venta',
  'otro_ingreso',
  'aporte_dueno',
  'pago_compra',
  'pago_costo_producto',
  'pago_gasto_general',
  'pago_gasto_venta',
  'retiro_dueno',
  'otro_egreso',
  'transferencia_entrada',
  'transferencia_salida',
  'ajuste_positivo',
  'ajuste_negativo'
);

create type public.expense_category_kind as enum (
  'costo_producto',
  'gasto_general',
  'gasto_venta'
);

-- ------------------------------------------------------------
-- Utilidades genéricas
-- ------------------------------------------------------------

-- Mantiene updated_at automáticamente.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Dirección (entrada/salida) de un movimiento de caja según su tipo.
create or replace function public.cash_transaction_direction(t public.cash_transaction_type)
returns int
language sql
immutable
as $$
  select case t
    when 'cobro_venta' then 1
    when 'otro_ingreso' then 1
    when 'aporte_dueno' then 1
    when 'transferencia_entrada' then 1
    when 'ajuste_positivo' then 1
    else -1
  end;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000002_core_tables.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 2: tablas núcleo
-- profiles, suppliers, customers, expense_categories,
-- exchange_rates, application_settings, cash_accounts, audit_logs
-- ============================================================

-- ------------------------------------------------------------
-- profiles: perfil de confianza vinculado a auth.users
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.user_role not null default 'viewer',
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de confianza. El rol y estado SIEMPRE se leen de aquí en el servidor, nunca del navegador.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Al crear un usuario en auth.users se crea su perfil.
-- Por seguridad el perfil nace como viewer INACTIVO: un administrador
-- (o el operador de la base) debe activarlo y asignar rol.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'viewer',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Funciones de autorización (usadas por RLS y por RPCs)
-- SECURITY DEFINER para poder leer profiles sin recursión de RLS.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_active_staff() from anon;

-- Impide que un usuario cambie su propio rol o estado por la vía normal.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El service role (jobs de mantenimiento del operador) no pasa por aquí
  -- con auth.uid(); las peticiones normales sí.
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role then
      raise exception 'No puede modificar su propio rol.';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'No puede modificar el estado de su propia cuenta.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ------------------------------------------------------------
-- suppliers / customers
-- ------------------------------------------------------------
create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  notes         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id),
  updated_by    uuid references public.profiles (id)
);

create index idx_suppliers_name on public.suppliers (name) where deleted_at is null;

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  phone         text,
  email         text,
  document_id   text,
  notes         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id),
  updated_by    uuid references public.profiles (id)
);

create index idx_customers_full_name on public.customers (full_name) where deleted_at is null;

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- expense_categories
-- ------------------------------------------------------------
create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        public.expense_category_kind not null,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (name, kind)
);

create trigger trg_expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- exchange_rates
-- ------------------------------------------------------------
create table public.exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  base_currency   public.currency_code not null default 'USD',
  quote_currency  public.currency_code not null default 'UYU',
  buy_rate        numeric(14, 4) check (buy_rate is null or buy_rate > 0),
  sell_rate       numeric(14, 4) check (sell_rate is null or sell_rate > 0),
  rate            numeric(14, 4) not null check (rate > 0),
  source          text not null default 'manual',
  rate_date       date not null,
  is_manual       boolean not null default true,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (base_currency <> quote_currency)
);

create index idx_exchange_rates_date on public.exchange_rates (rate_date desc);
create index idx_exchange_rates_active on public.exchange_rates (is_active, rate_date desc);
create unique index uq_exchange_rates_day_source
  on public.exchange_rates (base_currency, quote_currency, rate_date, source);

create trigger trg_exchange_rates_updated_at
  before update on public.exchange_rates
  for each row execute function public.set_updated_at();

-- Las cotizaciones históricas son inmutables: solo se permite
-- activar/desactivar. Nunca se reescribe el valor ni la fecha.
create or replace function public.guard_exchange_rate_update()
returns trigger
language plpgsql
as $$
begin
  if new.rate      is distinct from old.rate
     or new.buy_rate  is distinct from old.buy_rate
     or new.sell_rate is distinct from old.sell_rate
     or new.rate_date is distinct from old.rate_date
     or new.base_currency is distinct from old.base_currency
     or new.quote_currency is distinct from old.quote_currency
     or new.source is distinct from old.source
     or new.is_manual is distinct from old.is_manual then
    raise exception 'Las cotizaciones históricas no pueden modificarse. Cree una nueva cotización.';
  end if;
  return new;
end;
$$;

create trigger trg_guard_exchange_rate_update
  before update on public.exchange_rates
  for each row execute function public.guard_exchange_rate_update();

-- ------------------------------------------------------------
-- application_settings (clave / valor JSON)
-- ------------------------------------------------------------
create table public.application_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);

comment on table public.application_settings is
  'Configuración de la aplicación. Solo las claves listadas en la vista public_settings son visibles públicamente.';

-- ------------------------------------------------------------
-- cash_accounts
-- ------------------------------------------------------------
create table public.cash_accounts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  currency         public.currency_code not null,
  account_type     text not null default 'efectivo'
                   check (account_type in ('efectivo', 'banco', 'otro')),
  initial_balance  numeric(14, 2) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id)
);

create trigger trg_cash_accounts_updated_at
  before update on public.cash_accounts
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- audit_logs
-- ------------------------------------------------------------
create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles (id),
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  old_values   jsonb,
  new_values   jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create index idx_audit_logs_user on public.audit_logs (user_id, created_at desc);
create index idx_audit_logs_created on public.audit_logs (created_at desc);

-- Inserción de auditoría utilizable desde triggers y RPCs.
create or replace function public.log_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_old         jsonb default null,
  p_new         jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new);
end;
$$;

revoke execute on function public.log_audit(text, text, uuid, jsonb, jsonb) from anon;

-- Trigger genérico de auditoría: TG_ARGV[0] = entity_type.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id := new.id;
    perform public.log_audit('crear', v_entity, v_id, null, v_new);
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      v_old := to_jsonb(old);
      v_new := to_jsonb(new);
      v_id := new.id;
      perform public.log_audit('modificar', v_entity, v_id, v_old, v_new);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_id := old.id;
    perform public.log_audit('eliminar', v_entity, v_id, v_old, null);
    return old;
  end if;
  return null;
end;
$$;

-- Auditoría de tablas núcleo.
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('perfil');

create trigger trg_audit_exchange_rates
  after insert or update or delete on public.exchange_rates
  for each row execute function public.audit_row_change('cotizacion');

create trigger trg_audit_application_settings
  after insert or update or delete on public.application_settings
  for each row execute function public.audit_row_change('configuracion');

-- application_settings usa "key" texto como PK, el trigger genérico espera id uuid;
-- se audita con un trigger propio.
drop trigger trg_audit_application_settings on public.application_settings;

create or replace function public.audit_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('crear', 'configuracion:' || new.key, null, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      perform public.log_audit('modificar', 'configuracion:' || new.key, null, to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  else
    perform public.log_audit('eliminar', 'configuracion:' || old.key, null, to_jsonb(old), null);
    return old;
  end if;
end;
$$;

create trigger trg_audit_application_settings
  after insert or update or delete on public.application_settings
  for each row execute function public.audit_setting_change();

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000003_products.sql
-- ╚══════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000004_sales_and_finance.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 4: ventas y finanzas
-- sales, sale_expenses, general_expenses, payments, cash_transactions
-- ============================================================

-- ------------------------------------------------------------
-- sales
-- ------------------------------------------------------------
create table public.sales (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products (id) on delete restrict,
  sale_date             date not null,
  amount                numeric(14, 2) not null check (amount >= 0),
  currency              public.currency_code not null,
  exchange_rate         numeric(14, 4) not null check (exchange_rate > 0),
  amount_usd            numeric(14, 2) not null check (amount_usd >= 0),
  amount_uyu            numeric(14, 2) not null check (amount_uyu >= 0),
  -- Snapshot del precio de lista al momento de la venta
  listing_price_usd_at_sale numeric(14, 2),
  customer_id           uuid references public.customers (id),
  payment_method        text,
  payment_status        public.payment_status not null default 'pendiente',
  amount_paid           numeric(14, 2) not null default 0 check (amount_paid >= 0),
  due_date              date,
  notes                 text,
  is_cancelled          boolean not null default false,
  cancelled_at          timestamptz,
  cancelled_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.profiles (id),
  updated_by            uuid references public.profiles (id)
);

-- Una sola venta activa (no cancelada) por producto.
create unique index uq_sales_active_per_product
  on public.sales (product_id) where is_cancelled = false;

create index idx_sales_date on public.sales (sale_date desc) where is_cancelled = false;
create index idx_sales_customer on public.sales (customer_id);
create index idx_sales_currency on public.sales (currency);
create index idx_sales_payment_status on public.sales (payment_status);

create trigger trg_sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- Ahora que existe sales, activamos el guard de products (definido en migración 3).
create trigger trg_guard_product_change
  before update or delete on public.products
  for each row execute function public.guard_product_change();

-- ------------------------------------------------------------
-- sale_expenses (comisiones, envío, fees de marketplace, etc.)
-- ------------------------------------------------------------
create table public.sale_expenses (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales (id) on delete cascade,
  category_id   uuid not null references public.expense_categories (id),
  description   text not null default '',
  amount        numeric(14, 2) not null check (amount >= 0),
  currency      public.currency_code not null,
  exchange_rate numeric(14, 4) not null check (exchange_rate > 0),
  amount_usd    numeric(14, 2) not null check (amount_usd >= 0),
  amount_uyu    numeric(14, 2) not null check (amount_uyu >= 0),
  payment_status public.payment_status not null default 'pendiente',
  amount_paid   numeric(14, 2) not null default 0 check (amount_paid >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id)
);

create index idx_sale_expenses_sale on public.sale_expenses (sale_id);

create trigger trg_sale_expenses_updated_at
  before update on public.sale_expenses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- general_expenses (gastos no asociados a un reloj)
-- ------------------------------------------------------------
create table public.general_expenses (
  id             uuid primary key default gen_random_uuid(),
  expense_date   date not null,
  category_id    uuid not null references public.expense_categories (id),
  description    text not null,
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
  is_recurring   boolean not null default false,
  receipt_path   text,
  notes          text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  updated_by     uuid references public.profiles (id)
);

create index idx_general_expenses_date on public.general_expenses (expense_date desc) where deleted_at is null;
create index idx_general_expenses_category on public.general_expenses (category_id);
create index idx_general_expenses_supplier on public.general_expenses (supplier_id);
create index idx_general_expenses_payment_status on public.general_expenses (payment_status);
create index idx_general_expenses_currency on public.general_expenses (currency);

create trigger trg_general_expenses_updated_at
  before update on public.general_expenses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- cash_transactions (movimientos de caja)
-- ------------------------------------------------------------
create table public.cash_transactions (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.cash_accounts (id),
  transaction_date  date not null,
  type              public.cash_transaction_type not null,
  amount            numeric(14, 2) not null check (amount > 0),  -- siempre positivo; la dirección la da el tipo
  exchange_rate     numeric(14, 4) not null check (exchange_rate > 0),
  amount_usd        numeric(14, 2) not null check (amount_usd >= 0),
  amount_uyu        numeric(14, 2) not null check (amount_uyu >= 0),
  payment_id        uuid,        -- FK diferida a payments (creada más abajo)
  transfer_group_id uuid,        -- vincula las dos patas de una transferencia
  description       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.profiles (id)
);

create index idx_cash_transactions_account on public.cash_transactions (account_id, transaction_date desc);
create index idx_cash_transactions_date on public.cash_transactions (transaction_date desc);
create index idx_cash_transactions_type on public.cash_transactions (type);
create index idx_cash_transactions_transfer on public.cash_transactions (transfer_group_id);

create trigger trg_cash_transactions_updated_at
  before update on public.cash_transactions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- payments (pagos y cobros, incluidos pagos parciales)
-- ------------------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  transaction_type public.payment_transaction_type not null,
  transaction_id   uuid not null,
  payment_date     date not null,
  amount           numeric(14, 2) not null check (amount > 0),
  currency         public.currency_code not null,
  exchange_rate    numeric(14, 4) not null check (exchange_rate > 0),
  amount_usd       numeric(14, 2) not null check (amount_usd >= 0),
  amount_uyu       numeric(14, 2) not null check (amount_uyu >= 0),
  payment_method   text,
  cash_account_id  uuid references public.cash_accounts (id),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id)
);

create index idx_payments_transaction on public.payments (transaction_type, transaction_id);
create index idx_payments_date on public.payments (payment_date desc);
create index idx_payments_account on public.payments (cash_account_id);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.cash_transactions
  add constraint fk_cash_transactions_payment
  foreign key (payment_id) references public.payments (id) on delete set null;

-- ------------------------------------------------------------
-- Recalcular saldo pagado y estado de pago del comprobante padre
-- cada vez que cambian sus pagos. El pago se convierte a la moneda
-- del comprobante usando los importes convertidos preservados
-- (amount_usd / amount_uyu) del propio pago.
-- ------------------------------------------------------------
create or replace function public.recompute_parent_payment_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.payment_transaction_type;
  v_tx   uuid;
  v_total numeric(14, 2);
  v_currency public.currency_code;
  v_paid numeric(14, 2);
  v_status public.payment_status;
  v_current_status public.payment_status;
begin
  if tg_op = 'DELETE' then
    v_type := old.transaction_type;
    v_tx := old.transaction_id;
  else
    v_type := new.transaction_type;
    v_tx := new.transaction_id;
  end if;

  -- Total y moneda del comprobante padre
  if v_type = 'venta' then
    select amount, currency, payment_status into v_total, v_currency, v_current_status
      from public.sales where id = v_tx for update;
  elsif v_type = 'compra' then
    select amount, currency, payment_status into v_total, v_currency, v_current_status
      from public.purchases where id = v_tx for update;
  elsif v_type = 'costo_producto' then
    select amount, currency, payment_status into v_total, v_currency, v_current_status
      from public.product_costs where id = v_tx for update;
  elsif v_type = 'gasto_general' then
    select amount, currency, payment_status into v_total, v_currency, v_current_status
      from public.general_expenses where id = v_tx for update;
  elsif v_type = 'gasto_venta' then
    select amount, currency, payment_status into v_total, v_currency, v_current_status
      from public.sale_expenses where id = v_tx for update;
  end if;

  if v_total is null then
    raise exception 'El comprobante % (%) no existe.', v_tx, v_type;
  end if;

  -- Suma de pagos en la moneda del comprobante (importes preservados)
  select coalesce(sum(case when v_currency = 'USD' then amount_usd else amount_uyu end), 0)
    into v_paid
    from public.payments
    where transaction_type = v_type and transaction_id = v_tx;

  -- El total pagado no puede superar el total del comprobante
  -- (tolerancia de redondeo de 1 centésimo por conversión de moneda).
  if v_paid > v_total + 0.01 then
    raise exception 'El total pagado (%) supera el total del comprobante (%).', v_paid, v_total;
  end if;

  if v_current_status = 'cancelado' then
    v_status := 'cancelado';
  elsif v_paid >= v_total - 0.01 and v_total > 0 then
    v_status := 'pagado';
    v_paid := least(v_paid, v_total);
  elsif v_paid > 0 then
    v_status := 'parcial';
  else
    v_status := 'pendiente';
  end if;

  if v_type = 'venta' then
    update public.sales set amount_paid = v_paid, payment_status = v_status where id = v_tx;
  elsif v_type = 'compra' then
    update public.purchases set amount_paid = v_paid, payment_status = v_status where id = v_tx;
  elsif v_type = 'costo_producto' then
    update public.product_costs set amount_paid = v_paid, payment_status = v_status where id = v_tx;
  elsif v_type = 'gasto_general' then
    update public.general_expenses set amount_paid = v_paid, payment_status = v_status where id = v_tx;
  elsif v_type = 'gasto_venta' then
    update public.sale_expenses set amount_paid = v_paid, payment_status = v_status where id = v_tx;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_recompute_parent_payment
  after insert or update or delete on public.payments
  for each row execute function public.recompute_parent_payment_state();

-- ------------------------------------------------------------
-- Auditoría de finanzas
-- ------------------------------------------------------------
create trigger trg_audit_sales
  after insert or update or delete on public.sales
  for each row execute function public.audit_row_change('venta');

create trigger trg_audit_sale_expenses
  after insert or update or delete on public.sale_expenses
  for each row execute function public.audit_row_change('gasto_venta');

create trigger trg_audit_general_expenses
  after insert or update or delete on public.general_expenses
  for each row execute function public.audit_row_change('gasto_general');

create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change('pago');

create trigger trg_audit_cash_transactions
  after insert or update or delete on public.cash_transactions
  for each row execute function public.audit_row_change('movimiento_caja');

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000005_business_functions.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 5: funciones de negocio (RPC)
-- Operaciones atómicas con verificación de autorización interna.
-- Todas son SECURITY DEFINER y verifican el perfil de confianza:
-- nunca confían en datos de rol enviados por el cliente.
-- ============================================================

-- ------------------------------------------------------------
-- Verificación interna de administrador activo.
-- ------------------------------------------------------------
create or replace function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: sesión no válida.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_uid and role = 'admin' and is_active = true
  ) then
    raise exception 'FORBIDDEN: se requiere rol de administrador activo.';
  end if;
  return v_uid;
end;
$$;

revoke execute on function public.assert_admin() from anon;

-- ------------------------------------------------------------
-- Cotización activa USD/UYU (la más reciente marcada activa).
-- ------------------------------------------------------------
create or replace function public.get_active_usd_uyu_rate()
returns table (
  rate numeric,
  rate_date date,
  source text,
  is_manual boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select er.rate, er.rate_date, er.source, er.is_manual
  from public.exchange_rates er
  where er.base_currency = 'USD'
    and er.quote_currency = 'UYU'
    and er.is_active = true
  order by er.rate_date desc, er.created_at desc
  limit 1;
$$;

-- ------------------------------------------------------------
-- Cotización del catálogo público.
-- Según configuración: última activa o valor fijo manual.
-- No es información sensible (está implícita en los precios públicos).
-- ------------------------------------------------------------
create or replace function public.get_catalogue_rate()
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_setting jsonb;
  v_rate numeric;
begin
  select value into v_setting
  from public.application_settings
  where key = 'catalogue_exchange_rate';

  if v_setting is not null and v_setting ->> 'mode' = 'fixed'
     and (v_setting ->> 'value') is not null then
    v_rate := (v_setting ->> 'value')::numeric;
    if v_rate > 0 then
      return v_rate;
    end if;
  end if;

  select r.rate into v_rate from public.get_active_usd_uyu_rate() r;
  return v_rate; -- puede ser null si no hay cotizaciones cargadas
end;
$$;

grant execute on function public.get_catalogue_rate() to anon, authenticated;

-- ------------------------------------------------------------
-- Cambiar precio de lista (atómico: histórico + producto).
-- ------------------------------------------------------------
create or replace function public.set_listing_price(
  p_product_id uuid,
  p_amount numeric,
  p_currency public.currency_code,
  p_exchange_rate numeric,
  p_rate_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_product public.products%rowtype;
  v_usd numeric(14, 2);
  v_uyu numeric(14, 2);
begin
  v_uid := public.assert_admin();

  if p_amount is null or p_amount < 0 then
    raise exception 'VALIDATION: el precio de lista no puede ser negativo.';
  end if;
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'VALIDATION: la cotización debe ser mayor que cero.';
  end if;

  select * into v_product from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND: el producto no existe.';
  end if;

  if p_currency = 'USD' then
    v_usd := round(p_amount, 2);
    v_uyu := round(p_amount * p_exchange_rate, 2);
  else
    v_uyu := round(p_amount, 2);
    v_usd := round(p_amount / p_exchange_rate, 2);
  end if;

  insert into public.product_price_history
    (product_id, old_amount, old_currency, new_amount, new_currency,
     exchange_rate, new_amount_usd, new_amount_uyu, changed_by)
  values
    (p_product_id, v_product.listing_price_amount, v_product.listing_price_currency,
     round(p_amount, 2), p_currency, p_exchange_rate, v_usd, v_uyu, v_uid);

  update public.products set
    listing_price_amount   = round(p_amount, 2),
    listing_price_currency = p_currency,
    listing_price_usd      = v_usd,
    listing_price_uyu      = v_uyu,
    listing_exchange_rate  = p_exchange_rate,
    listing_rate_date      = p_rate_date,
    listing_updated_at     = now(),
    updated_by             = v_uid
  where id = p_product_id;
end;
$$;

revoke execute on function public.set_listing_price(uuid, numeric, public.currency_code, numeric, date) from anon;

-- ------------------------------------------------------------
-- Cambiar estado del producto (excepto "vendido": usar mark_product_sold).
-- ------------------------------------------------------------
create or replace function public.change_product_status(
  p_product_id uuid,
  p_new_status public.product_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_product public.products%rowtype;
begin
  v_uid := public.assert_admin();

  if p_new_status = 'vendido' then
    raise exception 'VALIDATION: para marcar como vendido use la operación de venta.';
  end if;

  select * into v_product from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND: el producto no existe.';
  end if;

  if v_product.status = 'vendido' then
    raise exception 'VALIDATION: un producto vendido no puede cambiar de estado; cancele la venta primero.';
  end if;

  update public.products set
    status = p_new_status,
    is_published = case
      when p_new_status in ('archivado') then false
      else is_published
    end,
    updated_by = v_uid
  where id = p_product_id;

  if p_note is not null and p_note <> '' then
    update public.product_status_history
    set note = p_note
    where id = (
      select id from public.product_status_history
      where product_id = p_product_id
      order by created_at desc limit 1
    );
  end if;
end;
$$;

revoke execute on function public.change_product_status(uuid, public.product_status, text) from anon;

-- ------------------------------------------------------------
-- Venta atómica.
-- Valida usuario, producto y datos; crea la venta, sus gastos,
-- el cobro inicial opcional, actualiza el producto y audita.
-- Si algo falla, TODO se revierte (transacción única).
-- ------------------------------------------------------------
create or replace function public.mark_product_sold(
  p_product_id uuid,
  p_sale_date date,
  p_amount numeric,
  p_currency public.currency_code,
  p_exchange_rate numeric,
  p_customer_id uuid default null,
  p_payment_method text default null,
  p_amount_received numeric default 0,
  p_cash_account_id uuid default null,
  p_due_date date default null,
  p_notes text default null,
  p_expenses jsonb default '[]'::jsonb,
  p_allow_date_before_purchase boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_product public.products%rowtype;
  v_purchase_date date;
  v_sale_id uuid;
  v_usd numeric(14, 2);
  v_uyu numeric(14, 2);
  v_exp jsonb;
  v_exp_amount numeric;
  v_exp_currency public.currency_code;
  v_exp_rate numeric;
  v_payment_id uuid;
  v_account public.cash_accounts%rowtype;
begin
  -- 1-3. Usuario autenticado, activo y administrador
  v_uid := public.assert_admin();

  -- 4. El producto existe
  select * into v_product from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND: el producto no existe.';
  end if;

  -- 5. No está ya vendido
  if v_product.status = 'vendido'
     or exists (select 1 from public.sales where product_id = p_product_id and is_cancelled = false) then
    raise exception 'VALIDATION: el producto ya fue vendido.';
  end if;

  -- 6. Fecha de venta válida
  if p_sale_date is null then
    raise exception 'VALIDATION: la fecha de venta es obligatoria.';
  end if;
  if p_sale_date > current_date then
    raise exception 'VALIDATION: la fecha de venta no puede ser futura.';
  end if;

  select purchase_date into v_purchase_date
  from public.purchases where product_id = p_product_id;

  if v_purchase_date is not null
     and p_sale_date < v_purchase_date
     and not p_allow_date_before_purchase then
    raise exception 'CONFIRM_REQUIRED: la fecha de venta es anterior a la fecha de compra. Confirme explícitamente.';
  end if;

  -- 7. Importe válido
  if p_amount is null or p_amount < 0 then
    raise exception 'VALIDATION: el precio de venta no puede ser negativo.';
  end if;
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'VALIDATION: la cotización debe ser mayor que cero.';
  end if;
  if p_amount_received is not null and p_amount_received < 0 then
    raise exception 'VALIDATION: el importe cobrado no puede ser negativo.';
  end if;

  if p_currency = 'USD' then
    v_usd := round(p_amount, 2);
    v_uyu := round(p_amount * p_exchange_rate, 2);
  else
    v_uyu := round(p_amount, 2);
    v_usd := round(p_amount / p_exchange_rate, 2);
  end if;

  -- 8. Crear la venta (preserva cotización histórica y snapshot del precio de lista)
  insert into public.sales
    (product_id, sale_date, amount, currency, exchange_rate, amount_usd, amount_uyu,
     listing_price_usd_at_sale, customer_id, payment_method, due_date, notes,
     created_by, updated_by)
  values
    (p_product_id, p_sale_date, round(p_amount, 2), p_currency, p_exchange_rate, v_usd, v_uyu,
     v_product.listing_price_usd, p_customer_id, p_payment_method, p_due_date, p_notes,
     v_uid, v_uid)
  returning id into v_sale_id;

  -- 9. Gastos de la venta
  for v_exp in select * from jsonb_array_elements(coalesce(p_expenses, '[]'::jsonb))
  loop
    v_exp_amount := (v_exp ->> 'amount')::numeric;
    v_exp_currency := (v_exp ->> 'currency')::public.currency_code;
    v_exp_rate := (v_exp ->> 'exchange_rate')::numeric;

    if v_exp_amount is null or v_exp_amount < 0 then
      raise exception 'VALIDATION: los gastos de venta no pueden ser negativos.';
    end if;
    if v_exp_rate is null or v_exp_rate <= 0 then
      raise exception 'VALIDATION: cotización inválida en gasto de venta.';
    end if;

    insert into public.sale_expenses
      (sale_id, category_id, description, amount, currency, exchange_rate,
       amount_usd, amount_uyu, created_by)
    values
      (v_sale_id,
       (v_exp ->> 'category_id')::uuid,
       coalesce(v_exp ->> 'description', ''),
       round(v_exp_amount, 2),
       v_exp_currency,
       v_exp_rate,
       case when v_exp_currency = 'USD' then round(v_exp_amount, 2) else round(v_exp_amount / v_exp_rate, 2) end,
       case when v_exp_currency = 'UYU' then round(v_exp_amount, 2) else round(v_exp_amount * v_exp_rate, 2) end,
       v_uid);
  end loop;

  -- 10-12. Producto: vendido y despublicado (la cotización de la venta ya quedó preservada)
  update public.products set
    status = 'vendido',
    is_published = false,
    updated_by = v_uid
  where id = p_product_id;
  -- (el historial de estado se registra automáticamente por trigger)

  -- Cobro inicial opcional
  if p_amount_received is not null and p_amount_received > 0 then
    if p_cash_account_id is not null then
      select * into v_account from public.cash_accounts where id = p_cash_account_id and is_active = true;
      if not found then
        raise exception 'VALIDATION: la cuenta de caja no existe o está inactiva.';
      end if;
      if v_account.currency <> p_currency then
        raise exception 'VALIDATION: la moneda de la cuenta (%) no coincide con la del cobro (%).', v_account.currency, p_currency;
      end if;
    end if;

    insert into public.payments
      (transaction_type, transaction_id, payment_date, amount, currency, exchange_rate,
       amount_usd, amount_uyu, payment_method, cash_account_id, created_by)
    values
      ('venta', v_sale_id, p_sale_date, round(p_amount_received, 2), p_currency, p_exchange_rate,
       case when p_currency = 'USD' then round(p_amount_received, 2) else round(p_amount_received / p_exchange_rate, 2) end,
       case when p_currency = 'UYU' then round(p_amount_received, 2) else round(p_amount_received * p_exchange_rate, 2) end,
       p_payment_method, p_cash_account_id, v_uid)
    returning id into v_payment_id;

    if p_cash_account_id is not null then
      insert into public.cash_transactions
        (account_id, transaction_date, type, amount, exchange_rate, amount_usd, amount_uyu,
         payment_id, description, created_by)
      values
        (p_cash_account_id, p_sale_date, 'cobro_venta', round(p_amount_received, 2), p_exchange_rate,
         case when p_currency = 'USD' then round(p_amount_received, 2) else round(p_amount_received / p_exchange_rate, 2) end,
         case when p_currency = 'UYU' then round(p_amount_received, 2) else round(p_amount_received * p_exchange_rate, 2) end,
         v_payment_id, 'Cobro de venta — ' || v_product.name, v_uid);
    end if;
  end if;

  -- 13-14. Auditoría explícita de la operación de venta
  perform public.log_audit(
    'vender', 'producto', p_product_id,
    jsonb_build_object('status', v_product.status, 'is_published', v_product.is_published),
    jsonb_build_object('status', 'vendido', 'is_published', false, 'sale_id', v_sale_id)
  );

  -- 15. Commit implícito al finalizar sin errores; cualquier excepción revierte todo.
  return v_sale_id;
end;
$$;

revoke execute on function public.mark_product_sold(
  uuid, date, numeric, public.currency_code, numeric, uuid, text,
  numeric, uuid, date, text, jsonb, boolean
) from anon;

-- ------------------------------------------------------------
-- Cancelar una venta (revierte el producto a disponible, sin publicar).
-- ------------------------------------------------------------
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

  update public.products set
    status = 'disponible',
    is_published = false,
    updated_by = v_uid
  where id = v_sale.product_id;

  perform public.log_audit('cancelar_venta', 'venta', p_sale_id,
    jsonb_build_object('is_cancelled', false),
    jsonb_build_object('is_cancelled', true, 'reason', p_reason));
end;
$$;

revoke execute on function public.cancel_sale(uuid, text) from anon;

-- ------------------------------------------------------------
-- Registrar un pago/cobro (parcial o total) con movimiento de caja opcional.
-- ------------------------------------------------------------
create or replace function public.register_payment(
  p_transaction_type public.payment_transaction_type,
  p_transaction_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_currency public.currency_code,
  p_exchange_rate numeric,
  p_payment_method text default null,
  p_cash_account_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_payment_id uuid;
  v_account public.cash_accounts%rowtype;
  v_cash_type public.cash_transaction_type;
  v_usd numeric(14, 2);
  v_uyu numeric(14, 2);
begin
  v_uid := public.assert_admin();

  if p_amount is null or p_amount <= 0 then
    raise exception 'VALIDATION: el importe del pago debe ser mayor que cero.';
  end if;
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'VALIDATION: la cotización debe ser mayor que cero.';
  end if;

  if p_currency = 'USD' then
    v_usd := round(p_amount, 2);
    v_uyu := round(p_amount * p_exchange_rate, 2);
  else
    v_uyu := round(p_amount, 2);
    v_usd := round(p_amount / p_exchange_rate, 2);
  end if;

  if p_cash_account_id is not null then
    select * into v_account from public.cash_accounts where id = p_cash_account_id and is_active = true;
    if not found then
      raise exception 'VALIDATION: la cuenta de caja no existe o está inactiva.';
    end if;
    if v_account.currency <> p_currency then
      raise exception 'VALIDATION: la moneda de la cuenta (%) no coincide con la del pago (%).', v_account.currency, p_currency;
    end if;
  end if;

  insert into public.payments
    (transaction_type, transaction_id, payment_date, amount, currency, exchange_rate,
     amount_usd, amount_uyu, payment_method, cash_account_id, notes, created_by)
  values
    (p_transaction_type, p_transaction_id, p_payment_date, round(p_amount, 2), p_currency,
     p_exchange_rate, v_usd, v_uyu, p_payment_method, p_cash_account_id, p_notes, v_uid)
  returning id into v_payment_id;
  -- (el trigger valida sobrepago y recalcula el estado del comprobante)

  if p_cash_account_id is not null then
    v_cash_type := case p_transaction_type
      when 'venta' then 'cobro_venta'::public.cash_transaction_type
      when 'compra' then 'pago_compra'::public.cash_transaction_type
      when 'costo_producto' then 'pago_costo_producto'::public.cash_transaction_type
      when 'gasto_general' then 'pago_gasto_general'::public.cash_transaction_type
      when 'gasto_venta' then 'pago_gasto_venta'::public.cash_transaction_type
    end;

    insert into public.cash_transactions
      (account_id, transaction_date, type, amount, exchange_rate, amount_usd, amount_uyu,
       payment_id, description, created_by)
    values
      (p_cash_account_id, p_payment_date, v_cash_type, round(p_amount, 2), p_exchange_rate,
       v_usd, v_uyu, v_payment_id, coalesce(p_notes, ''), v_uid);
  end if;

  return v_payment_id;
end;
$$;

revoke execute on function public.register_payment(
  public.payment_transaction_type, uuid, date, numeric, public.currency_code,
  numeric, text, uuid, text
) from anon;

-- ------------------------------------------------------------
-- Transferencia entre cuentas de caja (atómica, dos patas).
-- Permite transferencias USD <-> UYU con cotización explícita.
-- ------------------------------------------------------------
create or replace function public.create_cash_transfer(
  p_from_account uuid,
  p_to_account uuid,
  p_date date,
  p_amount_from numeric,
  p_amount_to numeric,
  p_exchange_rate numeric,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_from public.cash_accounts%rowtype;
  v_to public.cash_accounts%rowtype;
  v_group uuid := gen_random_uuid();
begin
  v_uid := public.assert_admin();

  if p_from_account = p_to_account then
    raise exception 'VALIDATION: las cuentas de origen y destino deben ser distintas.';
  end if;
  if p_amount_from is null or p_amount_from <= 0 or p_amount_to is null or p_amount_to <= 0 then
    raise exception 'VALIDATION: los importes deben ser mayores que cero.';
  end if;
  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'VALIDATION: la cotización debe ser mayor que cero.';
  end if;

  select * into v_from from public.cash_accounts where id = p_from_account and is_active = true;
  if not found then raise exception 'VALIDATION: cuenta de origen inválida.'; end if;
  select * into v_to from public.cash_accounts where id = p_to_account and is_active = true;
  if not found then raise exception 'VALIDATION: cuenta de destino inválida.'; end if;

  insert into public.cash_transactions
    (account_id, transaction_date, type, amount, exchange_rate, amount_usd, amount_uyu,
     transfer_group_id, description, created_by)
  values
    (p_from_account, p_date, 'transferencia_salida', round(p_amount_from, 2), p_exchange_rate,
     case when v_from.currency = 'USD' then round(p_amount_from, 2) else round(p_amount_from / p_exchange_rate, 2) end,
     case when v_from.currency = 'UYU' then round(p_amount_from, 2) else round(p_amount_from * p_exchange_rate, 2) end,
     v_group, p_description, v_uid),
    (p_to_account, p_date, 'transferencia_entrada', round(p_amount_to, 2), p_exchange_rate,
     case when v_to.currency = 'USD' then round(p_amount_to, 2) else round(p_amount_to / p_exchange_rate, 2) end,
     case when v_to.currency = 'UYU' then round(p_amount_to, 2) else round(p_amount_to * p_exchange_rate, 2) end,
     v_group, p_description, v_uid);

  return v_group;
end;
$$;

revoke execute on function public.create_cash_transfer(uuid, uuid, date, numeric, numeric, numeric, text) from anon;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000006_rls_policies.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 6: Row Level Security
-- Modelo default-deny: RLS habilitado en TODAS las tablas;
-- sin política explícita no hay acceso.
--
-- Roles de aplicación (leídos del perfil de confianza, nunca del cliente):
--   admin  -> gestión completa
--   viewer -> solo lectura interna
--   anon   -> únicamente las vistas públicas seguras (migración 7)
-- ============================================================

alter table public.profiles              enable row level security;
alter table public.suppliers             enable row level security;
alter table public.customers             enable row level security;
alter table public.expense_categories    enable row level security;
alter table public.exchange_rates        enable row level security;
alter table public.application_settings  enable row level security;
alter table public.cash_accounts         enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.purchases             enable row level security;
alter table public.product_costs         enable row level security;
alter table public.product_price_history enable row level security;
alter table public.product_status_history enable row level security;
alter table public.sales                 enable row level security;
alter table public.sale_expenses         enable row level security;
alter table public.general_expenses      enable row level security;
alter table public.payments              enable row level security;
alter table public.cash_transactions     enable row level security;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- El trigger guard_profile_update impide auto-cambio de rol/estado.
-- Inserciones solo vía trigger handle_new_user (SECURITY DEFINER).
-- Sin política de DELETE: los perfiles no se eliminan por la API.

-- ------------------------------------------------------------
-- Lectura interna (admin + viewer activos), escritura solo admin
-- ------------------------------------------------------------

-- suppliers
create policy "suppliers_select_staff" on public.suppliers
  for select to authenticated using (public.is_active_staff());
create policy "suppliers_insert_admin" on public.suppliers
  for insert to authenticated with check (public.is_admin());
create policy "suppliers_update_admin" on public.suppliers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "suppliers_delete_admin" on public.suppliers
  for delete to authenticated using (public.is_admin());

-- customers
create policy "customers_select_staff" on public.customers
  for select to authenticated using (public.is_active_staff());
create policy "customers_insert_admin" on public.customers
  for insert to authenticated with check (public.is_admin());
create policy "customers_update_admin" on public.customers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customers_delete_admin" on public.customers
  for delete to authenticated using (public.is_admin());

-- expense_categories
create policy "expense_categories_select_staff" on public.expense_categories
  for select to authenticated using (public.is_active_staff());
create policy "expense_categories_insert_admin" on public.expense_categories
  for insert to authenticated with check (public.is_admin());
create policy "expense_categories_update_admin" on public.expense_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- exchange_rates (sin DELETE: histórico inmutable; updates limitados por trigger)
create policy "exchange_rates_select_staff" on public.exchange_rates
  for select to authenticated using (public.is_active_staff());
create policy "exchange_rates_insert_admin" on public.exchange_rates
  for insert to authenticated with check (public.is_admin());
create policy "exchange_rates_update_admin" on public.exchange_rates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- application_settings
create policy "settings_select_staff" on public.application_settings
  for select to authenticated using (public.is_active_staff());
create policy "settings_insert_admin" on public.application_settings
  for insert to authenticated with check (public.is_admin());
create policy "settings_update_admin" on public.application_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- cash_accounts
create policy "cash_accounts_select_staff" on public.cash_accounts
  for select to authenticated using (public.is_active_staff());
create policy "cash_accounts_insert_admin" on public.cash_accounts
  for insert to authenticated with check (public.is_admin());
create policy "cash_accounts_update_admin" on public.cash_accounts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- audit_logs: solo lectura para administradores.
-- Sin políticas de INSERT/UPDATE/DELETE: los registros se crean
-- únicamente vía funciones SECURITY DEFINER y no pueden alterarse
-- desde la interfaz normal.
-- ------------------------------------------------------------
create policy "audit_logs_select_admin" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- products y tablas relacionadas
-- El público NO tiene acceso directo a products: solo a la vista
-- public_catalogue_products (migración 7) con columnas seguras.
-- ------------------------------------------------------------
create policy "products_select_staff" on public.products
  for select to authenticated using (public.is_active_staff());
create policy "products_insert_admin" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "products_update_admin" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products_delete_admin" on public.products
  for delete to authenticated using (public.is_admin());
-- (el trigger guard_product_change impide eliminar productos vendidos)

create policy "product_images_select_staff" on public.product_images
  for select to authenticated using (public.is_active_staff());
create policy "product_images_insert_admin" on public.product_images
  for insert to authenticated with check (public.is_admin());
create policy "product_images_update_admin" on public.product_images
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "product_images_delete_admin" on public.product_images
  for delete to authenticated using (public.is_admin());

create policy "purchases_select_staff" on public.purchases
  for select to authenticated using (public.is_active_staff());
create policy "purchases_insert_admin" on public.purchases
  for insert to authenticated with check (public.is_admin());
create policy "purchases_update_admin" on public.purchases
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "purchases_delete_admin" on public.purchases
  for delete to authenticated using (public.is_admin());

create policy "product_costs_select_staff" on public.product_costs
  for select to authenticated using (public.is_active_staff());
create policy "product_costs_insert_admin" on public.product_costs
  for insert to authenticated with check (public.is_admin());
create policy "product_costs_update_admin" on public.product_costs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "product_costs_delete_admin" on public.product_costs
  for delete to authenticated using (public.is_admin());

-- Histórico de precios: solo lectura; se escribe únicamente vía
-- set_listing_price (SECURITY DEFINER).
create policy "price_history_select_staff" on public.product_price_history
  for select to authenticated using (public.is_active_staff());

-- Histórico de estados: solo lectura; se escribe vía triggers.
create policy "status_history_select_staff" on public.product_status_history
  for select to authenticated using (public.is_active_staff());

-- ------------------------------------------------------------
-- Ventas y finanzas
-- ------------------------------------------------------------
-- sales: la creación pasa por mark_product_sold (SECURITY DEFINER).
-- Se permite UPDATE de admin para notas/vencimientos; la cancelación
-- correcta usa cancel_sale. Sin DELETE (integridad histórica).
create policy "sales_select_staff" on public.sales
  for select to authenticated using (public.is_active_staff());
create policy "sales_update_admin" on public.sales
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "sale_expenses_select_staff" on public.sale_expenses
  for select to authenticated using (public.is_active_staff());
create policy "sale_expenses_insert_admin" on public.sale_expenses
  for insert to authenticated with check (public.is_admin());
create policy "sale_expenses_update_admin" on public.sale_expenses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sale_expenses_delete_admin" on public.sale_expenses
  for delete to authenticated using (public.is_admin());

create policy "general_expenses_select_staff" on public.general_expenses
  for select to authenticated using (public.is_active_staff());
create policy "general_expenses_insert_admin" on public.general_expenses
  for insert to authenticated with check (public.is_admin());
create policy "general_expenses_update_admin" on public.general_expenses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "general_expenses_delete_admin" on public.general_expenses
  for delete to authenticated using (public.is_admin());

-- payments: creación preferente vía register_payment; se permite
-- corrección (update/delete) de admin, siempre auditada y con
-- recálculo automático del comprobante padre.
create policy "payments_select_staff" on public.payments
  for select to authenticated using (public.is_active_staff());
create policy "payments_insert_admin" on public.payments
  for insert to authenticated with check (public.is_admin());
create policy "payments_update_admin" on public.payments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "payments_delete_admin" on public.payments
  for delete to authenticated using (public.is_admin());

create policy "cash_transactions_select_staff" on public.cash_transactions
  for select to authenticated using (public.is_active_staff());
create policy "cash_transactions_insert_admin" on public.cash_transactions
  for insert to authenticated with check (public.is_admin());
create policy "cash_transactions_update_admin" on public.cash_transactions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cash_transactions_delete_admin" on public.cash_transactions
  for delete to authenticated using (public.is_admin());

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000007_public_views.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 7: vistas públicas seguras
--
-- El público (rol anon) NUNCA consulta las tablas base.
-- Solo puede leer estas vistas, que exponen exclusivamente
-- columnas seguras y filas autorizadas.
-- Las vistas son SECURITY DEFINER (propietario postgres) con
-- security_barrier, por lo que omiten RLS de forma controlada.
-- ============================================================

-- ------------------------------------------------------------
-- Catálogo público
-- Solo productos publicados, no eliminados, con precio, y en estado
-- disponible (o reservado si la configuración lo permite).
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
  coalesce(gallery.images, '[]'::jsonb) as images
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
where p.is_published = true
  and p.deleted_at is null
  and p.listing_price_usd is not null
  and (
    p.status = 'disponible'
    or (
      p.status = 'reservado'
      and coalesce((
        select (s.value ->> 'value')::boolean
        from public.application_settings s
        where s.key = 'show_reserved_products'
      ), false)
    )
  );

comment on view public.public_catalogue_products is
  'Única superficie de lectura de productos para visitantes anónimos. Sin datos financieros ni privados.';

-- ------------------------------------------------------------
-- Configuración pública (allowlist estricta de claves seguras)
-- ------------------------------------------------------------
create or replace view public.public_settings
with (security_barrier = true, security_invoker = false)
as
select s.key, s.value
from public.application_settings s
where s.key in (
  'business_name',
  'contact_email',
  'whatsapp_number',
  'instagram_url',
  'address',
  'catalogue_intro',
  'footer_text',
  'privacy_text',
  'terms_text',
  'seo_title',
  'seo_description',
  'site_url',
  'show_uyu_conversion'
);

comment on view public.public_settings is
  'Solo claves de configuración explícitamente públicas. Nunca agregar claves financieras.';

-- ------------------------------------------------------------
-- Permisos: anon únicamente puede leer las vistas públicas.
-- Revocamos todo lo demás por si el esquema otorga defaults.
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.public_catalogue_products to anon, authenticated;
grant select on public.public_settings to anon, authenticated;

-- authenticated conserva el acceso a tablas gobernado por RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Asegurar que futuros objetos no otorguen permisos a anon por defecto.
alter default privileges in schema public revoke all on tables from anon;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ supabase/migrations/20260801000008_storage.sql
-- ╚══════════════════════════════════════════════════════════╝
-- ============================================================
-- Relojes Carrasco — Migración 8: Storage (buckets y políticas)
--
-- product-images    -> público (lectura); escritura solo admin.
--                      Nombres de archivo aleatorios bajo products/{product_id}/.
-- private-documents -> privado; solo admin, acceso vía URLs firmadas
--                      generadas en el servidor.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'private-documents',
    'private-documents',
    false,
    20971520, -- 20 MB
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Políticas sobre storage.objects
-- ------------------------------------------------------------

-- product-images: lectura pública (bucket público) declarada explícitamente.
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- product-images: escritura solo admin y solo bajo products/{uuid}/...
create policy "product_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
    and (storage.foldername(name))[1] = 'products'
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[2]
    )
  );

create policy "product_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- private-documents: SIN acceso anónimo (no hay política para anon).
-- Solo administradores; la app sirve archivos con URLs firmadas de corta vida.
create policy "private_documents_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'private-documents' and public.is_admin());

create policy "private_documents_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'private-documents'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('purchases', 'costs', 'expenses', 'internal')
  );

create policy "private_documents_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'private-documents' and public.is_admin())
  with check (bucket_id = 'private-documents' and public.is_admin());

create policy "private_documents_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'private-documents' and public.is_admin());
