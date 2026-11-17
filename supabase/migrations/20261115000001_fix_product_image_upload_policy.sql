-- ============================================================
-- Corrige la política de subida de fotos de producto.
--
-- En la política original, `name` dentro de la subconsulta sobre
-- public.products se resolvía a products.name (el nombre del reloj)
-- en lugar de storage.objects.name (la ruta del archivo), por lo que
-- la subida directa desde el panel era rechazada.
--
-- La regla sigue siendo igual de estricta: solo administradores, y
-- solo bajo products/{id de un producto existente}/.
-- ============================================================

drop policy if exists "product_images_admin_insert" on storage.objects;

create policy "product_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
    and (storage.foldername(storage.objects.name))[1] = 'products'
    and exists (
      select 1 from public.products p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );
