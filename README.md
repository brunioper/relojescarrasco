# Relojes Carrasco

Aplicación web completa para la gestión y venta de relojes de colección y usados en Uruguay:
catálogo público con precios en **USD (con conversión aproximada a UYU)** y panel privado de
administración con inventario, compras, costos, ventas, gastos, pagos, caja, liquidez y reportes.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend / SSR | Next.js 15 (App Router, RSC, Server Actions), React 19, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Recharts, sonner |
| Backend | Supabase: PostgreSQL, Auth, Storage, RLS, funciones SQL, migraciones |
| Finanzas | decimal.js (aritmética decimal exacta; nunca float de JS) |
| Validación | Zod (cliente **y** servidor) + constraints de PostgreSQL |
| Tests | Vitest (unit + integración), Playwright (E2E), pruebas de RLS |
| Deploy | Vercel (frontend + funciones) + Supabase (backend) |

## Estructura

```text
app/
  (public)/          Sitio público: portada, catálogo, detalle, legales
  admin/             Panel privado (dashboard, productos, ventas, caja, reportes…)
  auth/              Login, recuperación de contraseña, callback
  api/admin/         Exportaciones, cotización automática, documentos privados
components/          ui/ (shadcn), products/ (CataloguePrice…), admin/, public/, auth/
lib/                 Clientes Supabase, sesión/roles, validación Zod, formato es-UY
services/            finance/ (moneda, costos, ganancia, márgenes, caja, liquidez)
                     reports/ (agregación y exportadores), catálogo, configuración
supabase/            migrations/ (esquema + funciones + RLS + storage), seed.sql, config.toml
types/supabase.ts    Tipos generados de la base
tests/               unit/, integration/ (RLS y flujos), e2e/ (Playwright)
docs/                Guías de arquitectura, despliegue, seguridad, respaldo, fórmulas, admin
```

## Desarrollo local

Requisitos: Node 20+, [Supabase CLI](https://supabase.com/docs/guides/local-development), Docker.

```bash
# 1. Dependencias
npm install

# 2. Backend local (Postgres + Auth + Storage con migraciones y seed)
supabase start
supabase db reset          # aplica supabase/migrations + supabase/seed.sql

# 3. Variables de entorno
cp .env.example .env.local
# Completar con los valores que imprime `supabase start`:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key local>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key local>
#   RATE_LIMIT_SECRET=$(openssl rand -base64 48)

# 4. Aplicación
npm run dev                # http://localhost:3000
```

Usuarios de desarrollo (solo seed local, nunca en producción):

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `admin@relojescarrasco.test` | `Admin1234!` | admin |
| `viewer@relojescarrasco.test` | `Viewer1234!` | viewer (solo consulta) |

### Comandos útiles

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run typecheck      # TypeScript estricto
npm run lint           # ESLint
npm test               # tests unitarios (finanzas, formato, rate-limit)
npm run test:integration  # tests de integración + RLS (requiere supabase start)
npm run test:e2e       # Playwright end-to-end (requiere supabase start)
npm run db:reset       # supabase db reset (migraciones + seed)
npm run db:types       # regenerar types/supabase.ts
supabase migration new <nombre>   # nueva migración
supabase db push       # aplicar migraciones al proyecto remoto
```

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, esquema de base de datos, decisiones |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Setup de Supabase, Auth, RLS y políticas de Storage |
| [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) | Despliegue a producción paso a paso + checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Modelo de seguridad y checklist de verificación |
| [docs/BACKUP.md](docs/BACKUP.md) | Estrategia de respaldo y recuperación |
| [docs/FORMULAS.md](docs/FORMULAS.md) | Fórmulas financieras y metodología de reportes |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Guía de uso para el administrador (no técnico) |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Limitaciones conocidas y mejoras futuras |

## Reglas de oro del sistema

1. **Los precios públicos se muestran en USD** con la conversión a UYU entre paréntesis y
   marcada como aproximada: `US$ 450 ($ 18.900 UYU aprox.)`. Un único componente
   ([components/products/catalogue-price.tsx](components/products/catalogue-price.tsx)) genera ese formato en todo el sitio.
2. **Las operaciones históricas son inmutables**: cada compra, costo, venta y pago guarda su
   importe original, moneda, cotización usada y ambos convertidos. Cambiar la cotización del
   catálogo solo cambia el UYU aproximado que ve el público.
3. **El público nunca accede a datos financieros**: el rol `anon` solo puede leer las vistas
   `public_catalogue_products` y `public_settings` (columnas seguras, filas autorizadas).
4. **Nada de aritmética flotante en dinero**: todos los cálculos usan `decimal.js` y columnas
   `numeric` en PostgreSQL; se redondea solo al mostrar o exportar.
5. **La autorización vive en el servidor**: sesión → perfil de confianza (tabla `profiles`) →
   rol → Zod → operación; y la base la vuelve a verificar con RLS + funciones `SECURITY DEFINER`.
