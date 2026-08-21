-- ============================================================
-- Relojes Carrasco — Migración 12: pedidos desde el catálogo
--
-- Un "pedido" es una intención de compra enviada desde la ficha
-- pública de un producto (nombre, contacto, envío o retiro). No es
-- una venta: el admin sigue registrando la venta real a mano una
-- vez coordinado el pago (mark_product_sold), igual que hoy.
--
-- El público NUNCA tiene policies RLS directas sobre tablas (ver
-- migración 7: "revoke all ... from anon"). Un pedido se crea vía
-- la RPC create_order_request, SECURITY DEFINER, otorgada a anon
-- explícitamente — mismo patrón que get_catalogue_rate, la única
-- otra función pensada para el público.
-- ============================================================

create type public.order_delivery_method as enum ('envio', 'retiro');

create type public.order_request_status as enum (
  'nuevo',
  'contactado',
  'confirmado',
  'cancelado'
);

create table public.order_requests (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete restrict,
  first_name          text not null,
  last_name           text not null,
  phone               text not null,
  instagram_username  text,
  delivery_method     public.order_delivery_method not null,
  shipping_address    text,
  payment_method      text not null default 'transferencia_efectivo',
  status              public.order_request_status not null default 'nuevo',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Envío requiere dirección; retiro no la usa.
  check ((delivery_method = 'envio') = (shipping_address is not null))
);

create index idx_order_requests_status on public.order_requests (status);
create index idx_order_requests_product on public.order_requests (product_id);
create index idx_order_requests_created on public.order_requests (created_at desc);

create trigger trg_order_requests_updated_at
  before update on public.order_requests
  for each row execute function public.set_updated_at();

create trigger trg_audit_order_requests
  after insert or update or delete on public.order_requests
  for each row execute function public.audit_row_change('pedido');

-- ------------------------------------------------------------
-- RLS: sin policies para anon (igual que products). Solo staff
-- puede leer, solo admin puede actualizar (cambiar status). Sin
-- policy de INSERT: la única vía de escritura pública es la RPC
-- de abajo, que corre con privilegios propios (SECURITY DEFINER).
-- ------------------------------------------------------------
alter table public.order_requests enable row level security;

create policy "order_requests_select_staff" on public.order_requests
  for select to authenticated using (public.is_active_staff());
create policy "order_requests_update_admin" on public.order_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Crear un pedido público. Valida el producto y los datos mínimos;
-- no requiere sesión (assert_admin no aplica acá, es la excepción
-- deliberada: esta función SÍ está pensada para anon).
-- ------------------------------------------------------------
create or replace function public.create_order_request(
  p_product_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_instagram_username text,
  p_delivery_method public.order_delivery_method,
  p_shipping_address text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.products
    where id = p_product_id and is_published = true and deleted_at is null
  ) then
    raise exception 'NOT_FOUND: el producto no existe o ya no está publicado.';
  end if;

  if p_first_name is null or btrim(p_first_name) = '' then
    raise exception 'VALIDATION: el nombre es obligatorio.';
  end if;
  if p_last_name is null or btrim(p_last_name) = '' then
    raise exception 'VALIDATION: el apellido es obligatorio.';
  end if;
  if p_phone is null or btrim(p_phone) = '' then
    raise exception 'VALIDATION: el teléfono es obligatorio.';
  end if;
  if p_delivery_method = 'envio' and (p_shipping_address is null or btrim(p_shipping_address) = '') then
    raise exception 'VALIDATION: la dirección de envío es obligatoria.';
  end if;

  insert into public.order_requests
    (product_id, first_name, last_name, phone, instagram_username,
     delivery_method, shipping_address)
  values
    (p_product_id, btrim(p_first_name), btrim(p_last_name), btrim(p_phone),
     nullif(btrim(coalesce(p_instagram_username, '')), ''),
     p_delivery_method,
     case when p_delivery_method = 'envio' then btrim(p_shipping_address) else null end)
  returning id into v_id;

  perform public.log_audit('crear_pedido', 'pedido', v_id, null, jsonb_build_object('product_id', p_product_id));

  return v_id;
end;
$$;

grant execute on function public.create_order_request(
  uuid, text, text, text, text, public.order_delivery_method, text
) to anon, authenticated;
