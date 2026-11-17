/**
 * Datos estructurados (schema.org) para buscadores.
 *
 * Se escapa "<" para que ningún texto cargado desde el panel (por
 * ejemplo una descripción) pueda cerrar la etiqueta <script>.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
