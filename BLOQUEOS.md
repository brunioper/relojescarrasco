# Bloqueos — cosas que solo puede hacer el dueño

Lista única, ordenada por prioridad. Nunca pegues claves en este archivo ni en el chat de un
issue: este repositorio es público. Las claves van donde indica cada paso.

Última actualización: 17/11/2026

## Urgente para vender: cargar Instagram y WhatsApp (2 minutos)

Hoy el sitio en producción **no muestra ningún botón de consulta**: ni "Consultar por
Instagram" en las fichas, ni el botón "Escribinos" arriba, ni los contactos del pie. No es un
error del sitio: en Configuración del panel esos datos están vacíos (ya pasaba antes de los
cambios).

HACÉ ESTO:

1. Entrá al panel → **Configuración**.
2. Completá **Instagram (URL)** (ej. `https://www.instagram.com/tu_usuario`) y **WhatsApp
   (internacional, sin +)** (solo números, con 598, ej. `59899123456`). Si querés, también
   dirección y email.
3. Guardá. En unos minutos aparecen los botones en todo el sitio.

## 1. Seguridad (hacer primero)

### 1.1 y 1.2 Acciones de seguridad de la cuenta

Hay dos acciones de seguridad pendientes cuyo detalle te pasé **por el chat** (no se escriben
acá porque este repositorio es público). Son rápidas y van primero.

### 1.3 Repositorio público

El repo <https://github.com/brunioper/relojescarrasco> es **público**: cualquiera puede leer
el código del sistema. No hay claves adentro, pero recomiendo hacerlo privado.

HACÉ ESTO (opcional, recomendado): GitHub → repo → Settings → General → abajo de todo, "Change
repository visibility" → Private. Vercel y GitHub Actions siguen funcionando gratis.

## 2. Activar la Etapa 2 (correas con variantes) — 2 minutos

La Etapa 2 está terminada y probada, pero necesita un cambio en la base de datos antes de
publicarse. No hace falta pasarme ninguna clave:

HACÉ ESTO:

1. Abrí <https://github.com/brunioper/relojescarrasco/blob/etapa-2-correas-variantes/supabase/produccion/etapa-2-variantes.sql>
   → botón **Copy raw file** (arriba a la derecha del archivo).
2. Abrí <https://supabase.com/dashboard> → tu proyecto → **SQL Editor** → **New query** → pegá
   → **Run**.
3. Abajo tiene que aparecer una fila que dice **Etapa 2 aplicada**. Avisame y publico el resto.

Es seguro: solo agrega columnas y tablas nuevas, no toca productos, precios, stock, ventas ni
clientes, y si algo falla no queda nada a medias. El sitio actual sigue funcionando igual
después de correrlo.

### 2.1 Respaldos automáticos (opcional, recomendado)

1. <https://supabase.com/dashboard> → tu proyecto → botón **Connect** (arriba) → pestaña
   "Connection string" → tipo **Session pooler** → copiá la cadena (empieza con
   `postgresql://`). Reemplazá `[YOUR-PASSWORD]` por la contraseña de la base (si no la
   recordás: Settings → Database → "Reset database password").
2. GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**:
   - Nombre `SUPABASE_DB_URL`, valor: la cadena del paso 1.
   - Nombre `BACKUP_PASSPHRASE`, valor: una frase larga inventada por vos. **Anotala en un
     lugar seguro**: sin ella los respaldos no se pueden abrir.

Con esto además puedo aplicar yo las próximas migraciones sin pedirte que pegues nada.

### 2.1 Solo si al subir fotos desde el panel aparece "no se pudo subir"

La regla de permisos original para subir fotos tenía un error (comparaba contra el nombre
del reloj en vez de la ruta del archivo). En el entorno de prueba ya está corregida. Si en
tu panel las fotos se suben bien, no hagas nada. Si fallan, pegá en Supabase → SQL Editor
el contenido de `supabase/migrations/20261115000001_fix_product_image_upload_policy.sql`
y tocá **Run**. No borra datos: solo reemplaza esa regla por la versión correcta.

## 3. Rollback automático de producción

HACÉ ESTO:

1. <https://vercel.com/account/tokens> → Create Token → nombre `github-actions`, scope: tu
   cuenta, vencimiento 1 año → copiá el token.
2. GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:
   - `VERCEL_TOKEN`: el token.
   - `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID`: te los paso yo por el chat (no son secretos, pero
     se guardan ahí).

Sin esto, si un deploy sale mal igual te llega el aviso, pero volver atrás es manual
(`scripts/rollback.sh`).

