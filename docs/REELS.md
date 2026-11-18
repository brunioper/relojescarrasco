# Estudio de reels

Subís un video del reloj, la IA lo mira y te escribe el guion, lo grabás con tu voz y se arman
3 versiones con subtítulos y animaciones para probar como reels de prueba. Todo desde el panel,
en **Videos**.

Para activarlo: [BLOQUEOS.md](../BLOQUEOS.md), punto 7.

## Cómo se usa

1. **Subí el video.** Panel → **Videos** → elegí el producto (opcional: sirve para el guion y el
   rótulo) → **Elegir video**. Vertical, de 6 a 90 segundos y hasta 50 MB. En el iPhone conviene
   grabar en 1080p (Ajustes → Cámara → Grabar video). El sonido del video no se usa.
2. **La IA escribe el guion.** Mira 6 cuadros del video y los datos del producto, y escribe:
   3 ganchos (uno por versión), lo que decís tramo por tramo con sus segundos, el texto del
   posteo con hashtags y un consejo de grabación. No inventa estado, año, caja ni precio: solo
   usa lo que está en la ficha. Podés cambiar todo y tocar **Guardar**, o **Reescribir con IA**.
3. **Grabá tu voz.** Tocá **Grabar**: cuenta 3, 2, 1, el video corre sin sonido y el guion
   aparece como teleprompter, tramo por tramo. Después, **Escuchar con el video** y **Usar esta
   toma** (o **Grabar de nuevo**). También podés grabar aparte, arrancando junto con el video,
   y tocar **Subir un audio**. Sin voz, el guion aparece como texto en pantalla.
4. **Generá los reels.** En unos 10 a 20 minutos están las 3 versiones (la página se actualiza
   sola). Cada una tiene:
   - un gancho distinto en los primeros 3 segundos, con su estilo: **Elegante**, **Impacto** o
     **Pregunta**;
   - subtítulos automáticos sacados de tu voz, palabra por palabra;
   - el rótulo del reloj: marca, modelo, referencia y precio (el precio solo si el producto
     está publicado);
   - el cierre: logo, «Consultá por mensaje directo», @relojes_carrasco y relojescarrasco.com.
5. **Publicá.** **Descargar** cada versión al celular y **Copiar** el texto del posteo. En
   Instagram, al compartir cada reel, activá **Prueba** (reels de prueba): se muestra primero a
   quienes no te siguen, y después ves cuál funcionó mejor y la compartís con tus seguidores.
   Si tu cuenta no tiene esa opción, publicá la que más te guste.

## Qué pasa por dentro

- El video y la voz van directo del navegador a un espacio privado de Supabase (bucket
  `videos`) con enlaces firmados de un solo uso. Nadie más puede verlos.
- A la IA (Claude) solo le llegan 6 imágenes chicas del video, nunca el video entero.
- Cada 5 minutos, una tarea de GitHub ([video.yml](../.github/workflows/video.yml)) pregunta
  al sitio si hay videos en cola. Si hay, en esa máquina:
  1. recorta el video a vertical 1080×1920;
  2. empareja el volumen de la voz y le saca el desfase de la grabación;
  3. transcribe tu voz con whisper ahí mismo (gratis; la voz no va a ningún otro servicio) para
     los subtítulos. Si no se puede, usa las líneas del guion;
  4. arma las 3 versiones con HyperFrames (plantilla en `video/plantilla-reel/`) y las sube.
- Nunca se genera una voz artificial: la voz es la tuya, o no hay voz.

## Espacio y límites

- Los archivos (video, voz y versiones) se guardan **15 días**; el guion y el texto quedan
  siempre. Si hace falta lugar para un video nuevo, se borran antes los archivos de los videos
  que no tocás hace más tiempo (nunca los que se están armando).
- El estudio usa como máximo **400 MB** del almacenamiento gratuito de Supabase (1 GB en
  total). El resto queda para las fotos del catálogo, que no se tocan nunca.
- Cada versión pesa como mucho 40 MB (normalmente entre 5 y 25 MB).
- Se arman hasta 3 videos por corrida; si hay más en cola, siguen en la corrida siguiente.
- Las tareas programadas de GitHub a veces tardan unos minutos en arrancar, y GitHub las pausa
  si el repositorio pasa 60 días sin cambios.
- Si un armado se corta, vuelve solo a la cola (hasta 3 intentos). Si falla, el panel muestra
  el motivo y el botón **Reintentar**.

## Costo

- Guion con IA: unos US$ 0,03 a 0,05 por video, dentro del tope mensual de IA (Configuración).
- Armado, subtítulos y almacenamiento: US$ 0. GitHub Actions es gratis en repositorios
  públicos, whisper corre en esa misma máquina y los archivos entran en el plan gratuito de
  Supabase. Ver [COSTOS.md](../COSTOS.md).

## Para desarrollo

- Plantilla: `video/plantilla-reel/index.html`, con las variables `gancho`, `estilo`, `marca`,
  `modelo`, `referencia`, `precio`, `cierre`, `usuario` y `web`. Para verla:
  `cd video/plantilla-reel && npx hyperframes@0.9.61 preview`.
- Armado: `video/worker/procesar.mjs` (usa `proyecto.mjs` y `subtitulos.mjs`).
- Prueba del armado completo sin el sitio: `node video/worker/prueba.mjs`. En los PR que tocan
  `video/` la corre [reels-prueba.yml](../.github/workflows/reels-prueba.yml), con una voz de
  prueba y whisper.
- La tarea habla con el sitio por `/api/video/trabajo/{pendientes,tomar,subidas,terminar}`,
  con `Authorization: Bearer CRON_SECRET`.
- En `transcribe` nunca usar `--engine heygen`: es un servicio pago.
