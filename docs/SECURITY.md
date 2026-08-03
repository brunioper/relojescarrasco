# Modelo de seguridad y checklist

## Principios

1. **Default-deny**: RLS en todas las tablas; `anon` sin permisos de tabla (REVOKE ALL);
   el público solo ve las vistas seguras.
2. **El navegador nunca es fuente de verdad**: rol y estado se leen SIEMPRE del perfil en la
   base; toda entrada pasa por Zod en el servidor; la base re-verifica con RLS + funciones.
3. **Defensa en profundidad**: middleware → layout → Server Action → RLS → triggers/constraints.
4. **Privilegio mínimo**: la service-role key solo se usa en dos puntos del servidor
   (auditoría de logins fallidos y URLs firmadas de documentos privados), siempre tras verificar
   la autorización del usuario, y nunca sustituye a RLS.

## Controles implementados

| Amenaza | Control |
| --- | --- |
| Acceso anónimo a datos financieros | REVOKE + RLS default-deny; vistas públicas con columnas explícitas |
| IDOR (manipular IDs) | RLS por rol en cada tabla; validación UUID con Zod; slugs públicos (sin IDs internos en URLs) |
| Escalada de privilegios | Trigger `guard_profile_update`: nadie cambia su propio rol/estado; solo admin gestiona usuarios |
| Inyección SQL | Supabase client parametrizado; sin SQL concatenado; funciones con `search_path` fijado |
| XSS | React escapa por defecto; sin `dangerouslySetInnerHTML` salvo JSON-LD generado por el servidor; CSP-friendly |
| CSRF | Server Actions de Next (tokens propios) + cookies `SameSite=Lax` |
| Fuerza bruta en login | Demoras progresivas con cookie firmada HMAC + límites de Supabase Auth + auditoría de fallos |
| Enumeración de usuarios | Respuesta idéntica en recuperación de contraseña exista o no el email |
| Subida de archivos maliciosos | Allowlist de MIME en bucket + validación de tipo/tamaño en cliente + recompresión canvas→WebP (reencodea el archivo) + nombres aleatorios |
| Exposición de secretos | `server-only` en módulos sensibles; sin `NEXT_PUBLIC_` en secretos; validación de env al arrancar; sin secretos en Git (.gitignore) |
| Fugas en errores | `safeErrorMessage()`: mensajes de negocio traducidos; el resto se loguea en servidor y el usuario ve un genérico |
| Manipulación de auditoría | `audit_logs` sin políticas de escritura; inserciones solo vía SECURITY DEFINER; admin solo lectura |
| Clickjacking / MIME sniffing | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS |
| Indexación del panel | `X-Robots-Tag: noindex` en `/admin` y `/auth` + robots.txt |
| Redirecciones abiertas | Post-login/callback solo acepta rutas internas (`/admin/...`) |

## Datos que NUNCA se exponen públicamente

Precio y fecha de compra, proveedor, costos de reparación/service, costo total, precio real de
venta, ganancias y márgenes, clientes, números de serie, notas internas, auditoría, caja y
liquidez, documentos privados. Verificado por: vistas con columnas explícitas, pruebas de
integración (`tests/integration/security-rls.test.ts`) y prueba E2E que inspecciona el HTML
público en busca de valores privados del seed.

## Checklist de revisión periódica

- [ ] `npm run test:integration` en verde (RLS real contra la base)
- [ ] `npm run test:e2e` en verde (flujo completo + privacidad del HTML)
- [ ] Sin `service_role` en los bundles del navegador (búsqueda en DevTools)
- [ ] Dependencias: `npm audit` sin vulnerabilidades críticas
- [ ] Usuarios del panel: solo cuentas necesarias, roles correctos, inactivos deshabilitados
- [ ] `RATE_LIMIT_SECRET` configurado en producción (≥ 32 caracteres aleatorios)
- [ ] Logs de auditoría revisados ante cualquier sospecha (Admin → Auditoría)
- [ ] Claves de Supabase rotadas si hubo algún incidente (Settings → API → Reset)
