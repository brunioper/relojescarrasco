-- ============================================================
-- Relojes Carrasco — Datos de prueba (SOLO desarrollo local)
--
-- Contiene usuarios, relojes, compras, costos, ventas, gastos,
-- cotizaciones, cuentas de caja y pagos FICTICIOS.
-- No contiene contraseñas reales, claves reales ni datos personales reales.
-- NUNCA ejecutar este archivo en producción.
-- ============================================================

-- ------------------------------------------------------------
-- Usuarios locales de desarrollo
--   admin@relojescarrasco.test  / Admin1234!   (admin activo)
--   viewer@relojescarrasco.test / Viewer1234!  (viewer activo)
-- ------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'admin@relojescarrasco.test',
   crypt('Admin1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Administrador Carrasco"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'viewer@relojescarrasco.test',
   crypt('Viewer1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Consulta Carrasco"}',
   now(), now(), '', '', '', '');

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   '{"sub":"f0000000-0000-4000-8000-000000000001","email":"admin@relojescarrasco.test","email_verified":true}',
   'email', now(), now(), now()),
  (gen_random_uuid(), 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002',
   '{"sub":"f0000000-0000-4000-8000-000000000002","email":"viewer@relojescarrasco.test","email_verified":true}',
   'email', now(), now(), now());

-- El trigger creó perfiles viewer inactivos; se promueven aquí.
update public.profiles set role = 'admin', is_active = true, full_name = 'Administrador Carrasco'
  where id = 'f0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'viewer', is_active = true, full_name = 'Consulta Carrasco'
  where id = 'f0000000-0000-4000-8000-000000000002';

-- ------------------------------------------------------------
-- Configuración de la aplicación
-- ------------------------------------------------------------
insert into public.application_settings (key, value, description) values
  ('business_name', '{"value": "Relojes Carrasco"}', 'Nombre del negocio'),
  ('contact_email', '{"value": "contacto@relojescarrasco.test"}', 'Email de contacto público'),
  ('whatsapp_number', '{"value": "59899000000"}', 'WhatsApp (formato internacional sin +)'),
  ('instagram_url', '{"value": "https://instagram.com/relojescarrasco"}', 'Instagram'),
  ('address', '{"value": "Carrasco, Montevideo, Uruguay"}', 'Dirección (opcional)'),
  ('catalogue_intro', '{"value": "Relojes de colección y usados seleccionados uno a uno, revisados y garantizados."}', 'Introducción del catálogo'),
  ('footer_text', '{"value": "Relojes Carrasco — Compra y venta de relojes de colección en Uruguay."}', 'Texto del pie'),
  ('privacy_text', '{"value": "En Relojes Carrasco protegemos sus datos personales. Solo recopilamos la información mínima necesaria para responder consultas y concretar operaciones. No compartimos datos con terceros ni enviamos comunicaciones no solicitadas."}', 'Política de privacidad'),
  ('terms_text', '{"value": "Los relojes publicados son usados o de colección y se describen con la mayor precisión posible. Los precios en pesos uruguayos son aproximados. Las operaciones se coordinan personalmente y los relojes se entregan revisados y en funcionamiento."}', 'Términos y condiciones'),
  ('seo_title', '{"value": "Relojes Carrasco — Relojes de colección y usados en Uruguay"}', 'Título SEO'),
  ('seo_description', '{"value": "Compra y venta de relojes de colección y usados en Montevideo. Rolex, Omega, Longines, Seiko y más. Revisados y garantizados."}', 'Descripción SEO'),
  ('site_url', '{"value": "http://localhost:3000"}', 'URL del sitio'),
  ('show_reserved_products', '{"value": false}', 'Mostrar reservados en el catálogo público'),
  ('show_uyu_conversion', '{"value": true}', 'Mostrar conversión aproximada a UYU'),
  ('catalogue_exchange_rate', '{"mode": "latest", "value": null, "source": "ultima_activa", "effective_date": null, "is_manual": false}', 'Cotización usada por el catálogo público'),
  ('exchange_rate_warning_days', '{"value": 7}', 'Días para advertir cotización desactualizada'),
  ('default_report_currency', '{"value": "USD"}', 'Moneda interna de reportes');

