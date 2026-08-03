-- ============================================================
-- Relojes Carrasco — Migración 7: vistas públicas seguras
--
-- El público (rol anon) NUNCA consulta las tablas base.
-- Solo puede leer estas vistas, que exponen exclusivamente
-- columnas seguras y filas autorizadas.
-- Las vistas son SECURITY DEFINER (propietario postgres) con
-- security_barrier, por lo que omiten RLS de forma controlada.
-- ============================================================

-- ------------------------------------------------------------
-- Catálogo público
-- Solo productos publicados, no eliminados, con precio, y en estado
-- disponible (o reservado si la configuración lo permite).
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
  coalesce(gallery.images, '[]'::jsonb) as images
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
    p.status = 'disponible'
    or (
      p.status = 'reservado'
      and coalesce((
        select (s.value ->> 'value')::boolean
        from public.application_settings s
        where s.key = 'show_reserved_products'
      ), false)
    )
  );

comment on view public.public_catalogue_products is
  'Única superficie de lectura de productos para visitantes anónimos. Sin datos financieros ni privados.';

-- ------------------------------------------------------------
-- Configuración pública (allowlist estricta de claves seguras)
-- ------------------------------------------------------------
create or replace view public.public_settings
with (security_barrier = true, security_invoker = false)
as
select s.key, s.value
from public.application_settings s
where s.key in (
  'business_name',
  'contact_email',
  'whatsapp_number',
  'instagram_url',
  'address',
  'catalogue_intro',
  'footer_text',
  'privacy_text',
  'terms_text',
  'seo_title',
  'seo_description',
  'site_url',
  'show_uyu_conversion'
);

comment on view public.public_settings is
  'Solo claves de configuración explícitamente públicas. Nunca agregar claves financieras.';

-- ------------------------------------------------------------
-- Permisos: anon únicamente puede leer las vistas públicas.
-- Revocamos todo lo demás por si el esquema otorga defaults.
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.public_catalogue_products to anon, authenticated;
grant select on public.public_settings to anon, authenticated;

-- authenticated conserva el acceso a tablas gobernado por RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Asegurar que futuros objetos no otorguen permisos a anon por defecto.
alter default privileges in schema public revoke all on tables from anon;
