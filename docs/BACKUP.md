# Respaldo y recuperación

> ⚠️ **Los respaldos de la base de datos NO incluyen los archivos de Supabase Storage.**
> Base y archivos se respaldan por separado.

## 1. Base de datos

### Automático (Supabase)

- Todos los planes pagos incluyen respaldos diarios automáticos (retención según plan).
- **PITR (Point-in-Time Recovery)**: disponible como add-on en planes Pro+; permite restaurar a
  un instante exacto. Recomendado en cuanto el negocio dependa de los datos.
- Verificar en Dashboard → Database → Backups.

### Manual (recomendado semanal, antes de cambios grandes y antes de cada migración)

```bash
# Esquema + datos completos
supabase db dump --linked -f backup_$(date +%Y%m%d).sql

# Solo datos (útil para re-seed de una restauración)
supabase db dump --linked --data-only -f backup_datos_$(date +%Y%m%d).sql
```

Guardar los dumps cifrados fuera de Supabase (disco local + nube privada). Contienen datos de
clientes y finanzas: tratarlos como confidenciales.

## 2. Archivos de Storage (separado de la base)

### Imágenes de productos (`product-images`)

```bash
# Con el CLI de Supabase (autenticado con el proyecto)
supabase storage cp -r ss:///product-images ./backup-imagenes --experimental
```

Frecuencia recomendada: mensual, y después de cargar lotes de fotos nuevas.
Alternativa: conservar las fotos originales de cada reloj en un almacenamiento propio
(las del sitio son derivadas comprimidas).

### Documentos privados (`private-documents`)

```bash
supabase storage cp -r ss:///private-documents ./backup-documentos --experimental
```

Frecuencia: mensual o tras cargar comprobantes importantes. Almacenar **cifrado** (contiene
facturas y recibos).

## 3. Qué más respaldar

| Elemento | Dónde | Cómo |
| --- | --- | --- |
| Migraciones y código | repositorio Git | ya versionado; mantener remoto (GitHub) |
| Variables de entorno | Vercel + gestor de contraseñas | copiar los valores de Settings → Environment Variables a un gestor seguro; NUNCA a un archivo en el repo |
| Claves de Supabase | Dashboard → Settings → API | anotadas en el gestor de contraseñas |
| Configuración de la app | tabla `application_settings` | incluida en el dump de la base |

## 4. Restauración

### Base completa en un proyecto nuevo (desastre total)

```bash
supabase link --project-ref <proyecto-nuevo>
supabase db push                       # migraciones (esquema, funciones, RLS, buckets)
psql "$DATABASE_URL" -f backup_datos_YYYYMMDD.sql   # datos del último dump
# subir los archivos respaldados a los buckets:
supabase storage cp -r ./backup-imagenes ss:///product-images --experimental
supabase storage cp -r ./backup-documentos ss:///private-documents --experimental
```

Después: reconfigurar Auth URLs, recrear usuarios de Auth si no vinieron en el dump y
actualizar las variables de entorno en Vercel con las claves del proyecto nuevo.

### Restaurar a un punto en el tiempo (con PITR)

Dashboard → Database → Backups → Restore → elegir fecha/hora. Avisar antes a los usuarios:
la restauración revierte TODO el proyecto a ese instante.

### Recuperar la cuenta de administrador

- Contraseña olvidada: `/auth/recuperar` (email) o Dashboard → Authentication → Users →
  *Send password recovery* / *Update password*.
- Único admin desactivado por error (el trigger impide auto-desactivarse, pero por si acaso),
  desde SQL Editor:

  ```sql
  update public.profiles set role = 'admin', is_active = true
  where id = (select id from auth.users where email = 'dueno@ejemplo.com');
  ```

### Revertir una migración fallida

Las migraciones son *forward-only*. Ante un fallo: restaurar el último respaldo previo
(automático o manual) y corregir la migración antes de reintentar `db push`.
**Siempre** probar migraciones primero en local (`supabase db reset`).

## 5. Calendario recomendado y prueba de restauración

| Tarea | Frecuencia |
| --- | --- |
| Respaldo automático de base | diario (Supabase) |
| Dump manual de base | semanal + antes de cada migración |
| Respaldo de imágenes | mensual |
| Respaldo de documentos privados | mensual |
| Copia de variables de entorno | ante cada cambio |
| **Prueba de restauración completa** | **semestral**: restaurar el último dump en un proyecto local (`supabase start` limpio + psql) y verificar que la app levanta con esos datos |

Un respaldo no probado no es un respaldo.
