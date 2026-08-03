-- ============================================================
-- Relojes Carrasco — Migración 8: Storage (buckets y políticas)
--
-- product-images    -> público (lectura); escritura solo admin.
--                      Nombres de archivo aleatorios bajo products/{product_id}/.
-- private-documents -> privado; solo admin, acceso vía URLs firmadas
--                      generadas en el servidor.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'private-documents',
    'private-documents',
    false,
    20971520, -- 20 MB
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Políticas sobre storage.objects
-- ------------------------------------------------------------

-- product-images: lectura pública (bucket público) declarada explícitamente.
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- product-images: escritura solo admin y solo bajo products/{uuid}/...
create policy "product_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
    and (storage.foldername(name))[1] = 'products'
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(name))[2]
    )
  );

create policy "product_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- private-documents: SIN acceso anónimo (no hay política para anon).
-- Solo administradores; la app sirve archivos con URLs firmadas de corta vida.
create policy "private_documents_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'private-documents' and public.is_admin());

create policy "private_documents_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'private-documents'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('purchases', 'costs', 'expenses', 'internal')
  );

create policy "private_documents_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'private-documents' and public.is_admin())
  with check (bucket_id = 'private-documents' and public.is_admin());

create policy "private_documents_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'private-documents' and public.is_admin());
