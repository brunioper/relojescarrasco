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
