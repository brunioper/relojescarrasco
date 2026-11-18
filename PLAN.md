# Plan de trabajo — Relojes Carrasco

Última actualización: 18/11/2026

## Diagnóstico (cómo está hoy)

| Tema | Estado |
| --- | --- |
| Tecnología | Next.js 15 + React 19 + TypeScript, desplegado en Vercel (plan gratis) |
| Base de datos | Supabase (Postgres, Auth, Storage, RLS). Esquema versionado en `supabase/migrations/` |
| Hosting | Vercel conectado a este repo: cada push a `main` publica en producción |
| Carga de productos | Formulario manual en `/admin/productos`, importación por planilla y por link de Instagram (solo la foto de portada) |
| Lo que ya existe | Catálogo público, panel con inventario, compras, costos, ventas, gastos, pagos, caja, liquidez, reportes y exportación; accesorios con stock simple; pedidos desde la ficha (hoy ocultos) |
| Lo que no existía | CI/CD, tests automáticos corriendo, staging, respaldo automático, CRM, IA, variantes de correas, pago online, conexión real con Instagram |

**Decisión: extender, no reconstruir.** La base actual es moderna, ordenada y ya usa Supabase
con seguridad por filas (RLS) y tests. Reconstruir sería tirar trabajo bueno y arriesgar los
datos. Se mantienen todas las URLs actuales (no hacen falta redirecciones).

Problemas encontrados en el diagnóstico:

1. `sitemap.xml` y `robots.txt` apuntaban a `relojescarrasco.vercel.app` en vez del dominio
   propio (malo para Google). **Corregido en la Etapa 1.**
2. No había ninguna verificación automática antes de publicar. **Corregido en la Etapa 1.**
3. Las versiones de prueba de las ramas no compilaban (faltaba una variable en Vercel).
   **Corregido en la Etapa 1** (sin tocar la configuración de Vercel).
4. Temas de seguridad y de configuración que requieren una acción del dueño: ver
   [BLOQUEOS.md](BLOQUEOS.md).

## Regla de publicación

Nada llega a `main` (producción) sin: linter, tipos, tests unitarios, tests de base de datos
(RLS incluido), build y navegador real en verde, más un smoke test sobre la versión de prueba.
Después de cada deploy corre otro smoke test contra producción; si falla, se vuelve a la versión
anterior. Detalle en [docs/CI_CD.md](docs/CI_CD.md).

Regla para la base de datos: una migración se prueba primero en la base local del CI. A
producción se aplica **antes** que el código que la necesita, con respaldo previo, y cada
migración es aditiva (no borra ni cambia datos existentes).

## Etapas

### Etapa 1 — Vidriera, confianza, SEO y CI/CD ✅ (este PR)

No requiere cambios en la base de datos ni credenciales nuevas.

- Catálogo con estética más cuidada: fotos más grandes, más aire, tipografía legible.
- Filtros visibles: marca, precio, tamaño de caja, material, movimiento, caja y papeles; orden.
- Ficha: galería con vista ampliada y zoom, botón principal **Consultar por Instagram** (abre el
  DM y copia la consulta con el modelo y el link), WhatsApp como alternativa, bloque de
  confianza, barra fija de consulta en el celular.
- Venta cruzada: correas y accesorios en la ficha de cada reloj.
- Páginas nuevas: **Autenticidad y garantía** (con preguntas frecuentes) y **Vendé tu reloj**.
- SEO: dominio canónico corregido, títulos por marca, datos estructurados (producto, migas de
  pan, negocio local, preguntas frecuentes), sitemap ampliado.
- Medición: Meta Pixel listo (vista de producto, consulta, vendé tu reloj); se activa al cargar
  el ID del Pixel.
- CI/CD: GitHub Actions, smoke test post-deploy con rollback, respaldo semanal cifrado.

### Etapa 2 — Correas con variantes y orden del catálogo ✅ (lista; falta un paso del dueño)

Para publicarla hay que correr un archivo SQL en Supabase (2 minutos, ver BLOQUEOS punto 2).
Guía de uso: [docs/CORREAS.md](docs/CORREAS.md).

- Variantes de correa (ancho, material, color) con stock por variante; el total lo calcula la
  base de datos.
- Carga rápida: tabla tipo planilla, generador de combinaciones y duplicar fila.
- Venta y cancelación por variante desde el panel.
- Compatibilidad correa ↔ marca/modelo; filtros "Para mi reloj" y "Ancho de correa"; en la
  ficha de cada reloj, "Correas para tu [marca]".
