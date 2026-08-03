-- ============================================================
-- Relojes Carrasco — Migración 10: SKU de producto
--
-- Código interno único por reloj (ej. RC-000123), autogenerado por
-- la base de datos vía secuencia. Se asigna SOLO en el servidor:
-- ninguna acción de la aplicación necesita generarlo ni enviarlo,
-- por lo que funciona igual sin importar el camino de creación
-- (alta manual, duplicar producto, importación en lote).
--
-- Al usar DEFAULT (no un trigger), Postgres recalcula el valor por
-- fila también para los productos ya existentes al agregar la
-- columna (comportamiento estándar de ALTER TABLE ... ADD COLUMN
-- con un default no constante), asignándoles su SKU automáticamente.
-- ============================================================

create sequence if not exists public.product_sku_seq start 1;

alter table public.products
  add column if not exists sku text
  default ('RC-' || lpad(nextval('public.product_sku_seq')::text, 6, '0'));

-- Red de seguridad: si la columna ya existía sin default (re-ejecución
-- parcial), completa cualquier fila que haya quedado sin SKU.
update public.products
set sku = 'RC-' || lpad(nextval('public.product_sku_seq')::text, 6, '0')
where sku is null;

alter table public.products alter column sku set not null;

create unique index if not exists uq_products_sku on public.products (sku);
