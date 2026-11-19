# Correas y accesorios: variantes, compatibilidad y modo de venta

## Cargar una correa en un minuto

1. **Productos → Nuevo → Accesorio.** Nombre, marca y descripción. Guardar.
2. **Pestaña Imágenes:** subir las fotos.
3. **Pestaña Precio de lista:** precio en USD.
4. **Pestaña Variantes → Generar combinaciones.** Por ejemplo:
   - Anchos: `18, 20, 22`
   - Materiales: `Cuero`
   - Colores: `Negro, Marrón`
   - Stock de cada una: `1`

   Se crean las 6 filas. Corregí el stock de cada fila y apretá **Guardar variantes**.
5. **Compatibilidad** (misma pestaña): una línea por reloj, `Marca | Modelo`. Solo la marca
   significa todos sus modelos.
6. **Publicar.**

Para una correa parecida a otra ya cargada: en el producto, **Duplicar**, cambiar el nombre y
ajustar las variantes.

## Cómo funciona el stock

- Si el producto **tiene variantes**, el stock total es la suma de las variantes activas. Lo
  calcula la base de datos: no se puede desincronizar.
- Si **no tiene variantes**, usa el stock único de la pestaña Datos (como hasta ahora).
- Una variante **inactiva** no se muestra en el sitio ni suma al stock.
- El **precio** de una variante es opcional: vacío usa el precio de lista del producto.
- Cuando todas las variantes quedan sin stock, la correa sale sola del catálogo.

## Vender

**Registrar venta** pide elegir la variante. Se descuenta el stock de esa variante y la venta
queda registrada con la variante vendida. Cancelar la venta devuelve la unidad a la misma
variante.

## En el sitio

- La ficha muestra las variantes como botones. Las que no tienen stock aparecen tachadas.
- La consulta por Instagram o WhatsApp incluye la variante elegida.
- Filtros en **Correas y accesorios**: *Para mi reloj* (por marca) y *Ancho de correa*.
  Links directos: `/catalogo?tipo=accesorio&para=Rolex`, `/catalogo?tipo=accesorio&ancho=20`.
- En la ficha de cada reloj aparece "Correas para tu [marca]" con las correas compatibles.

## Cómo se ofrece cada producto (interruptor)

En **Datos → Cómo se ofrece en el sitio**:

| Opción | Qué ve el cliente |
| --- | --- |
| **Consultar** (por defecto) | Precio y botones de consulta por Instagram y WhatsApp |
| **Solo catálogo** | El producto, sin botones de consulta ni de compra |
| **Compra online** | Reservado para el pago online (Etapa 5). Hasta entonces se comporta como Consultar |

Así queda preparado el pago online de relojes: cuando se active el checkout, alcanza con poner
el producto en **Compra online**. No hay que tocar nada más.

## Nuevo o usado

La casilla **Es nuevo (sin uso)** marca el reloj como nuevo: se muestra en la ficha, en los
datos para Google y habilita el filtro *Condición* del catálogo. Lo que no está marcado se
considera usado.

## Vendidos recientes

Al pie del catálogo se muestran los últimos relojes vendidos (foto y nombre, **sin precio**,
comprador ni fecha). Aparece cuando hay al menos 3 vendidos con foto.

Para ocultarlo: en Supabase → SQL Editor,

```sql
insert into public.application_settings (key, value)
values ('show_sold_products', '{"value": false}')
on conflict (key) do update set value = excluded.value;
```

## Detalle técnico

| Qué | Dónde |
| --- | --- |
| Tablas `product_variants`, `product_compatibility`; columnas `sale_mode`, `is_new`, `sales.variant_id` | `supabase/migrations/20261116000001_variants_sale_mode_sold.sql` |
| Venta por variante | función `sell_variant_stock` (reutiliza `sell_accessory_stock`) |
| Vistas públicas | `public_catalogue_products` (variantes y compatibilidad), `public_sold_products` |
| Panel | `components/admin/variants-manager.tsx`, `app/admin/productos/variantes-actions.ts` |
| Sitio | `components/products/variant-inquiry.tsx`, `lib/variants.ts` |
| Tests | `tests/unit/variants.test.ts`, `tests/integration/variants.test.ts`, `tests/e2e/public.spec.ts` |

El público nunca lee las tablas: solo las vistas, que no exponen costos ni datos privados.
