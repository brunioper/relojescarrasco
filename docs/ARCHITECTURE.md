# Arquitectura

## Visión general

```text
┌─────────────────────────── Vercel ────────────────────────────┐
│  Next.js 15 (App Router)                                      │
│  ├─ (public)/   RSC + cliente ANÓNIMO  → solo vistas públicas │
│  ├─ admin/      RSC + Server Actions   → sesión + rol + Zod   │
│  ├─ auth/       Login / recuperación (rate-limited)           │
│  └─ api/admin/  Exportaciones, cotización, docs privados      │
└──────────────┬────────────────────────────────────────────────┘
               │ @supabase/ssr (cookies httpOnly)
┌──────────────▼──────────── Supabase ──────────────────────────┐
│  PostgreSQL: 19 tablas + vistas públicas + funciones RPC      │
│  RLS default-deny en TODAS las tablas                         │
│  Triggers: auditoría, historial de estados, recálculo de      │
│            pagos, inmutabilidad de cotizaciones, guards       │
│  Auth: email+password, perfiles con rol admin/viewer          │
│  Storage: product-images (público) / private-documents        │
└───────────────────────────────────────────────────────────────┘
```

## Capas y separación de responsabilidades

| Capa | Ubicación | Rol |
| --- | --- | --- |
| Datos públicos | vistas `public_catalogue_products` / `public_settings` | única superficie para `anon` |
| Datos administrativos | tablas base vía RLS (`authenticated` + rol de perfil) | lectura staff, escritura admin |
| Lógica financiera | `services/finance/*` (TypeScript puro + decimal.js) | testeable sin base de datos |
| Operaciones atómicas | funciones SQL `SECURITY DEFINER` (`mark_product_sold`, `set_listing_price`, `register_payment`, `cancel_sale`, `create_cash_transfer`) | transaccionalidad + autorización interna |
| Autenticación | `lib/supabase/*` + `middleware.ts` + `lib/auth/session.ts` | sesión, perfil de confianza, roles |
| Autorización de acciones | cada Server Action: `requireAdminAction()` → Zod → operación | el navegador nunca es fuente de verdad |

## Esquema de base de datos (resumen)

**Identidad y referencia**

- `profiles` — rol (`admin`/`viewer`) y estado (`is_active`) vinculados a `auth.users`. Trigger impide auto-modificación de rol/estado.
- `customers`, `suppliers` — contactos privados con baja lógica.
- `expense_categories` — categorías por tipo (`costo_producto`, `gasto_general`, `gasto_venta`).
- `application_settings` — clave/valor JSONB (allowlist pública en `public_settings`).

**Productos**

- `products` — ficha completa + estado (`disponible|reservado|vendido|en_reparacion|no_publicado|archivado`) + bloque de precio de lista (importe original, moneda, cotización, USD/UYU). Constraints: vendido/archivado/eliminado ⇒ despublicado; precio completo o nulo.
- `product_images` — imágenes con portada única (índice parcial) y orden.
- `purchases` — una por producto (unique). Importe original + cotización + USD + UYU **congelados**.
- `product_costs` — costos directos con el mismo patrón monetario.
- `product_price_history` — historial de precios (escrito solo por `set_listing_price`).
- `product_status_history` — escrito automáticamente por trigger en cada cambio de estado.

**Finanzas**

- `sales` — venta con snapshot del precio de lista, cotización histórica y única venta activa por producto (índice parcial `where is_cancelled = false`).
- `sale_expenses`, `general_expenses` — patrón monetario congelado + estado de pago.
- `payments` — pagos/cobros parciales polimórficos (`transaction_type` + `transaction_id`). Un trigger recalcula `amount_paid`/`payment_status` del comprobante padre y rechaza sobrepagos.
- `exchange_rates` — histórico inmutable (trigger bloquea updates de valores; solo `is_active` es editable; sin DELETE).
- `cash_accounts`, `cash_transactions` — cuentas por moneda y movimientos con dirección derivada del tipo; transferencias en dos patas con `transfer_group_id`.
- `audit_logs` — inmutable desde la aplicación; poblado por triggers y `log_audit()`.

### Patrón monetario congelado

Toda fila con dinero guarda **seis** datos y no se recalcula jamás:

```text
amount, currency, exchange_rate, amount_usd, amount_uyu, fecha
```

Los totales (costo del producto, ganancias, cuentas por cobrar/pagar) se calculan **sumando los
convertidos históricos**, nunca reconvirtiendo con cotizaciones nuevas.

## Decisiones de diseño y supuestos documentados

1. **Vistas públicas SECURITY DEFINER** en lugar de políticas RLS sobre `products` para `anon`:
   garantizan a nivel de columna que un anónimo no pueda seleccionar `serial_number`,
   `internal_notes` ni datos financieros, aun con la API REST directa.
2. **Bucket `product-images` público** con nombres de archivo aleatorios (`products/{uuid}/{uuid}.webp`):
   necesario para servir imágenes cacheables con `next/image`. Las imágenes de productos no
   publicados no son enumerables (no hay listado público) pero sí accesibles si se conociera la
   URL exacta; se considera aceptable para fotos de relojes (no datos sensibles). Los documentos
   sensibles van SIEMPRE en `private-documents` (privado + URL firmada de 60 s).
3. **Una compra por producto** (unique constraint): modela el negocio real (cada reloj se compra
   una vez); recompras se modelan duplicando el producto.
4. **El catálogo solo muestra productos con precio**: publicar exige precio de lista definido.
5. **Pagos convertidos a la moneda del comprobante** usando los convertidos históricos del pago
   (tolerancia de redondeo de ±0,01 por conversión).
6. **Rate limiting de login sin estado** (cookie firmada HMAC + demoras progresivas): apto para
   serverless; complementa los límites propios de Supabase Auth.
7. **Formulario de contacto sin backend de email**: compone un mensaje de WhatsApp (canal real
   del negocio) con honeypot + tiempo mínimo anti-spam. Evita introducir un proveedor de correo.
8. **Next.js 15.5 (App Router)**: última línea estable y probada de la serie 15 al momento del
   desarrollo, con soporte completo de RSC/Server Actions en Vercel.

## Flujo de una venta (operación crítica)

```text
SellDialog (client) → markSoldAction (Server Action)
  1. requireAdminAction()  → sesión + perfil activo + rol admin
  2. saleSchema (Zod)      → fechas, importes, cotización, gastos
  3. rpc mark_product_sold → EN UNA TRANSACCIÓN:
       verifica admin de nuevo (assert_admin, SECURITY DEFINER)
       verifica producto existente y no vendido
       valida fecha (futura / anterior a compra sin confirmación)
       inserta venta (cotización + snapshot de lista congelados)
       inserta gastos de venta
       inserta cobro inicial + movimiento de caja (opcional)
       actualiza producto → vendido + despublicado
       triggers: historial de estado + auditoría + recálculo de pago
  4. cualquier error ⇒ ROLLBACK COMPLETO (nada queda a medias)
```
