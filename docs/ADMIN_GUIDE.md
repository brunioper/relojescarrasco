# Guía del administrador — Relojes Carrasco

Guía práctica para operar el sistema día a día, sin conocimientos técnicos.

## Entrar y salir

- Panel: `https://tusitio.uy/auth/login` → email y contraseña.
- Salir: menú con tu nombre (arriba a la derecha) → **Cerrar sesión**.
- ¿Contraseña olvidada? → «¿Olvidaste tu contraseña?» y seguí el enlace del correo.

## Conceptos clave (en criollo)

| Término | Qué significa |
| --- | --- |
| **Precio de compra** | Lo que pagaste por el reloj. |
| **Costo total** | Compra + service + repuestos + todo lo que le pusiste a ese reloj. |
| **Precio listado** | El precio publicado en el catálogo (en USD para el público). |
| **Precio de venta** | Lo que realmente te pagaron (puede diferir del listado). |
| **Ganancia bruta** | Venta − costo total. |
| **Ganancia neta** | Bruta − gastos de esa venta (envío, comisiones). |
| **Margen** | Ganancia como % del precio de venta. |
| **Flujo de caja** | Plata que ENTRÓ y SALIÓ de verdad en un período. |
| **Liquidez** | Plata disponible AHORA en tus cuentas. Los relojes sin vender NO son liquidez. |
| **Cuentas por cobrar** | Ventas que aún no te terminaron de pagar. |
| **Cuentas por pagar** | Compras/gastos que aún no pagaste. |

## Ciclo de vida de un reloj

### 1. Cargarlo

**Productos → Nuevo reloj.** Completá nombre, marca y lo que sepas.
El *número de serie* y las *notas internas* son privados: el público jamás los ve.

### 2. Fotos

Pestaña **Imágenes**: arrastrá las fotos (o sacalas con el teléfono). Se comprimen solas.
La primera es la portada; podés cambiarla con la ⭐ y ordenar con las flechas.

### 3. Compra y costos

Pestaña **Compra y costos**: fecha, importe, moneda (USD o UYU) y la cotización del día
(viene precargada). **Agregar costo** por cada service, cristal, correa, etc. — normalmente en
pesos. Todo queda con su cotización histórica para calcular la ganancia real.

### 4. Precio y publicación

Pestaña **Precio de lista**: ingresá el precio en USD o en UYU; el sistema muestra cómo lo verá
el público (siempre `US$ … ($ … UYU aprox.)`). Cada cambio queda en el historial.
Luego botón **Publicar**. Sin precio no se puede publicar.

### 5. Estados

**Reservado** (seña recibida — por defecto se oculta del catálogo, configurable),
**En reparación** (no aparece público), **No publicado** (borrador), **Archivado** (fuera de
circulación). Todos desde el menú `⋯` del producto.

### 6. Venta 🎉

Botón **Registrar venta**: fecha, precio real, moneda, cotización, cliente (opcional), cuánto
cobraste ahora y a qué caja entró. Al confirmar, en una sola operación segura: se registra la
venta, el cobro, y el reloj sale del catálogo. Si te pagaron en cuotas, el saldo queda como
cuenta por cobrar y lo vas cobrando desde **Pagos**.

¿Se cayó la venta? Menú `⋯` → **Cancelar venta** (pide motivo): el reloj vuelve a disponible,
sin publicar.

## Operación diaria

- **Gastos**: todo gasto que no es de un reloj puntual (publicidad, contador, hosting…).
  Si queda impago, cargalo igual con su vencimiento: aparecerá en cuentas por pagar.
- **Pagos**: acá cobrás cuotas de ventas y pagás pendientes. Elegí el comprobante, el importe
  (admite parciales) y la caja. El saldo y el estado se actualizan solos.
- **Caja y liquidez**: saldos reales por cuenta. Registrá aportes/retiros tuyos y
  transferencias entre cuentas (incluye cambio USD⇄UYU).
- **Cotizaciones**: cargá el dólar cuando cambie (o botón **Obtener automática**). El panel te
  avisa si está vieja. Las cotizaciones pasadas no se pueden tocar: cada operación conserva la
  suya para siempre.
- **Reportes**: ventas, rentabilidad, inventario, gastos y liquidez por período, con exportación
  a CSV, Excel y PDF.

## Configuración y usuarios

**Configuración**: nombre del negocio, WhatsApp (¡el de los botones del sitio!), Instagram,
textos legales, SEO, si se muestran reservados y la conversión a pesos.

**Usuarios**: se crean desde el panel de Supabase (pedíselo a tu técnico o seguí
[SUPABASE.md](SUPABASE.md)); después vos les das rol desde Configuración:
**Administrador** (gestiona todo) o **Consulta** (solo mira). Nadie puede cambiarse su propio
rol. Todo lo importante queda registrado en **Auditoría**.

## Preguntas frecuentes

**¿Cambiar el precio listado modifica mis números?** No. Solo cambia lo que ve el público;
compra, costos y ventas históricas quedan intactas.

**¿Por qué la ganancia usa cotizaciones “viejas”?** Porque cada operación se registró con el
dólar de SU día: esa es tu ganancia real, no una recalculada.

**¿Puedo borrar un reloj vendido?** No — es historia contable. Podés archivarlo.

**Vendí más barato que la lista, ¿pasa algo?** No: registrá el precio real; el reporte te
muestra el descuento promedio.

**¿El UYU del catálogo es exacto?** Es aproximado y el sitio lo aclara. El precio real de la
operación se acuerda al concretar.
