# Plantilla de los reels

La usa `video/worker/proyecto.mjs` para armar cada versión. Cómo funciona todo el estudio:
[docs/REELS.md](../../docs/REELS.md).

- 1080×1920 a 30 cuadros por segundo.
- Variables de cada versión: `gancho`, `estilo` (`elegante`, `impacto` o `pregunta`), `marca`,
  `modelo`, `referencia`, `precio`, `cierre`, `usuario`, `web` y `name` (nombre del archivo).
- Marcadores que completa el armado (no borrarlos): `__TOTAL__`, `__VIDEO__`, `__ROTULO__`,
  `__CIERRE__`, `__CIERRE_DUR__`, `__SUBTITULOS_JSON__`, `<!--VOZ-->` y `<!--SUBTITULOS-->`.
- Los subtítulos quedan por encima de los 1160 px: más abajo los tapa la interfaz de Instagram.
- Después de cambiarla: `node video/worker/prueba.mjs` desde la raíz del repositorio. Arma 3
  versiones de prueba y pasa `hyperframes check` sobre el proyecto completo (esta carpeta sola
  no se puede revisar: le faltan el video y los tiempos que completa el armado).
- Todo corre en la máquina: nada de servicios pagos (`--engine heygen`, `cloud`) y nunca voz
  artificial; la voz es la del dueño o no hay voz.