-- ------------------------------------------------------------
-- Categorías de costos y gastos
-- ------------------------------------------------------------
insert into public.expense_categories (id, name, kind, sort_order) values
  ('c1000000-0000-4000-8000-000000000001', 'Service', 'costo_producto', 1),
  ('c1000000-0000-4000-8000-000000000002', 'Reparación', 'costo_producto', 2),
  ('c1000000-0000-4000-8000-000000000003', 'Cambio de cristal', 'costo_producto', 3),
  ('c1000000-0000-4000-8000-000000000004', 'Cambio de correa', 'costo_producto', 4),
  ('c1000000-0000-4000-8000-000000000005', 'Pulido', 'costo_producto', 5),
  ('c1000000-0000-4000-8000-000000000006', 'Limpieza', 'costo_producto', 6),
  ('c1000000-0000-4000-8000-000000000007', 'Transporte', 'costo_producto', 7),
  ('c1000000-0000-4000-8000-000000000008', 'Comisión de compra', 'costo_producto', 8),
  ('c1000000-0000-4000-8000-000000000009', 'Gastos de importación', 'costo_producto', 9),
  ('c1000000-0000-4000-8000-000000000010', 'Fotografía', 'costo_producto', 10),
  ('c1000000-0000-4000-8000-000000000011', 'Packaging', 'costo_producto', 11),
  ('c1000000-0000-4000-8000-000000000012', 'Otros', 'costo_producto', 12),
  ('c2000000-0000-4000-8000-000000000001', 'Publicidad', 'gasto_general', 1),
  ('c2000000-0000-4000-8000-000000000002', 'Sitio web', 'gasto_general', 2),
  ('c2000000-0000-4000-8000-000000000003', 'Hosting', 'gasto_general', 3),
  ('c2000000-0000-4000-8000-000000000004', 'Fotografía', 'gasto_general', 4),
  ('c2000000-0000-4000-8000-000000000005', 'Transporte', 'gasto_general', 5),
  ('c2000000-0000-4000-8000-000000000006', 'Packaging', 'gasto_general', 6),
  ('c2000000-0000-4000-8000-000000000007', 'Comisiones bancarias', 'gasto_general', 7),
  ('c2000000-0000-4000-8000-000000000008', 'Comisiones de marketplace', 'gasto_general', 8),
  ('c2000000-0000-4000-8000-000000000009', 'Contabilidad', 'gasto_general', 9),
  ('c2000000-0000-4000-8000-000000000010', 'Alquiler', 'gasto_general', 10),
  ('c2000000-0000-4000-8000-000000000011', 'Oficina', 'gasto_general', 11),
  ('c2000000-0000-4000-8000-000000000012', 'Impuestos', 'gasto_general', 12),
  ('c2000000-0000-4000-8000-000000000013', 'Software', 'gasto_general', 13),
  ('c2000000-0000-4000-8000-000000000014', 'Otros', 'gasto_general', 14),
  ('c3000000-0000-4000-8000-000000000001', 'Comisión de venta', 'gasto_venta', 1),
  ('c3000000-0000-4000-8000-000000000002', 'Envío', 'gasto_venta', 2),
  ('c3000000-0000-4000-8000-000000000003', 'Comisión de marketplace', 'gasto_venta', 3),
  ('c3000000-0000-4000-8000-000000000004', 'Otros', 'gasto_venta', 4);

-- ------------------------------------------------------------
-- Cotizaciones USD/UYU (histórico)
-- ------------------------------------------------------------
insert into public.exchange_rates
  (id, base_currency, quote_currency, buy_rate, sell_rate, rate, source, rate_date, is_manual, is_active, created_by)
