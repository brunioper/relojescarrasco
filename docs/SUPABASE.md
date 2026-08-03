# Guía de Supabase: setup, Auth, RLS y Storage

## 1. Desarrollo local

```bash
supabase start        # levanta Postgres + Auth + Storage + Studio
supabase db reset     # aplica supabase/migrations/*.sql + supabase/seed.sql
supabase status       # muestra URLs y claves locales
```

Servicios locales: API `http://127.0.0.1:54321` · Studio `http://127.0.0.1:54323` ·
Inbucket (emails de prueba) `http://127.0.0.1:54324`.

Regenerar tipos tras cada migración:

```bash
npm run db:types      # supabase gen types typescript --local > types/supabase.ts
```

Nueva migración:

```bash
supabase migration new nombre_del_cambio
# editar el SQL generado en supabase/migrations/
supabase db reset     # probar localmente desde cero
```

## 2. Proyecto de producción

1. Crear el proyecto en <https://supabase.com/dashboard> (región `sa-east-1`, São Paulo, la más
   cercana a Uruguay). Guardar la contraseña de la base en un gestor de contraseñas.
2. Vincular y aplicar migraciones:

   ```bash
   supabase link --project-ref <ref-del-proyecto>
   supabase db push          # aplica TODAS las migraciones (esquema, funciones, RLS, storage)
   ```

   > `db push` crea también los buckets y sus políticas (migración `..._storage.sql`).
3. **No ejecutar `seed.sql` en producción** (contiene usuarios y datos ficticios).

## 3. Autenticación

- **Método**: email + contraseña. El registro público está deshabilitado
  (`enable_signup = false`); los usuarios se crean desde el Dashboard:
  *Authentication → Users → Add user* (marcar **Auto confirm email**).
- Al crearse un usuario, un trigger crea su perfil como `viewer` **inactivo**: sin acceso hasta
  que un administrador lo active.

### Crear el primer administrador

Tras crear el usuario en el Dashboard, en *SQL Editor*:

```sql
update public.profiles
set role = 'admin', is_active = true, full_name = 'Nombre Apellido'
where id = (select id from auth.users where email = 'dueno@ejemplo.com');
```

Los siguientes usuarios se gestionan desde **Admin → Configuración → Usuarios del panel**.

### URLs de Auth (producción)

En *Authentication → URL Configuration*:

- **Site URL**: `https://www.tudominio.uy`
- **Redirect URLs**: `https://www.tudominio.uy/auth/callback`

### Sesiones y protección

- Cookies httpOnly gestionadas por `@supabase/ssr`; refresco en `middleware.ts`.
- El middleware bloquea `/admin` sin sesión; el layout de `/admin` y **cada Server Action**
  verifican además perfil activo + rol desde la tabla `profiles` (nunca desde el cliente).
- Rate limiting de login: cookie firmada (HMAC con `RATE_LIMIT_SECRET`) con demoras
  progresivas tras 5 fallos (2s, 4s, 8s… máx. 15 min) + auditoría de intentos fallidos.
- MFA: la infraestructura está preparada (`[auth.mfa]` en config.toml, TOTP habilitable);
  activarlo no requiere cambios de esquema.

## 4. Row Level Security

Modelo **default-deny**: RLS habilitado en todas las tablas; sin política explícita no hay acceso.
`REVOKE ALL ... FROM anon` asegura que el rol anónimo ni siquiera tenga permisos de tabla.

| Recurso | anon | viewer (activo) | admin (activo) |
| --- | --- | --- | --- |
| `public_catalogue_products` / `public_settings` | ✅ lectura | ✅ | ✅ |
| `products`, `purchases`, `product_costs`, `sales`, `general_expenses`, `payments`, `cash_*`, `exchange_rates`, `customers`, `suppliers`, historiales | ❌ | ✅ solo lectura | ✅ lectura y escritura |
| `product_price_history` / `product_status_history` | ❌ | ✅ lectura | ✅ lectura (escritura solo vía funciones) |
| `audit_logs` | ❌ | ❌ | ✅ solo lectura (escritura solo vía SECURITY DEFINER) |
| `profiles` | ❌ | propio | ✅ (trigger impide auto-cambio de rol/estado) |

Funciones de apoyo (`SECURITY DEFINER`, `search_path = public`):
`is_admin()`, `is_active_staff()`, `assert_admin()` — leen el perfil real del usuario autenticado.

Reglas reforzadas por triggers (independientes de la aplicación):

- un producto solo pasa a `vendido` si existe su venta activa;
- un producto vendido no puede borrarse físicamente;
- las cotizaciones históricas no se modifican ni borran;
- el total pagado no puede superar el total del comprobante;
- nadie modifica su propio rol ni desactiva su propia cuenta.

## 5. Storage

### `product-images` (público)

- Lectura pública (imágenes del catálogo, cacheables por CDN).
- Escritura/actualización/borrado: **solo admin**, y solo bajo `products/{product_id}/…`
  con verificación de que el producto existe.
- Nombres SIEMPRE aleatorios (`crypto.randomUUID()`); nunca el nombre original del archivo.
- Límite 10 MB; MIME permitidos: JPEG, PNG, WebP. El cliente comprime y convierte a WebP
  (máx. 2000 px) antes de subir.

### `private-documents` (privado)

- **Sin ninguna política para `anon`**: invisible para el público.
- Todas las operaciones: solo admin, bajo carpetas `purchases/ | costs/ | expenses/ | internal/`.
- Acceso de lectura únicamente vía `/api/admin/documents?path=…`, que verifica el rol y genera
  una **URL firmada de 60 segundos**. Jamás URLs públicas permanentes.

## 6. Verificación rápida de seguridad

```bash
npm run test:integration   # con supabase start + db reset previos
```

Ejecuta las pruebas de `tests/integration/`: acceso anónimo (tablas, storage, RPCs), roles
admin/viewer, inmutabilidad de cotizaciones, venta atómica con rollback y pagos parciales.
