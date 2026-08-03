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
