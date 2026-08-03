-- ============================================================
-- Relojes Carrasco — Migración 9: categorías de costos y gastos
--
-- Las categorías son datos de referencia REALES (no datos de prueba):
-- sin ellas, los formularios de costos/gastos no tienen qué mostrar
-- en el selector y no se puede guardar nada. Por eso viven en una
-- migración (se aplican también en producción), a diferencia de
-- supabase/seed.sql que es solo para desarrollo local.
--
-- Idempotente: usa ON CONFLICT (name, kind) DO NOTHING, así que
-- correrla varias veces o junto a datos ya cargados no duplica nada.
-- El admin puede seguir agregando categorías nuevas desde el panel.
-- ============================================================

insert into public.expense_categories (name, kind, sort_order) values
  ('Repuestos', 'costo_producto', 1),
  ('Cambio de vidrio/flexo', 'costo_producto', 2),
  ('Correa', 'costo_producto', 3),
  ('Pulido', 'costo_producto', 4),
  ('Service', 'costo_producto', 5),
  ('Otro', 'costo_producto', 6)
on conflict (name, kind) do nothing;

insert into public.expense_categories (name, kind, sort_order) values
  ('Publicidad', 'gasto_general', 1),
  ('Sitio web / hosting', 'gasto_general', 2),
  ('Fotografía', 'gasto_general', 3),
  ('Transporte', 'gasto_general', 4),
  ('Packaging', 'gasto_general', 5),
  ('Comisiones bancarias', 'gasto_general', 6),
  ('Contabilidad', 'gasto_general', 7),
  ('Alquiler', 'gasto_general', 8),
  ('Impuestos', 'gasto_general', 9),
  ('Otro', 'gasto_general', 10)
on conflict (name, kind) do nothing;

insert into public.expense_categories (name, kind, sort_order) values
  ('Comisión de venta', 'gasto_venta', 1),
  ('Envío', 'gasto_venta', 2),
  ('Comisión de marketplace', 'gasto_venta', 3),
  ('Otro', 'gasto_venta', 4)
on conflict (name, kind) do nothing;
