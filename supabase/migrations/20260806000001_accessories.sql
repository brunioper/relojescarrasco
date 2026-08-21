-- ============================================================
-- Relojes Carrasco — Migración 11: accesorios con stock
--
-- Segunda "categoría" de producto además de los relojes únicos:
-- accesorios (correas, estuches, etc.) donde se puede cargar
-- varias unidades del mismo artículo como stock simple. Cada
-- venta descuenta del stock; no hay costo/ganancia por unidad
-- individual, solo por lote (una fila de purchases por producto,
-- igual que hoy).
--
-- Los relojes no cambian de comportamiento: category default
-- 'reloj', stock_quantity queda null para ellos.
-- ============================================================

create type public.product_category as enum ('reloj', 'accesorio');

alter table public.products
  add column category public.product_category not null default 'reloj';

alter table public.products
  add column stock_quantity int;

alter table public.products
  add constraint chk_products_stock_quantity
  check (stock_quantity is null or stock_quantity >= 0);

-- Un accesorio siempre tiene cantidad; un reloj nunca la usa.
alter table public.products
  add constraint chk_products_category_stock
  check ((category = 'accesorio') = (stock_quantity is not null));

-- ------------------------------------------------------------
-- sales.quantity — unidades vendidas en esa venta (relojes: 1).
-- ------------------------------------------------------------
alter table public.sales
  add column quantity int not null default 1;

alter table public.sales
  add constraint chk_sales_quantity check (quantity >= 1);

-- El índice único original asumía una sola venta por producto en
-- toda su vida (correcto para relojes, no para stock de accesorios
-- con ventas parciales repetidas). La integridad para relojes ya la
-- garantiza mark_product_sold explícitamente (lock + exists check);
-- este índice era una segunda barrera redundante para ese caso.
drop index if exists public.uq_sales_active_per_product;
create index if not exists idx_sales_active_product
  on public.sales (product_id) where is_cancelled = false;

-- ------------------------------------------------------------
-- Venta de stock de un accesorio (atómica, análoga a
-- mark_product_sold pero sin tocar status/is_published: el
-- accesorio sigue publicado mientras stock_quantity > 0).
-- ------------------------------------------------------------
create or replace function public.sell_accessory_stock(
  p_product_id uuid,
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
  v_uid uuid;
  v_product public.products%rowtype;
  v_sale_id uuid;
  v_usd numeric(14, 2);
  v_uyu numeric(14, 2);
  v_payment_id uuid;
  v_account public.cash_accounts%rowtype;
begin
  v_uid := public.assert_admin();

  select * into v_product from public.products
  where id = p_product_id and deleted_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND: el producto no existe.';
  end if;

  if v_product.category <> 'accesorio' then
    raise exception 'VALIDATION: esta operación es solo para accesorios.';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'VALIDATION: la cantidad debe ser al menos 1.';
  end if;

  if v_product.stock_quantity is null or v_product.stock_quantity < p_quantity then
    raise exception 'VALIDATION: stock insuficiente (disponible: %).', coalesce(v_product.stock_quantity, 0);
  end if;

  if p_sale_date is null then
    raise exception 'VALIDATION: la fecha de venta es obligatoria.';
  end if;
  if p_sale_date > current_date then
    raise exception 'VALIDATION: la fecha de venta no puede ser futura.';
  end if;

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

  insert into public.sales
    (product_id, sale_date, amount, currency, exchange_rate, amount_usd, amount_uyu,
     quantity, listing_price_usd_at_sale, customer_id, payment_method, due_date, notes,
     created_by, updated_by)
  values
    (p_product_id, p_sale_date, round(p_amount, 2), p_currency, p_exchange_rate, v_usd, v_uyu,
     p_quantity, v_product.listing_price_usd, p_customer_id, p_payment_method, p_due_date, p_notes,
     v_uid, v_uid)
  returning id into v_sale_id;

  update public.products set
    stock_quantity = stock_quantity - p_quantity,
    updated_by = v_uid
  where id = p_product_id;

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

  perform public.log_audit(
    'vender_stock', 'producto', p_product_id,
    jsonb_build_object('stock_quantity', v_product.stock_quantity),
    jsonb_build_object('stock_quantity', v_product.stock_quantity - p_quantity, 'sale_id', v_sale_id, 'quantity', p_quantity)
  );

  return v_sale_id;
end;
$$;

revoke execute on function public.sell_accessory_stock(
  uuid, int, date, numeric, public.currency_code, numeric, uuid, text, numeric, uuid, date, text
) from anon;

-- ------------------------------------------------------------
-- Cancelar venta: para accesorios devuelve la cantidad al stock
-- en vez de resetear el estado del producto (comportamiento de
-- relojes sin cambios).
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
    update public.products set
      stock_quantity = coalesce(stock_quantity, 0) + v_sale.quantity,
      updated_by = v_uid
    where id = v_sale.product_id;
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
-- Vista pública: agrega category/stock_quantity y bifurca la
-- condición de visibilidad. Los accesorios reutilizan el mismo
-- flujo de publicación (status disponible + precio) y además
-- exigen stock_quantity > 0.
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
  p.stock_quantity
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