- Interruptor por producto: `catálogo` / `consultar` / `comprar` (deja listo el pago online
  de relojes para activarlo más adelante).
- Nuevo/usado real, con filtro.
- Vendidos recientes como prueba social (sin precio ni datos privados).

Pendiente de esta etapa: carga masiva de correas por CSV (hoy la planilla de importación es
solo para relojes).

### Etapa 3 — Carga con IA

Hecha (rama `etapa-3-carga-ia`). Se activa al cargar la API key de Claude (ver BLOQUEOS, paso 4).

- En "Nuevo reloj" y en la ficha de cada producto: bloque "Completar la ficha con las fotos".
  Lee 1 a 8 fotos y propone marca, modelo, referencia, movimiento, materiales, título y
  descripción (o tipo/material/color/ancho en correas).
- No guarda nada sola: muestra lo que encontró y la persona elige qué pasar a la ficha. Lo que
  no pudo confirmar queda vacío y se lista "para revisar a mano". Año, estado, caja y papeles
  nunca se sugieren.
- En un producto nuevo, las fotos elegidas quedan subidas al crearlo.
- La clave vive solo en el servidor. Tope de gasto mensual (US$ 5 por defecto): al alcanzarlo,
  la IA se pausa hasta el mes siguiente.

### Etapa 4 — CRM propio sobre Supabase

- Clientes con historial, intereses, etapa del embudo y recordatorios.
- Las consultas y los pedidos entran solos. Plantillas y respuesta sugerida por IA.
- "Avisame cuando llegue un [modelo]".

### Etapa 5 — Tienda de correas con pago online

Requiere credenciales del medio de pago (ver BLOQUEOS).

- Carrito, checkout corto sin crear cuenta, envío (retiro / agencia) y pago en sandbox.
- Mail de confirmación y estados del pedido con avisos automáticos.

### Etapa 6 — Instagram oficial

Primera parte hecha (rama `etapa-6-instagram`): **historias y publicaciones → catálogo**. Se
activa con los pasos de BLOQUEOS, punto 6. Detalle en [docs/INSTAGRAM.md](docs/INSTAGRAM.md).

- Conexión con la cuenta por la API oficial: el token se guarda cifrado y se renueva solo.
- Cada 15 minutos se revisan las historias y publicaciones nuevas. Un producto nuevo se crea
  solo y se publica si la imagen muestra el precio en dólares; si se parece a algo del
  catálogo, espera aprobación en la bandeja del panel ("es este: agregar fotos" o "es otro").
- Aviso por email y contador en el menú del panel.

Pendiente: bandeja de DMs dentro del CRM (requiere la revisión de la app por Meta).

### Etapa 7 — Panel de ventas

- Venta rápida desde el celular, comprobante PDF con garantía, dashboard de rotación, stock
  inmovilizado y clientes recurrentes.

### Etapa 8 — Meta Ads

Requiere acceso de lectura a la cuenta publicitaria (ver BLOQUEOS).

- Diagnóstico de campañas y públicos, Pixel + API de Conversiones, estructura de públicos con
  proxies legales, campañas nuevas listas para activar y reporte semanal.
- Reglas fijas: no se tocan presupuestos, creatividades publicadas ni se borra nada.

### Etapa 9 — Estudio de reels

Hecha (rama `etapa-9-reels`; se pidió aparte del plan original). Se activa con BLOQUEOS, punto
7. Detalle en [docs/REELS.md](docs/REELS.md).

- Subís el video del reloj; la IA lo mira y escribe el guion: 3 ganchos, lo que decís tramo por
  tramo y el texto del posteo.
- Grabás tu voz en el panel con el guion como teleprompter, o subís un audio. Nunca se genera
  una voz artificial.
- Se arman solas 3 versiones para reels de prueba: un gancho distinto en cada una, subtítulos
  automáticos desde tu voz, rótulo del reloj y cierre con @relojes_carrasco. Gratis: corre en
  GitHub Actions y transcribe con whisper en esa misma máquina.

Pendiente: publicar las versiones como reels de prueba directo desde el panel (requiere el
permiso de publicación de la API de Instagram).

## Cómo ver y cómo deshacer

- Cada etapa se entrega en un PR con su versión de prueba (link en el PR).
- Deshacer un deploy: `scripts/rollback.sh` (vuelve a la versión anterior en segundos y no toca
  la base de datos).
