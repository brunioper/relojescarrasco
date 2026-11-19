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
| API de Claude | Completar fichas desde fotos y leer historias y publicaciones de Instagram | Pago por uso, con tope | **US$ 1 a 5/mes** (tope por defecto US$ 5, se cambia en Configuración) |
| Mercado Pago | Cobro online de correas | Sin mensualidad | Solo comisión por venta (aprox. 5 a 7 % + IVA según plazo de acreditación; confirmar tarifa vigente al activar) |
| APIs de Instagram / Meta | Publicaciones, DMs, Pixel | Gratis | US$ 0 |
| **Total previsto** | | | **US$ 1 a 5/mes + comisiones por venta** |

### Cómo se estimó la IA

El sitio usa Claude Opus por defecto (el más preciso para leer referencias y esferas). Una
lectura de 1 a 4 fotos usa unas 2.000 a 7.000 unidades de entrada y 500 de salida: entre 2 y 5
centavos de dólar.

- Carga manual: 50 productos por mes son US$ 1 a 2,5.
- Instagram (Etapa 6): cada historia o publicación nueva se lee una vez. Con 5 por día son
  US$ 3 a 7,5 por mes; con 10 por día, US$ 6 a 15.

El tope mensual (US$ 5 por defecto) corta antes: al llegar, la IA se pausa hasta el mes
siguiente y lo de Instagram queda guardado esperando. Se cambia en Configuración. Si se quiere
gastar menos, se puede pasar a un modelo más económico (Claude Haiku, unas 5 veces más barato)
con la variable `ANTHROPIC_MODEL=claude-haiku-4-5`, a costa de algo de precisión.

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