values
  ('e0000000-0000-4000-8000-000000000001', 'USD', 'UYU', 39.10, 40.30, 39.80, 'manual', '2026-05-02', true, true, 'f0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'USD', 'UYU', 39.40, 40.60, 40.10, 'manual', '2026-06-01', true, true, 'f0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'USD', 'UYU', 39.60, 40.90, 40.25, 'api:exchangerate', '2026-07-01', false, true, 'f0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000004', 'USD', 'UYU', 39.80, 41.10, 40.50, 'manual', '2026-08-01', true, true, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Cuentas de caja
-- ------------------------------------------------------------
insert into public.cash_accounts (id, name, currency, account_type, initial_balance, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'Caja USD', 'USD', 'efectivo', 5000.00, 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', 'Caja UYU', 'UYU', 'efectivo', 60000.00, 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', 'Banco USD', 'USD', 'banco', 8000.00, 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000004', 'Banco UYU', 'UYU', 'banco', 150000.00, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Proveedores y clientes (ficticios)
-- ------------------------------------------------------------
insert into public.suppliers (id, name, contact_name, phone, email, notes, created_by) values
  ('b0000000-0000-4000-8000-000000000001', 'Coleccionista Punta del Este', 'Marcos P.', '+598 91 111 111', 'proveedor1@ejemplo.test', 'Vendedor particular de confianza', 'f0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'Relojería Central', 'Taller', '+598 2 900 0000', 'taller@ejemplo.test', 'Taller de service y reparaciones', 'f0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'Importadora del Este', null, null, 'importadora@ejemplo.test', 'Importaciones ocasionales', 'f0000000-0000-4000-8000-000000000001');

insert into public.customers (id, full_name, phone, email, notes, created_by) values
  ('d0000000-0000-4000-8000-000000000001', 'Juan Pérez', '+598 92 222 222', 'cliente1@ejemplo.test', 'Coleccionista de Rolex', 'f0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'María Rodríguez', '+598 93 333 333', 'cliente2@ejemplo.test', null, 'f0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'Diego Fernández', null, 'cliente3@ejemplo.test', 'Contacto por Instagram', 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Productos
-- ------------------------------------------------------------
insert into public.products
  (id, name, brand, model, reference_number, serial_number, slug, year_approx, movement,
   case_material, strap_material, diameter_mm, water_resistance, gender, condition,
   includes_box, includes_documentation, includes_accessories, public_description, internal_notes,
   status, is_published, is_featured, published_at,
   listing_price_amount, listing_price_currency, listing_price_usd, listing_price_uyu,
   listing_exchange_rate, listing_rate_date, listing_updated_at, created_by)
values
  -- 1. Rolex Datejust — disponible, publicado, destacado (precio en USD)
  ('10000000-0000-4000-8000-000000000001', 'Rolex Datejust 36', 'Rolex', 'Datejust 36', '16233', 'SN-PRIV-0001',
   'rolex-datejust-36-16233', 1992, 'automatico', 'Acero y oro', 'Acero y oro (Jubilee)', 36.0, '100 m', 'Hombre',
   'Muy bueno — pulido reciente, funcionamiento impecable', true, false, 'Eslabones adicionales',
   'Clásico Datejust 36 en acero y oro con esfera champagne. Service completo realizado en 2026. Un reloj para toda la vida.',
   'Comprado a coleccionista conocido. Revisar bracelet estirado en próxima compra similar.',
   'disponible', true, true, '2026-06-20T12:00:00Z',
   5200.00, 'USD', 5200.00, 208520.00, 40.10, '2026-06-20', '2026-06-20T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 2. Omega Seamaster — disponible, publicado, destacado (precio en USD)
  ('10000000-0000-4000-8000-000000000002', 'Omega Seamaster Automático', 'Omega', 'Seamaster', '166.032', 'SN-PRIV-0002',
   'omega-seamaster-automatico', 1968, 'automatico', 'Acero', 'Cuero', 35.0, '30 m', 'Hombre',
   'Bueno — esfera original con pátina uniforme', true, false, null,
   'Seamaster vintage de 1968 con esfera plateada original. Movimiento automático cal. 552 recientemente lubricado.',
   null,
   'disponible', true, true, '2026-07-05T12:00:00Z',
   2300.00, 'USD', 2300.00, 92575.00, 40.25, '2026-07-05', '2026-07-05T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 3. Tissot PRX — disponible, publicado (precio ingresado en UYU)
  ('10000000-0000-4000-8000-000000000003', 'Tissot PRX Quartz', 'Tissot', 'PRX', 'T137.410', null,
   'tissot-prx-quartz', 2023, 'cuarzo', 'Acero', 'Acero integrado', 40.0, '100 m', 'Unisex',
   'Excelente — como nuevo', true, true, 'Estuche original',
   'PRX de cuarzo con esfera azul, prácticamente sin uso. Incluye caja y papeles.',
   null,
   'disponible', true, false, '2026-07-20T12:00:00Z',
   17000.00, 'UYU', 419.75, 17000.00, 40.50, '2026-08-01', '2026-08-01T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 4. Seiko 5 — reservado, publicado
  ('10000000-0000-4000-8000-000000000004', 'Seiko 5 Sports', 'Seiko', 'SRPD55', 'SRPD55K1', null,
   'seiko-5-sports-srpd55', 2021, 'automatico', 'Acero', 'Acero', 42.5, '100 m', 'Hombre',
   'Muy bueno', false, false, null,
   'Seiko 5 Sports con esfera negra, ideal primer automático. Correa de acero original.',
   'Seña recibida de cliente, entregar antes del 15/08.',
   'reservado', true, false, '2026-07-10T12:00:00Z',
   320.00, 'USD', 320.00, 12880.00, 40.25, '2026-07-10', '2026-07-10T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 5. Longines — VENDIDO (venta en USD con pago parcial)
  ('10000000-0000-4000-8000-000000000005', 'Longines Conquest Heritage', 'Longines', 'Conquest Heritage', 'L1.611.4', 'SN-PRIV-0005',
   'longines-conquest-heritage', 2015, 'automatico', 'Acero', 'Cuero', 35.0, '30 m', 'Hombre',
   'Muy bueno', true, true, null,
   'Conquest Heritage con esfera plateada. Elegante y clásico.',
   null,
   'vendido', false, false, null,
   2100.00, 'USD', 2100.00, 84210.00, 40.10, '2026-06-05', '2026-06-05T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 6. Citizen — VENDIDO (venta en UYU, cobrada al contado)
  ('10000000-0000-4000-8000-000000000006', 'Citizen Eco-Drive Titanium', 'Citizen', 'Eco-Drive', 'BM7170', null,
   'citizen-eco-drive-titanium', 2019, 'solar', 'Titanio', 'Titanio', 41.0, '100 m', 'Hombre',
   'Bueno', false, false, null,
   'Eco-Drive de titanio, liviano y sin necesidad de pila.',
   null,
   'vendido', false, false, null,
   400.00, 'USD', 400.00, 16040.00, 40.10, '2026-06-10', '2026-06-10T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 7. Orient — en reparación, no publicado
  ('10000000-0000-4000-8000-000000000007', 'Orient Bambino V4', 'Orient', 'Bambino', 'FAC08004D0', null,
   'orient-bambino-v4', 2020, 'automatico', 'Acero', 'Cuero', 40.5, '30 m', 'Hombre',
   'A revisar — atrasa 2 min/día', false, false, null,
   'Bambino clásico con esfera azul degradé.',
   'En taller: regulación y cambio de junta. Retirar el 12/08.',
   'en_reparacion', false, false, null,
   250.00, 'USD', 250.00, 10125.00, 40.50, '2026-08-01', '2026-08-01T12:00:00Z',
   'f0000000-0000-4000-8000-000000000001'),

  -- 8. Casio — no publicado (borrador, sin precio)
  ('10000000-0000-4000-8000-000000000008', 'Casio G-Shock DW-5600 vintage', 'Casio', 'DW-5600', 'DW-5600E', null,
   'casio-g-shock-dw5600-vintage', 1996, 'cuarzo', 'Resina', 'Resina', 42.8, '200 m', 'Unisex',
   'Usado con marcas — funcionando', false, false, null,
   'G-Shock clásico de los 90, módulo original.',
   'Falta fotografiar y decidir precio.',
   'no_publicado', false, false, null,
   null, null, null, null, null, null, null,
   'f0000000-0000-4000-8000-000000000001'),

  -- 9. Archivado (no debe aparecer nunca públicamente)
  ('10000000-0000-4000-8000-000000000009', 'Festina cronógrafo', 'Festina', 'F16759', null, null,
   'festina-cronografo-f16759', 2014, 'cuarzo', 'Acero', 'Acero', 44.0, '50 m', 'Hombre',
   'Regular', false, false, null,
   'Cronógrafo de cuarzo.',
   'Devuelto al proveedor, no se concretó la compra.',
   'archivado', false, false, null,
   null, null, null, null, null, null, null,
   'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Compras
-- ------------------------------------------------------------
insert into public.purchases
  (id, product_id, purchase_date, amount, currency, exchange_rate, amount_usd, amount_uyu,
   supplier_id, payment_method, notes, created_by)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '2026-05-10', 3800.00, 'USD', 39.80, 3800.00, 151240.00,
   'b0000000-0000-4000-8000-000000000001', 'Transferencia', 'Compra a coleccionista', 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   '2026-06-02', 1500.00, 'USD', 40.10, 1500.00, 60150.00,
   'b0000000-0000-4000-8000-000000000001', 'Efectivo', null, 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   '2026-07-12', 12000.00, 'UYU', 40.25, 298.14, 12000.00,
   null, 'Efectivo', 'Compra particular en UYU', 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   '2026-06-25', 180.00, 'USD', 40.10, 180.00, 7218.00,
   null, 'Efectivo', null, 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005',
   '2026-04-15', 1200.00, 'USD', 39.80, 1200.00, 47760.00,
   'b0000000-0000-4000-8000-000000000001', 'Transferencia', null, 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006',
   '2026-05-20', 250.00, 'USD', 39.80, 250.00, 9950.00,
   null, 'Efectivo', null, 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007',
   '2026-07-25', 90.00, 'USD', 40.25, 90.00, 3622.50,
   null, 'Efectivo', 'Requiere regulación', 'f0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008',
   '2026-07-28', 4000.00, 'UYU', 40.50, 98.77, 4000.00,
   'b0000000-0000-4000-8000-000000000003', 'Efectivo', null, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Costos directos de productos (mayormente en UYU)
-- ------------------------------------------------------------
insert into public.product_costs
  (id, product_id, category_id, description, cost_date, amount, currency, exchange_rate,
   amount_usd, amount_uyu, supplier_id, payment_method, due_date, notes, created_by)
values
  -- Rolex: service completo pagado
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001', 'Service completo movimiento 3135', '2026-05-25',
   9500.00, 'UYU', 39.80, 238.69, 9500.00,
   'b0000000-0000-4000-8000-000000000002', 'Efectivo', null, null, 'f0000000-0000-4000-8000-000000000001'),
  -- Rolex: pulido pagado
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000005', 'Pulido caja y brazalete', '2026-05-28',
   2500.00, 'UYU', 39.80, 62.81, 2500.00,
   'b0000000-0000-4000-8000-000000000002', 'Efectivo', null, null, 'f0000000-0000-4000-8000-000000000001'),
  -- Omega: cambio de cristal pagado
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000003', 'Cristal hesalite nuevo', '2026-06-15',
   3500.00, 'UYU', 40.10, 87.28, 3500.00,
   'b0000000-0000-4000-8000-000000000002', 'Efectivo', null, null, 'f0000000-0000-4000-8000-000000000001'),
  -- Longines (vendido): limpieza
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
   'c1000000-0000-4000-8000-000000000006', 'Limpieza y demagnetizado', '2026-05-02',
   1800.00, 'UYU', 39.80, 45.23, 1800.00,
   'b0000000-0000-4000-8000-000000000002', 'Efectivo', null, null, 'f0000000-0000-4000-8000-000000000001'),
  -- Orient: reparación PENDIENTE de pago (cuenta por pagar)
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000007',
   'c1000000-0000-4000-8000-000000000002', 'Regulación y cambio de junta', '2026-08-01',
   2200.00, 'UYU', 40.50, 54.32, 2200.00,
   'b0000000-0000-4000-8000-000000000002', null, '2026-08-15', 'Pagar al retirar', 'f0000000-0000-4000-8000-000000000001'),
  -- Tissot: fotografía profesional en USD
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003',
   'c1000000-0000-4000-8000-000000000010', 'Sesión de fotos producto', '2026-07-18',
   25.00, 'USD', 40.25, 25.00, 1006.25,
   null, 'Efectivo', null, null, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Histórico de precios de lista
-- ------------------------------------------------------------
insert into public.product_price_history
  (product_id, old_amount, old_currency, new_amount, new_currency, exchange_rate,
   new_amount_usd, new_amount_uyu, changed_by)
values
  -- Rolex: precio inicial 5.500 USD, luego rebajado a 5.200
  ('10000000-0000-4000-8000-000000000001', null, null, 5500.00, 'USD', 39.80, 5500.00, 218900.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', 5500.00, 'USD', 5200.00, 'USD', 40.10, 5200.00, 208520.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', null, null, 2300.00, 'USD', 40.25, 2300.00, 92575.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003', null, null, 17000.00, 'UYU', 40.50, 419.75, 17000.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004', null, null, 320.00, 'USD', 40.25, 320.00, 12880.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000005', null, null, 2100.00, 'USD', 40.10, 2100.00, 84210.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000006', null, null, 400.00, 'USD', 40.10, 400.00, 16040.00, 'f0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000007', null, null, 250.00, 'USD', 40.50, 250.00, 10125.00, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Ventas (los productos 5 y 6 ya están en estado vendido)
-- ------------------------------------------------------------
insert into public.sales
  (id, product_id, sale_date, amount, currency, exchange_rate, amount_usd, amount_uyu,
   listing_price_usd_at_sale, customer_id, payment_method, due_date, notes, created_by)
values
  -- Longines: vendido a 1.900 USD (rebaja sobre lista de 2.100), pago parcial
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005',
   '2026-07-08', 1900.00, 'USD', 40.25, 1900.00, 76475.00,
   2100.00, 'd0000000-0000-4000-8000-000000000001', 'Transferencia', '2026-08-20',
   'Acordado pago en dos cuotas', 'f0000000-0000-4000-8000-000000000001'),
  -- Citizen: vendido en UYU al contado
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006',
   '2026-07-15', 15000.00, 'UYU', 40.25, 372.67, 15000.00,
   400.00, 'd0000000-0000-4000-8000-000000000002', 'Efectivo', null, null,
   'f0000000-0000-4000-8000-000000000001');

-- Gastos de venta
insert into public.sale_expenses
  (id, sale_id, category_id, description, amount, currency, exchange_rate, amount_usd, amount_uyu, created_by)
values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'c3000000-0000-4000-8000-000000000002', 'Envío asegurado a Punta del Este',
   800.00, 'UYU', 40.25, 19.88, 800.00, 'f0000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002',
   'c3000000-0000-4000-8000-000000000001', 'Comisión contacto',
   20.00, 'USD', 40.25, 20.00, 805.00, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Gastos generales
-- ------------------------------------------------------------
insert into public.general_expenses
  (id, expense_date, category_id, description, amount, currency, exchange_rate,
   amount_usd, amount_uyu, supplier_id, payment_method, due_date, is_recurring, notes, created_by)
values
  ('60000000-0000-4000-8000-000000000001', '2026-07-01',
   'c2000000-0000-4000-8000-000000000001', 'Publicidad Instagram julio',
   50.00, 'USD', 40.25, 50.00, 2012.50,
   null, 'Tarjeta', null, true, null, 'f0000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002', '2026-07-05',
   'c2000000-0000-4000-8000-000000000003', 'Hosting y dominio anual',
   120.00, 'USD', 40.25, 120.00, 4830.00,
   null, 'Tarjeta', null, false, null, 'f0000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000003', '2026-07-20',
   'c2000000-0000-4000-8000-000000000011', 'Insumos de oficina y packaging',
   3200.00, 'UYU', 40.25, 79.50, 3200.00,
   null, 'Efectivo', null, false, null, 'f0000000-0000-4000-8000-000000000001'),
  -- Contabilidad PENDIENTE (cuenta por pagar)
  ('60000000-0000-4000-8000-000000000004', '2026-07-31',
   'c2000000-0000-4000-8000-000000000009', 'Honorarios contador julio',
   4500.00, 'UYU', 40.50, 111.11, 4500.00,
   null, null, '2026-08-10', true, 'Pagar antes del 10/08', 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Pagos (los triggers recalculan estado y saldo de cada comprobante)
-- ------------------------------------------------------------
insert into public.payments
  (id, transaction_type, transaction_id, payment_date, amount, currency, exchange_rate,
   amount_usd, amount_uyu, payment_method, cash_account_id, notes, created_by)
values
  -- Compras pagadas en su totalidad
  ('70000000-0000-4000-8000-000000000001', 'compra', '20000000-0000-4000-8000-000000000001',
   '2026-05-10', 3800.00, 'USD', 39.80, 3800.00, 151240.00, 'Transferencia',
   'a0000000-0000-4000-8000-000000000003', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002', 'compra', '20000000-0000-4000-8000-000000000002',
   '2026-06-02', 1500.00, 'USD', 40.10, 1500.00, 60150.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000001', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000003', 'compra', '20000000-0000-4000-8000-000000000003',
   '2026-07-12', 12000.00, 'UYU', 40.25, 298.14, 12000.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000004', 'compra', '20000000-0000-4000-8000-000000000004',
   '2026-06-25', 180.00, 'USD', 40.10, 180.00, 7218.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000001', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000005', 'compra', '20000000-0000-4000-8000-000000000005',
   '2026-04-15', 1200.00, 'USD', 39.80, 1200.00, 47760.00, 'Transferencia',
   'a0000000-0000-4000-8000-000000000003', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000006', 'compra', '20000000-0000-4000-8000-000000000006',
   '2026-05-20', 250.00, 'USD', 39.80, 250.00, 9950.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000001', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000007', 'compra', '20000000-0000-4000-8000-000000000007',
   '2026-07-25', 90.00, 'USD', 40.25, 90.00, 3622.50, 'Efectivo',
   'a0000000-0000-4000-8000-000000000001', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000008', 'compra', '20000000-0000-4000-8000-000000000008',
   '2026-07-28', 4000.00, 'UYU', 40.50, 98.77, 4000.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),

  -- Costos de producto pagados
  ('70000000-0000-4000-8000-000000000011', 'costo_producto', '30000000-0000-4000-8000-000000000001',
   '2026-05-25', 9500.00, 'UYU', 39.80, 238.69, 9500.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000012', 'costo_producto', '30000000-0000-4000-8000-000000000002',
   '2026-05-28', 2500.00, 'UYU', 39.80, 62.81, 2500.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000013', 'costo_producto', '30000000-0000-4000-8000-000000000003',
   '2026-06-15', 3500.00, 'UYU', 40.10, 87.28, 3500.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000014', 'costo_producto', '30000000-0000-4000-8000-000000000004',
   '2026-05-02', 1800.00, 'UYU', 39.80, 45.23, 1800.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000015', 'costo_producto', '30000000-0000-4000-8000-000000000006',
   '2026-07-18', 25.00, 'USD', 40.25, 25.00, 1006.25, 'Efectivo',
   'a0000000-0000-4000-8000-000000000001', null, 'f0000000-0000-4000-8000-000000000001'),

  -- Venta Longines: pago parcial (1.000 de 1.900 USD) — cuenta por cobrar
  ('70000000-0000-4000-8000-000000000021', 'venta', '40000000-0000-4000-8000-000000000001',
   '2026-07-08', 1000.00, 'USD', 40.25, 1000.00, 40250.00, 'Transferencia',
   'a0000000-0000-4000-8000-000000000003', 'Primera cuota', 'f0000000-0000-4000-8000-000000000001'),
  -- Venta Citizen: cobrada al contado en UYU
  ('70000000-0000-4000-8000-000000000022', 'venta', '40000000-0000-4000-8000-000000000002',
   '2026-07-15', 15000.00, 'UYU', 40.25, 372.67, 15000.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),

  -- Gastos generales pagados
  ('70000000-0000-4000-8000-000000000031', 'gasto_general', '60000000-0000-4000-8000-000000000001',
   '2026-07-01', 50.00, 'USD', 40.25, 50.00, 2012.50, 'Tarjeta',
   'a0000000-0000-4000-8000-000000000003', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000032', 'gasto_general', '60000000-0000-4000-8000-000000000002',
   '2026-07-05', 120.00, 'USD', 40.25, 120.00, 4830.00, 'Tarjeta',
   'a0000000-0000-4000-8000-000000000003', null, 'f0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000033', 'gasto_general', '60000000-0000-4000-8000-000000000003',
   '2026-07-20', 3200.00, 'UYU', 40.25, 79.50, 3200.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001'),

  -- Gasto de venta pagado (envío Longines)
  ('70000000-0000-4000-8000-000000000041', 'gasto_venta', '50000000-0000-4000-8000-000000000001',
   '2026-07-08', 800.00, 'UYU', 40.25, 19.88, 800.00, 'Efectivo',
   'a0000000-0000-4000-8000-000000000002', null, 'f0000000-0000-4000-8000-000000000001');

-- ------------------------------------------------------------
-- Movimientos de caja
-- (espejo de los pagos anteriores + aportes/retiros/transferencia)
-- ------------------------------------------------------------
insert into public.cash_transactions
  (account_id, transaction_date, type, amount, exchange_rate, amount_usd, amount_uyu,
   payment_id, description, created_by)
values
  -- Pagos de compras
  ('a0000000-0000-4000-8000-000000000003', '2026-05-10', 'pago_compra', 3800.00, 39.80, 3800.00, 151240.00,
   '70000000-0000-4000-8000-000000000001', 'Compra Rolex Datejust', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '2026-06-02', 'pago_compra', 1500.00, 40.10, 1500.00, 60150.00,
   '70000000-0000-4000-8000-000000000002', 'Compra Omega Seamaster', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-07-12', 'pago_compra', 12000.00, 40.25, 298.14, 12000.00,
   '70000000-0000-4000-8000-000000000003', 'Compra Tissot PRX', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '2026-06-25', 'pago_compra', 180.00, 40.10, 180.00, 7218.00,
   '70000000-0000-4000-8000-000000000004', 'Compra Seiko 5', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', '2026-04-15', 'pago_compra', 1200.00, 39.80, 1200.00, 47760.00,
   '70000000-0000-4000-8000-000000000005', 'Compra Longines', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '2026-05-20', 'pago_compra', 250.00, 39.80, 250.00, 9950.00,
   '70000000-0000-4000-8000-000000000006', 'Compra Citizen', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '2026-07-25', 'pago_compra', 90.00, 40.25, 90.00, 3622.50,
   '70000000-0000-4000-8000-000000000007', 'Compra Orient Bambino', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-07-28', 'pago_compra', 4000.00, 40.50, 98.77, 4000.00,
   '70000000-0000-4000-8000-000000000008', 'Compra Casio G-Shock', 'f0000000-0000-4000-8000-000000000001'),
  -- Pagos de costos
  ('a0000000-0000-4000-8000-000000000002', '2026-05-25', 'pago_costo_producto', 9500.00, 39.80, 238.69, 9500.00,
   '70000000-0000-4000-8000-000000000011', 'Service Rolex', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-05-28', 'pago_costo_producto', 2500.00, 39.80, 62.81, 2500.00,
   '70000000-0000-4000-8000-000000000012', 'Pulido Rolex', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-06-15', 'pago_costo_producto', 3500.00, 40.10, 87.28, 3500.00,
   '70000000-0000-4000-8000-000000000013', 'Cristal Omega', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-05-02', 'pago_costo_producto', 1800.00, 39.80, 45.23, 1800.00,
   '70000000-0000-4000-8000-000000000014', 'Limpieza Longines', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '2026-07-18', 'pago_costo_producto', 25.00, 40.25, 25.00, 1006.25,
   '70000000-0000-4000-8000-000000000015', 'Fotos Tissot', 'f0000000-0000-4000-8000-000000000001'),
  -- Cobros de ventas
  ('a0000000-0000-4000-8000-000000000003', '2026-07-08', 'cobro_venta', 1000.00, 40.25, 1000.00, 40250.00,
   '70000000-0000-4000-8000-000000000021', 'Cobro parcial Longines (1/2)', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-07-15', 'cobro_venta', 15000.00, 40.25, 372.67, 15000.00,
   '70000000-0000-4000-8000-000000000022', 'Cobro Citizen contado', 'f0000000-0000-4000-8000-000000000001'),
  -- Pagos de gastos generales
  ('a0000000-0000-4000-8000-000000000003', '2026-07-01', 'pago_gasto_general', 50.00, 40.25, 50.00, 2012.50,
   '70000000-0000-4000-8000-000000000031', 'Publicidad Instagram', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', '2026-07-05', 'pago_gasto_general', 120.00, 40.25, 120.00, 4830.00,
   '70000000-0000-4000-8000-000000000032', 'Hosting anual', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '2026-07-20', 'pago_gasto_general', 3200.00, 40.25, 79.50, 3200.00,
   '70000000-0000-4000-8000-000000000033', 'Insumos oficina', 'f0000000-0000-4000-8000-000000000001'),
  -- Pago gasto de venta
  ('a0000000-0000-4000-8000-000000000002', '2026-07-08', 'pago_gasto_venta', 800.00, 40.25, 19.88, 800.00,
   '70000000-0000-4000-8000-000000000041', 'Envío Longines', 'f0000000-0000-4000-8000-000000000001'),
  -- Aporte del dueño
  ('a0000000-0000-4000-8000-000000000001', '2026-04-01', 'aporte_dueno', 2000.00, 39.80, 2000.00, 79600.00,
   null, 'Aporte inicial de capital', 'f0000000-0000-4000-8000-000000000001'),
  -- Retiro del dueño
  ('a0000000-0000-4000-8000-000000000002', '2026-07-30', 'retiro_dueno', 10000.00, 40.50, 246.91, 10000.00,
   null, 'Retiro personal', 'f0000000-0000-4000-8000-000000000001');

-- Transferencia entre cuentas (dos patas con mismo grupo)
insert into public.cash_transactions
  (account_id, transaction_date, type, amount, exchange_rate, amount_usd, amount_uyu,
   transfer_group_id, description, created_by)
values
  ('a0000000-0000-4000-8000-000000000003', '2026-07-22', 'transferencia_salida', 500.00, 40.25, 500.00, 20125.00,
   '90000000-0000-4000-8000-000000000001', 'Cambio USD a UYU para gastos', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000004', '2026-07-22', 'transferencia_entrada', 20125.00, 40.25, 500.00, 20125.00,
   '90000000-0000-4000-8000-000000000001', 'Cambio USD a UYU para gastos', 'f0000000-0000-4000-8000-000000000001');