Opcional, para que el smoke test automático también revise la versión de prueba de cada rama
(hoy Vercel la protege con inicio de sesión): Vercel → proyecto → Settings → Deployment
Protection → "Protection Bypass for Automation" → Add Secret → copiá el valor y guardalo en
GitHub como secreto `VERCEL_AUTOMATION_BYPASS_SECRET`.

## 4. Carga de productos con IA (Etapa 3)

HACÉ ESTO:

1. <https://console.anthropic.com> → creá la cuenta (es aparte de tu suscripción de Claude,
   que no incluye API) → Billing → cargá **US$ 5** (alcanza para meses).
2. Billing → Limits → poné un límite mensual de US$ 5.
3. API Keys → Create Key → nombre `relojes-carrasco` → copiá la clave.
4. Vercel → tu proyecto → Settings → Environment Variables → Add: nombre
   `ANTHROPIC_API_KEY`, valor: la clave, entorno **Production**. Marcala como "Sensitive".
5. Vercel → Deployments → en el último → menú ⋯ → **Redeploy** (para que tome la clave).

Con eso, en "Nuevo reloj" y en la ficha de cada producto se activa el bloque "Completar la
ficha con las fotos". El sitio tiene además su propio tope de US$ 5 por mes: si se alcanza,
la IA se pausa hasta el mes siguiente y la carga a mano sigue funcionando.

Costo estimado: menos de US$ 1 por mes con el volumen actual (ver [COSTOS.md](COSTOS.md)).

## 5. Medición de anuncios (Meta Pixel)

HACÉ ESTO:

1. <https://business.facebook.com/events_manager> → Orígenes de datos → tu Pixel (o "Conectar
   datos" → Web → crear uno) → copiá el **ID del Pixel** (un número).
2. Vercel → proyecto → Settings → Environment Variables → agregar
   `NEXT_PUBLIC_META_PIXEL_ID` con ese número (Production) → Redeploy.

El sitio ya envía los eventos (vista de producto, consulta por Instagram/WhatsApp, vendé tu
reloj) en cuanto exista esa variable.

## 6. Instagram oficial (Etapa 6)

HACÉ ESTO:

1. Confirmá que la cuenta de Instagram es **Profesional (Empresa)** y está vinculada a una
   página de Facebook (Instagram → Configuración → Tipo de cuenta).
2. <https://developers.facebook.com/apps> → Crear app → caso de uso "Instagram" → tipo Empresa.
3. En la app: Instagram → "Configuración de la API con inicio de sesión de Instagram" → agregá
   tu cuenta como tester y aceptá la invitación desde Instagram.
4. Pasame el **ID de la app** por el chat, y cargá el **secreto de la app** en Supabase → Edge
   Functions → Secrets como `META_APP_SECRET`.

Para leer y responder DMs de clientes hace falta además la revisión de la app por Meta
(permiso `instagram_business_manage_messages`); lo preparo yo y te aviso qué aprobar.

## 7. Pago online de correas (Etapa 5)

HACÉ ESTO:

1. Entrá a <https://www.mercadopago.com.uy/developers/panel/app> con la cuenta de Mercado Pago
   del negocio → Crear aplicación → "Pagos online" → Checkout Pro.
2. En la app → Credenciales de prueba → copiá el **Access Token de prueba** y cargalo en
   Supabase → Edge Functions → Secrets como `MERCADOPAGO_ACCESS_TOKEN`.
3. Las credenciales de producción recién se cargan cuando todo el flujo pase en modo prueba.

## 8. Análisis de Meta Ads (Etapa 8)

HACÉ ESTO: <https://business.facebook.com/settings> → Usuarios → Socios o Personas → dar acceso
de **solo lectura/analista** a la cuenta publicitaria, o exportar desde el Administrador de
anuncios (Informes → Exportar) los últimos 90 días por campaña, conjunto y anuncio, y pasarme
el archivo.

## 9. Datos del negocio que necesito confirmar

No invento datos. Respondeme por el chat:

1. **Garantía**: ¿cuántos meses y qué cubre? (Hoy el sitio dice "garantía por escrito, plazo
   según la pieza".)
2. **Dirección y horario** del local, si querés que figuren en el sitio y en Google.
3. **Envíos de correas**: ¿con qué agencia (DAC, Correo Uruguayo, otra) y qué costo fijo?
4. **Reseñas**: ¿tenés reseñas en Google o testimonios que quieras mostrar?
5. Revisá los textos nuevos de **Autenticidad y garantía** y **Vendé tu reloj** y decime si
   algo no refleja cómo trabajás.
