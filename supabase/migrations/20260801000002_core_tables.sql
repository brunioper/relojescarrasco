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
