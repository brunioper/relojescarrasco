# Limitaciones conocidas y mejoras futuras

## Limitaciones conocidas (no críticas)

1. **Imágenes de productos en bucket público**: nombres aleatorios no adivinables, pero si una
   URL se compartió, la imagen sigue accesible tras despublicar el producto. Aceptado para fotos
   de relojes; los documentos sensibles usan el bucket privado con URLs firmadas.
2. **Rate limiting por navegador**: la cookie firmada limita por cliente, no por IP global.
   Un atacante distribuido depende de los límites propios de Supabase Auth. Mejora futura:
   límite por IP con Upstash/Redis o Vercel WAF.
3. **Formulario de contacto vía WhatsApp**: no hay envío de emails desde el sitio (decisión de
   alcance: el canal real del negocio es WhatsApp). Integrable con Resend si se necesitara.
4. **Cotización automática con proveedores genéricos** (exchangerate.host / open-er-api):
   valores interbancarios de referencia, no la pizarra local (BROU). El flujo manual cubre el
   valor de pizarra; integrar una fuente uruguaya es una mejora futura.
5. **Adjuntos de comprobantes**: el modelo de datos y las políticas del bucket privado están
   completos (`receipt_path` en compras/costos/gastos + `/api/admin/documents`), pero el panel
   aún no incluye la interfaz de subida de recibos (se gestiona vía Storage del Dashboard).
   UI de carga pendiente como mejora.
6. **Sin paginación por cursor en el panel**: los listados administrativos limitan a 200–500
   filas, suficiente para el volumen de un negocio de relojes; el catálogo público sí pagina.
7. **Auditoría de "login fallido" limitada**: registra email intentado, IP y user-agent vía
   service-role; no bloquea por IP (ver punto 2).
8. **Un solo idioma (es-UY)**: la arquitectura permite agregar i18n (next-intl) sin
   reestructurar — textos ya centralizados en configuración y componentes.
9. **Importación de fotos desde Instagram**: Instagram bloquea agresivamente las descargas
   automáticas hechas desde IPs de servidor (como las de Vercel), incluso para posts públicos —
   no es un bug de la aplicación, es su protección antibots. Por eso `services/instagram.ts`
   intenta, en orden: (a) el **oEmbed oficial de Meta**, que sí es confiable porque es una
   llamada de API legítima y no scraping, pero solo entrega la foto de portada, nunca el
   carrusel completo; (b) scraping del HTML del post como respaldo sin configuración (suele
   fallar). Sin las credenciales de Meta configuradas, la importación automática probablemente
   no funcione y quede la subida manual (drag-and-drop, ya soportada) como única vía confiable
   para carruseles completos.

   **Cómo activar el oEmbed oficial** (gratis, sin revisión de la app, 5 minutos):
   1. Entrar a <https://developers.facebook.com/apps> con la cuenta de Facebook del negocio
      (o cualquier cuenta) → **Crear app** → tipo **"Otro"** → **"Empresa"** (no requiere
      caso de uso de Instagram ni revisión: oEmbed es de acceso estándar).
   2. En el panel de la app: **Configuración de la app → Básica**. Copiar **ID de la app** y,
      tras hacer clic en "Mostrar", el **Secreto de la app**.
   3. En Vercel → Settings → Environment Variables, agregar `META_APP_ID` y `META_APP_SECRET`
      con esos valores (solo servidor, sin prefijo `NEXT_PUBLIC_`) → Redeploy.
   4. Probar de nuevo la importación: debería traer la foto de portada de forma consistente.

## Mejoras futuras recomendadas

- **MFA (TOTP)** para administradores: la config ya lo permite; falta la UI de enrolamiento.
- **Notificaciones**: recordatorios de vencimientos (cuentas por pagar/cobrar) por email.
- **Multi-moneda extendida** (EUR): el patrón monetario congelado lo soporta con un enum nuevo.
- **Reservas con seña registrada**: vincular la seña de un reservado como pago a cuenta de la
  futura venta.
- **Etiquetas/colecciones** para el catálogo (vintage, deportivo, dress).
- **Modo oscuro** del panel (tokens ya definidos en globals.css).
- **Historial de auditoría con diff visual** (old_values/new_values ya se almacenan).
- **Backups automatizados de Storage** vía GitHub Action programada.
- **Internacionalización** (inglés) para alcance regional.
