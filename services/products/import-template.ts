import "server-only";

import ExcelJS from "exceljs";

/**
 * Plantilla descargable para la importación en lote de productos.
 * Columnas en español, con una fila de ejemplo y una hoja de instrucciones.
 * Solo "nombre" y "marca" son obligatorios: todo lo demás puede omitirse.
 */

export const IMPORT_COLUMNS = [
  "nombre",
  "marca",
  "modelo",
  "referencia",
  "anio",
  "movimiento",
  "material_caja",
  "material_correa",
  "diametro_mm",
  "resistencia_agua",
  "genero",
  "estado_conservacion",
  "incluye_caja",
  "incluye_documentacion",
  "accesorios",
  "descripcion",
  "estado_publicacion",
  "destacado",
  "precio",
  "moneda_precio",
  "cotizacion_precio",
] as const;

const HELP_ROWS: [string, string, string][] = [
  ["nombre", "Sí", "Texto libre"],
  ["marca", "Sí", "Texto libre"],
  ["modelo", "No", "Texto libre"],
  ["referencia", "No", "Texto libre"],
  ["anio", "No", "Número, ej. 1968"],
  ["movimiento", "No", "automatico | manual | cuarzo | solar | otro (por defecto: automatico)"],
  ["material_caja", "No", "Texto libre"],
  ["material_correa", "No", "Texto libre"],
  ["diametro_mm", "No", "Número, ej. 40"],
  ["resistencia_agua", "No", "Texto libre, ej. 100 m"],
  ["genero", "No", "Texto libre"],
  ["estado_conservacion", "No", "Texto libre"],
  ["incluye_caja", "No", "si | no"],
  ["incluye_documentacion", "No", "si | no"],
  ["accesorios", "No", "Texto libre"],
  ["descripcion", "No", "Texto libre (descripción pública)"],
  [
    "estado_publicacion",
    "No",
    "disponible | reservado | no_publicado | en_reparacion (por defecto: no_publicado)",
  ],
  ["destacado", "No", "si | no"],
  ["precio", "No", "Número, ej. 2300"],
  ["moneda_precio", "No", "USD | UYU (por defecto: USD)"],
  ["cotizacion_precio", "No", "Número. Si se omite se usa la cotización activa del sistema"],
];

export async function buildProductImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Relojes Carrasco";

  const sheet = workbook.addWorksheet("Relojes");
  sheet.addRow([...IMPORT_COLUMNS]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFE7D8" },
  };

  sheet.addRow([
    "Omega Seamaster Automático",
    "Omega",
    "Seamaster",
    "166.032",
    1968,
    "automatico",
    "Acero",
    "Cuero",
    35,
    "30 m",
    "Hombre",
    "Muy bueno, service reciente",
    "si",
    "no",
    "",
    "Reloj vintage con esfera plateada original.",
    "disponible",
    "no",
    2300,
    "USD",
    "",
  ]);

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const help = workbook.addWorksheet("Instrucciones");
  help.addRow(["Columna", "Obligatorio", "Valores permitidos"]);
  help.getRow(1).font = { bold: true };
  for (const row of HELP_ROWS) help.addRow(row);
  help.columns.forEach((column) => {
    column.width = 26;
  });
  help.getColumn(3).width = 55;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
