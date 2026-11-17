# CI/CD: verificación, staging, deploy, rollback y respaldos

## Flujo

```text
rama → PR ──► GitHub Actions (CI)            ──► merge a main ──► Vercel publica producción
        │      linter, tipos, unitarios,                              │
        │      base de datos local + RLS,                             ▼
        │      build, navegador real                        Smoke test contra producción
        │                                                             │
        └────► Vercel: versión de prueba de la rama             falla → rollback + aviso
               (staging) + smoke test
```

## Qué corre en cada PR (`.github/workflows/ci.yml`)

| Paso | Qué verifica |
| --- | --- |
| Linter y tipos | Errores de código antes de ejecutar nada |
| Tests unitarios | Finanzas, formatos, filtros del catálogo, mensajes de consulta |
| Supabase local | Levanta una base vacía y aplica **todas** las migraciones + datos de prueba: una migración rota se detecta acá, nunca en producción |
| Tests de integración | Flujos de negocio, roles y políticas RLS (lo público solo lee el catálogo) |
| Build | El mismo build que se despliega |
| Navegador real | Catálogo, ficha, formularios, login y ciclo completo del panel, en escritorio y celular |

La rama `main` está protegida: sin CI en verde no se puede mergear.

## Staging

Cada rama tiene una versión de prueba en Vercel (el link aparece en el PR). Usa la misma base
que producción en modo **solo lectura para el público**; no se indexa en Google.

Las versiones de prueba no tienen la clave de servicio: sirven para revisar el sitio público y
el login, no para operaciones del panel que la necesiten.

## Después de cada deploy (`.github/workflows/smoke-deploy.yml`)

Un navegador real abre el sitio recién publicado y verifica portada, catálogo, ficha, páginas
informativas, links, login del panel, 404, sitemap y robots, sin errores de consola ni recursos
rotos. Además corre Lighthouse (rendimiento, accesibilidad, SEO) como informe.

Si falla en **producción**:

1. Con el secreto `VERCEL_TOKEN` configurado, producción vuelve sola a la versión anterior.
2. Se abre un issue con el detalle.

El smoke test solo lee: no inicia sesión, no envía formularios y no modifica datos.

## Rollback manual

```bash
scripts/rollback.sh              # vuelve a la versión anterior
scripts/rollback.sh <url-deploy> # vuelve a un deploy puntual
```

No toca la base de datos. Por eso las migraciones son siempre aditivas: el código anterior
tiene que seguir funcionando con la base nueva.

## Migraciones de base de datos

1. Crear la migración: `supabase migration new <nombre>` (SQL en `supabase/migrations/`).
2. El CI la aplica en una base local desde cero y corre los tests de RLS.
3. Antes de producción: respaldo (workflow "Respaldo semanal" → Run workflow).
4. Aplicar en producción **antes** de publicar el código que la usa:
   `supabase db push --db-url "$SUPABASE_DB_URL"`.
5. Publicar el código.

## Respaldos (`.github/workflows/backup.yml`)

Todos los lunes se vuelca la base (esquema + datos) y se guarda **cifrada** (AES-256) durante 90
días en GitHub (Actions → "Respaldo semanal" → Artifacts).

Restaurar:

```bash
gpg --decrypt respaldo-AAAAMMDD.tar.gz.gpg > respaldo.tar.gz   # pide BACKUP_PASSPHRASE
tar xzf respaldo.tar.gz
psql "$SUPABASE_DB_URL" -f esquema.sql
psql "$SUPABASE_DB_URL" -f datos.sql
```

Las fotos (Storage) se respaldan aparte: ver [BACKUP.md](BACKUP.md).

## Secretos de GitHub Actions

| Secreto | Para qué | Obligatorio |
| --- | --- | --- |
| `SUPABASE_DB_URL` | Respaldos y migraciones | Para respaldos |
| `BACKUP_PASSPHRASE` | Cifrar los respaldos | Para respaldos |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Rollback automático | Opcional |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Smoke test de versiones de prueba protegidas | Opcional |

El CI de cada PR no usa ningún secreto: corre contra una base local con claves de demostración.
