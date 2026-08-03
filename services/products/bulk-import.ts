import "server-only";

import ExcelJS from "exceljs";
import type { CellValue } from "exceljs";

/**
 * Parsing de la planilla de importación en lote (formato de
 * services/products/import-template.ts). Tolerante: columnas faltantes
 * o vacías se toman como ausentes; solo nombre/marca son obligatorios
 * (se validan en el llamador, no acá).
 */

export type ImportedRow = {
  rowNumber: number;
  get(column: string): CellValue | undefined;
};

export type ParsedImportSheet = {
  rows: ImportedRow[];
};

const MOVEMENTS = new Set(["automatico", "manual", "cuarzo", "solar", "otro"]);
const PUBLICATION_STATUSES = new Set(["disponible", "reservado", "no_publicado", "en_reparacion"]);

export async function parseImportWorkbook(
  buffer: Buffer
): Promise<{ ok: true; sheet: ParsedImportSheet } | { ok: false; error: string }> {
  const workbook = new ExcelJS.Workbook();
  try {
    // Cast: exceljs empaqueta su propia definición de Buffer (@types/node
    // más antiguo) que difiere estructuralmente de la de este proyecto.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return {
      ok: false,
      error: "No se pudo leer el archivo. Verifique que sea un .xlsx válido (el de la plantilla).",
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    return { ok: false, error: "La planilla no contiene filas de datos." };
  }

  const headerValues = worksheet.getRow(1).values;
  const headers: string[] = [];
  // ExcelJS Row.values es un array disperso 1-indexado (índice 0 vacío).
  (Array.isArray(headerValues) ? headerValues : []).forEach((value, index) => {
    if (index === 0) return;
    headers[index - 1] = String(value ?? "").trim().toLowerCase();
  });

  if (!headers.includes("nombre") || !headers.includes("marca")) {
    return {
      ok: false,
      error:
        "La planilla no tiene el formato esperado (faltan columnas 'nombre' y/o 'marca'). Descargue la plantilla nuevamente.",
    };
  }

  const dataRows = worksheet.getRows(2, worksheet.rowCount - 1) ?? [];
  const rows: ImportedRow[] = dataRows
    .filter((row) => row.values && (row.values as unknown[]).some((v) => v !== null && v !== undefined && v !== ""))
    .map((row) => ({
      rowNumber: row.number,
      get(column: string) {
        const columnIndex = headers.indexOf(column.toLowerCase());
        if (columnIndex === -1) return undefined;
        return row.getCell(columnIndex + 1).value;
      },
    }));

  return { ok: true, sheet: { rows } };
}

export function cellToText(value: CellValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object" && "richText" in (value as object)) {
    const richText = (value as { richText: { text: string }[] }).richText;
    const joined = richText.map((part) => part.text).join("");
    return joined.trim() || null;
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function cellToNumber(value: CellValue | undefined): number | null {
  const text = cellToText(value);
  if (text === null) return null;
  const normalized = text.replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function cellToBoolean(value: CellValue | undefined): boolean {
  const text = cellToText(value)?.toLowerCase() ?? "";
  return ["si", "sí", "yes", "true", "1", "x"].includes(text);
}

export function cellToMovement(value: CellValue | undefined): string {
  const text = cellToText(value)?.toLowerCase() ?? "";
  return MOVEMENTS.has(text) ? text : "automatico";
}

export function cellToPublicationStatus(value: CellValue | undefined): string {
  const text = cellToText(value)?.toLowerCase() ?? "";
  return PUBLICATION_STATUSES.has(text) ? text : "no_publicado";
}
