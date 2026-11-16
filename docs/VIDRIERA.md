# Sitio público (vidriera)

## Catálogo y filtros

Los filtros viven en la URL y se aplican en el servidor (`lib/catalogue-params.ts` →
`services/catalogue.ts`). Un valor inválido se ignora en lugar de romper la página.

| Parámetro | Ejemplo | Filtra por |
| --- | --- | --- |
| `q` | `?q=datejust` | Nombre, marca, modelo o referencia |
| `marca` | `?marca=Omega` | Marca exacta |
| `min`, `max` | `?min=1000&max=3000` | Precio en USD |
| `tamano` | `?tamano=37-39` | Diámetro: `hasta-36`, `37-39`, `40-42`, `43-mas` |
| `material` | `?material=Acero` | Material de caja (tal como se cargó en el panel) |
| `movimiento` | `?movimiento=automatico` | Tipo de movimiento |
| `caja`, `papeles` | `?caja=1` | Incluye caja / papeles |
| `tipo` | `?tipo=accesorio` | Relojes o correas y accesorios |
| `orden` | `?orden=price_asc` | `newest`, `price_asc`, `price_desc`, `oldest` |

Para que tamaño y material funcionen bien, conviene cargar el diámetro en mm y escribir el
material siempre igual ("Acero", "Acero y oro", "Oro amarillo"…).

Links útiles para anuncios y redes: `/catalogo?marca=Rolex`, `/catalogo?tipo=accesorio`.

## Consulta por Instagram

Instagram no permite abrir un DM con el texto ya escrito (WhatsApp sí). El botón **Consultar por
Instagram**:

1. copia al portapapeles la consulta con el modelo, la referencia y el link de la ficha, y
2. abre el chat con la cuenta del negocio (`https://ig.me/m/<usuario>`).

El cliente solo pega y envía. El usuario de Instagram sale de Configuración → Instagram en el
panel. El mensaje se arma en `lib/inquiry.ts`.

## Confianza

- `components/public/trust-points.tsx`: bloque de autenticidad, garantía y local (catálogo y
  ficha).
- `/autenticidad-y-garantia`: proceso de verificación, garantía y preguntas frecuentes.
- `/vende-tu-reloj`: formulario guiado que arma un mensaje ordenado y lo envía por Instagram o
  WhatsApp. No guarda datos en el sitio.

Los textos no prometen plazos concretos de garantía: cuando el dueño los confirme, se editan en
esas dos páginas.

## SEO

- Dominio canónico: `lib/site.ts`. En producción nunca se usa un dominio `*.vercel.app`.
- Datos estructurados (`components/public/json-ld.tsx`): `JewelryStore` en todo el sitio,
  `Product` + `BreadcrumbList` en cada ficha, `FAQPage` en autenticidad y garantía.
- Títulos por marca: `/catalogo?marca=Omega` → "Relojes Omega en Uruguay".
- Las versiones de prueba (Preview) no se indexan.

## Medición (Meta Pixel)

Se activa con la variable `NEXT_PUBLIC_META_PIXEL_ID`. Sin ella no se carga ningún script de
terceros. Solo corre en el sitio público, nunca en el panel.

| Evento | Cuándo |
| --- | --- |
| `PageView` | Cada página |
| `ViewContent` | Al abrir la ficha de un producto (con marca, categoría y precio) |
| `Contact` | Clic en consultar por Instagram o WhatsApp |
| `Lead` | Envío del formulario "Vendé tu reloj" |

Al activar el Pixel, la política de privacidad agrega sola el párrafo correspondiente.

## Accesibilidad

Texto base de 16 px, botones y campos de al menos 44 px de alto, contraste AA en textos,
navegación completa por teclado, enlace "Saltar al contenido" y selectores nativos del sistema
en los filtros (más cómodos en el celular).
