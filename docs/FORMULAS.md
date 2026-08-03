# Fórmulas financieras y metodología de reportes

Implementación central en `services/finance/` (decimal.js; sin float de JS).
Redondeo **solo** al persistir (2 decimales) o mostrar; nunca en pasos intermedios.

## 1. Conversión de moneda

La cotización se expresa como **UYU por 1 USD**.

```text
UYU = USD × cotización
USD = UYU ÷ cotización
```

Toda operación con dinero guarda el **patrón congelado**:
`importe original + moneda + cotización usada + convertido USD + convertido UYU + fecha`.
Las operaciones históricas **jamás** se recalculan con cotizaciones posteriores.

### Conversión del catálogo público

```text
UYU aprox. = precio_lista_USD × cotización_activa_del_catálogo   (redondeado al peso)
```

- La cotización del catálogo es configurable: última activa o valor fijo manual.
- Cambiarla solo altera el UYU aproximado mostrado; nunca el precio USD ni ningún histórico.
- Si el precio se ingresó en UYU, se convierte una única vez con la cotización de ese momento y
  el USD resultante pasa a ser el precio público primario (el origen UYU queda visible solo en
  el panel).

## 2. Costo total del producto

```text
Costo total = precio de compra
            + service + reparaciones + cristal + correa + pulido + limpieza
            + transporte + comisiones de compra + importación + fotografía
            + packaging + otros costos directos
```

Se calcula en USD y UYU **sumando los convertidos históricos** de cada componente.

## 3. Rentabilidad de una venta

```text
Ganancia bruta   = precio real de venta − costo total del producto
Ganancia neta    = ganancia bruta − gastos de la venta (comisión, envío, fees…)
Margen bruto %   = ganancia bruta / precio real de venta × 100
Margen neto %    = ganancia neta  / precio real de venta × 100
Diferencia lista = precio real de venta − precio de lista (snapshot al vender)
Descuento %      = (lista − venta) / lista × 100
Días en stock    = fecha de venta − fecha de compra
```

- Venta o lista en 0 ⇒ los porcentajes devuelven `null` (se muestra “—”), nunca ∞/NaN.
- El precio de lista usado es el **snapshot congelado al momento de la venta**
  (`sales.listing_price_usd_at_sale`), inmune a cambios posteriores.

## 4. Pagos parciales

```text
Pagado (moneda del comprobante) = Σ pagos convertidos con SU cotización histórica
Saldo pendiente                 = total − pagado      (nunca negativo)
Estado: pendiente (0) → parcial (0 < pagado < total) → pagado (≥ total, tolerancia ±0,01)
```

- Cada pago conserva su propia cotización.
- Un pago que supere el saldo se **rechaza** en la base (trigger), no se ajusta en silencio.
- El estado se recalcula automáticamente al crear/editar/borrar pagos.

## 5. Caja y liquidez

```text
Saldo de cuenta = saldo inicial + entradas − salidas      (en la moneda de la cuenta)
Liquidez USD    = Σ saldos de cuentas USD
Liquidez UYU    = Σ saldos de cuentas UYU
Consolidado     = USD + (UYU ÷ cotización activa)          (solo display, nunca se guarda)
```

```text
Caja al cierre (período) =
    caja inicial
  + cobros de ventas + otros ingresos + aportes del dueño
  − compras pagadas − costos pagados − gastos generales pagados
  − gastos de venta pagados − retiros del dueño
```

Reglas:

- Solo movimientos **reales** de caja cuentan para la liquidez.
- El inventario sin vender **no** es caja.
- Lo no cobrado es **cuenta por cobrar**; lo no pagado es **cuenta por pagar** — se informan
  aparte, consolidadas a USD con la cotización histórica de cada comprobante.
- Las transferencias internas afectan los saldos de cada cuenta pero se excluyen del flujo
  consolidado (mueven dinero entre bolsillos propios).

## 6. Inventario

```text
Antigüedad = hoy − fecha de compra (días)
Grupos: 0–30 · 31–60 · 61–90 · 91–180 · +180
Stock lento: > 90 días
Ganancia potencial = precio de lista USD − costo total USD   (estimación pre-venta)
```

## 7. Metodología de reportes

- **Filtros de fecha**: por fecha de la operación (venta → `sale_date`, gasto → `expense_date`,
  caja → `transaction_date`). Presets: hoy, semana, mes, mes anterior, trimestre, año, año
  anterior y rango libre (zona horaria America/Montevideo).
- **Moneda de reporte**: USD como moneda principal usando los convertidos históricos; los
  totales UYU se muestran donde aplican (caja por moneda).
- **Ventas**: solo ventas activas (canceladas excluidas).
- **Exportaciones** (CSV con `;` y BOM, Excel, PDF): mismos datos y filtros que la pantalla;
  requieren sesión de staff; respetan las mismas reglas de autorización.
- **Redondeo de presentación**: USD 2 decimales, UYU al peso, porcentajes 1–2 decimales,
  formato es-UY (miles con punto, decimales con coma).
