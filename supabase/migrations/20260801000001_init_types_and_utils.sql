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
