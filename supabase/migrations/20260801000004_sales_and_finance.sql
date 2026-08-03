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
