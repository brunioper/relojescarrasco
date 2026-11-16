# Costos mensuales

Regla: primero lo que ya se paga, después lo gratis. Nada pago se activa sin figurar acá y en
[BLOQUEOS.md](BLOQUEOS.md).

Última actualización: 16/11/2026

## Hoy

| Servicio | Para qué | Plan | Costo mensual |
| --- | --- | --- | --- |
| Vercel | Hosting del sitio y del panel | Hobby (gratis) | US$ 0 |
| Supabase | Base de datos, login, fotos | Free | US$ 0 |
| GitHub + Actions | Código, pruebas automáticas, respaldos | Free | US$ 0 |
| Resend | Mails de aviso de pedidos | Free (3.000 mails/mes) | US$ 0 |
| Dominio relojescarrasco.com | Dirección del sitio | Ya contratado | (lo que ya pagás) |
| **Total nuevo** | | | **US$ 0** |

## Previsto para las próximas etapas

| Servicio | Para qué | Plan | Costo estimado |
| --- | --- | --- | --- |
| API de Claude | Detectar modelo desde fotos, descripciones, respuestas sugeridas | Pago por uso, con tope | **menos de US$ 1/mes** (tope sugerido US$ 5) |
| Mercado Pago | Cobro online de correas | Sin mensualidad | Solo comisión por venta (aprox. 5 a 7 % + IVA según plazo de acreditación; confirmar tarifa vigente al activar) |
| APIs de Instagram / Meta | Publicaciones, DMs, Pixel | Gratis | US$ 0 |
| **Total previsto** | | | **menos de US$ 1/mes + comisiones por venta** |

### Cómo se estimó la IA

Una carga de producto con 4 fotos usa unas 7.000 unidades de entrada y 1.000 de salida. Con un
modelo económico con visión (Claude Haiku) eso es alrededor de 1 centavo de dólar por producto.
Con 50 productos por mes más respuestas sugeridas, el gasto queda por debajo de US$ 1. El tope
se configura en la cuenta de Anthropic y además en el panel.

Alternativa gratuita evaluada: modelos con plan gratis (por ejemplo Gemini Flash) sirven para
tareas simples, pero sus planes gratuitos pueden usar los datos para entrenar y tienen límites
que cambian sin aviso. Para un costo de centavos, se prioriza la calidad y la privacidad.

## Límites del plan gratis a vigilar

| Límite | Valor | Situación |
| --- | --- | --- |
| Supabase: base de datos | 500 MB | Muy lejos (un catálogo de relojes ocupa pocos MB) |
| Supabase: almacenamiento de fotos | 1 GB | Las fotos se comprimen a WebP antes de subir (unas 3.000 a 5.000 fotos) |
| Supabase: pausa por inactividad | 7 días sin uso | No aplica mientras el sitio tenga visitas |
| Vercel: optimización de imágenes | Cuota mensual | Desactivada a propósito (las fotos ya se suben optimizadas) |
| GitHub Actions | Ilimitado en repo público; 2.000 min/mes en privado | Cada verificación usa unos 10 minutos |

## Medios de pago comparados (Uruguay)

| Opción | Costo fijo | Comisión | Comentario |
| --- | --- | --- | --- |
| **Mercado Pago (elegido)** | No | Por venta | Tarjetas locales, débito, Abitab/RedPagos; el más conocido en Uruguay |
| Transferencia bancaria (se suma) | No | No | Sin comisión; confirmación manual desde el panel |
| dLocal Go | No | Por venta | Buena alternativa; menos conocido por el comprador |
| PayPal | No | Alta, y retiro complicado en Uruguay | No conviene |
| Stripe | — | — | No opera para comercios de Uruguay |
