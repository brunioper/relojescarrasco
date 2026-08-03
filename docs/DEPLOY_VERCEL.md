# Despliegue en Vercel — guía paso a paso

La aplicación usa solo primitivas compatibles con Vercel (RSC, Server Actions, Route Handlers
serverless); no hay procesos de larga duración.

## Pasos

1. **Crear el proyecto Supabase de producción**
   Dashboard → New project (región `sa-east-1`). Anotar: URL del proyecto, `anon key`,
   `service_role key` (Settings → API).

2. **Configurar las URLs de Auth**
   Authentication → URL Configuration:
   - Site URL: `https://www.tudominio.uy`
   - Redirect URLs: `https://www.tudominio.uy/auth/callback`

3. **Aplicar migraciones**

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

4. **Verificar buckets de Storage** — `product-images` (público) y `private-documents`
   (privado) quedan creados por la migración `20260801000008_storage.sql`. Confirmarlo en
   Storage → Buckets.

5. **Verificar RLS** — en Database → Policies debe verse RLS habilitado en todas las tablas
   con las políticas de la migración `20260801000006_rls_policies.sql`.

6. **Verificar políticas de Storage** — Storage → Policies: escritura solo admin en ambos
   buckets, sin acceso anónimo a `private-documents`.

7. **Crear el primer administrador**
   Authentication → Users → *Add user* (con Auto confirm). Luego en SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin', is_active = true, full_name = 'Nombre'
   where id = (select id from auth.users where email = 'dueno@ejemplo.com');
   ```

   Cargar además la configuración inicial mínima (o hacerlo luego desde Admin → Configuración):

   ```sql
   insert into public.application_settings (key, value) values
     ('business_name', '{"value": "Relojes Carrasco"}'),
     ('whatsapp_number', '{"value": "598XXXXXXXX"}'),
     ('show_uyu_conversion', '{"value": true}'),
     ('show_reserved_products', '{"value": false}'),
     ('exchange_rate_warning_days', '{"value": 7}'),
     ('catalogue_exchange_rate', '{"mode": "latest", "value": null}')
   on conflict (key) do nothing;
   ```

8. **Conectar el repositorio Git a Vercel** — vercel.com → Add New Project → importar el repo.
   Framework: Next.js (autodetectado). Build command y output por defecto.

9. **Variables de entorno en Vercel** (Settings → Environment Variables, entorno Production):

   | Variable | Valor | Exposición |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | navegador (segura) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | navegador (segura, RLS) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **solo servidor** |
   | `NEXT_PUBLIC_SITE_URL` | `https://www.tudominio.uy` | navegador |
   | `RATE_LIMIT_SECRET` | `openssl rand -base64 48` | solo servidor |
   | `EXCHANGE_RATE_API_KEY` | (opcional) | solo servidor |

10. **Site URL de producción** — confirmar `NEXT_PUBLIC_SITE_URL` y la clave `site_url` en
    Admin → Configuración (sitemap, metadatos y redirecciones de auth dependen de ella).

11. **Dominio propio** — Vercel → Settings → Domains → agregar `www.tudominio.uy` y apuntar el
    DNS (CNAME a `cname.vercel-dns.com`).

12. **SSL** — Vercel emite el certificado automáticamente; verificar el candado y que
    `http://` redirija a `https://`.

13. **Probar autenticación** — `/auth/login` con el administrador creado; verificar acceso al
    dashboard, cierre de sesión y recuperación de contraseña (llega el email).

14. **Probar el catálogo público** — portada y `/catalogo` en una ventana de incógnito.

15. **Probar subida de imágenes** — crear un producto de prueba, subir fotos, marcar portada.

16. **Probar documentos privados** — la URL directa de Storage a `private-documents` debe dar
    error; el acceso vía panel (URL firmada) debe funcionar.

17. **Confirmar que anónimos no leen tablas financieras**:

    ```bash
    curl -s "https://<ref>.supabase.co/rest/v1/purchases?select=*" \
      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
    # esperado: [] o error de permiso — NUNCA datos
    ```

    Repetir con `sales`, `product_costs`, `customers`, `cash_transactions`, `audit_logs`.

18. **Confirmar que la service-role key no está en el navegador** — DevTools → Sources →
    buscar `service_role` en los bundles JS: **cero resultados**. (La clave vive solo en
    módulos `server-only` sin prefijo `NEXT_PUBLIC_`.)

19. **Build de producción** — el deploy de Vercel debe terminar sin errores; localmente
    `npm run build` también debe pasar.

20. **Checklist post-deploy**
    - [ ] Precios públicos: `US$ … ($ … UYU aprox.)` en portada, catálogo y detalle
    - [ ] Producto vendido de prueba desaparece del catálogo
    - [ ] `/admin` sin sesión redirige a login; con viewer no permite editar
    - [ ] Exportaciones CSV/Excel/PDF descargan con sesión y dan 401 sin sesión
    - [ ] `robots.txt` bloquea `/admin` y `/auth`; `sitemap.xml` lista los productos
    - [ ] Lighthouse móvil aceptable (imágenes optimizadas, lazy loading)
    - [ ] Cotización activa cargada (o advertencia visible en el dashboard)
    - [ ] Respaldos automáticos activos (ver [BACKUP.md](BACKUP.md))
