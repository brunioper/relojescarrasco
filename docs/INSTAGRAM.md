# Instagram → catálogo

Cada historia o publicación nueva de la cuenta del negocio con un reloj o una correa se
convierte sola en un producto del catálogo. Lo que necesita una decisión espera en el panel,
en **Instagram**.

Para activarlo: [BLOQUEOS.md](../BLOQUEOS.md), punto 6.

## Cómo funciona

Cada 15 minutos el sitio revisa las historias activas y las últimas publicaciones. Lo nuevo
(publicado desde que se conectó la cuenta) pasa por estos pasos:

1. **Se guardan las fotos** enseguida. Las historias desaparecen a las 24 horas y los links de
   Instagram vencen, así que se copian al sitio. En los videos se usa la imagen de portada. En
   las publicaciones con varias fotos se guardan todas (hasta 10).
2. **La IA mira las fotos** con las mismas reglas que la carga manual: marca, modelo,
   referencia y materiales solo si se ven. Además lee si la imagen dice VENDIDO o RESERVADO, y
   el precio, pero **solo si está escrito**. Nunca lo estima.
3. **Se decide qué hacer**:

| Lo que se ve | Qué pasa |
| --- | --- |
| Un reloj o una correa nuevo, con el precio en dólares escrito | Se crea el producto y **se publica solo** |
| Un reloj o una correa nuevo, sin precio (o en pesos) | Se crea **sin publicar**; en la bandeja cargás el precio y tocás Publicar |
| Algo que se parece a un producto que ya está en el catálogo | **Espera tu aprobación**: «Es este: agregar fotos» o «Es otro: crear producto» |
| No se lee la marca | Espera tu revisión, con los datos que sí se leyeron ya completados |
| Dice VENDIDO, o no es un producto (el local, un cliente, varios relojes, un texto) | Se descarta. Igual queda en el historial por si querés crearlo |

«Se parece» es a propósito amplio: misma referencia, o misma marca y modelo, o misma marca
cuando no se lee el modelo. Tolera errores de tipeo («Citzen», «Tag Heur»). Una coincidencia de
más solo te pide un clic; una de menos publicaría un duplicado.

Lo que la IA nunca completa (estado, año, caja y papeles) queda vacío para que lo cargues vos
en la ficha. El producto queda anotado como «Creado desde Instagram» con el link a la historia.

## La bandeja

- **Para revisar**: lo que espera una decisión. El número junto a «Instagram» en el menú es
  esta cantidad.
- **Historial**: lo publicado solo, lo resuelto y lo descartado.
- **Publicar automáticamente**: apagado, todo se crea sin publicar y lo publicás vos.
- **Revisar ahora**: hace la revisión en el momento, sin esperar los 15 minutos.

Si llegó a configurarse el email (Resend), te avisa cuando algo se publicó solo o espera tu
aprobación.

## Límites

- Una historia que **comparte una publicación** no aparece en la API de Instagram. Igual se
  importa la publicación original, porque también se revisan las publicaciones del feed.
- Las historias con música con derechos no traen el video; se usa su imagen de portada.
- Hasta 3 piezas nuevas por revisión, para entrar en el tiempo máximo de la función. Lo demás
  sigue en la revisión siguiente.
- Si se alcanza el tope mensual de IA, lo nuevo queda «Esperando la IA» con las fotos ya
  guardadas, y se procesa cuando se renueva el mes.
- GitHub pausa las tareas programadas de un repositorio sin cambios durante 60 días. El panel
  avisa si la revisión no corrió en las últimas 2 horas.

## Costo

Cada pieza nueva cuesta unos US$ 0,02 a 0,05 de IA (mira hasta 4 fotos). Con 10 historias por
día son unos US$ 6 a 15 por mes; el tope mensual (US$ 5 por defecto) corta antes. Ver
[COSTOS.md](../COSTOS.md).
