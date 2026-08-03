import "server-only";

import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Generadores de exportación: CSV, Excel (xlsx) y PDF.
 * Reciben datos ya autorizados y filtrados; no consultan la base.
 */

export type ExportTable = {
  title: string;
  period: string;
  headers: string[];
  rows: (string | number | null)[][];
};

// ------------------------------------------------------------
// CSV (con BOM para compatibilidad con Excel es-UY)
// ------------------------------------------------------------
export function buildCsv(table: ExportTable): Buffer {
  const escape = (value: string | number | null): string => {
    const str = value === null ? "" : String(value);
    if (/[";\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  // Separador ";" — convención regional (es-UY usa coma decimal).
  const lines = [
    table.headers.map(escape).join(";"),
    ...table.rows.map((row) => row.map(escape).join(";")),
  ];
  return Buffer.from("﻿" + lines.join("\r\n"), "utf-8");
}

// ------------------------------------------------------------
// Excel
// ------------------------------------------------------------
export async function buildXlsx(table: ExportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Relojes Carrasco";
  const sheet = workbook.addWorksheet(table.title.slice(0, 31));

  sheet.addRow([table.title]);
  sheet.addRow([table.period]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(table.headers);
  headerRow.font = { bold: true };
  headerRow.border = { bottom: { style: "thin" } };

  for (const row of table.rows) {
    sheet.addRow(row.map((cell) => (cell === null ? "" : cell)));
  }

  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.columns.forEach((column) => {
    let max = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      max = Math.max(max, String(cell.value ?? "").length + 2);
    });
    column.width = Math.min(max, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ------------------------------------------------------------
// PDF (tabla simple paginada, A4 apaisado)
// ------------------------------------------------------------
export async function buildPdf(table: ExportTable): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842; // A4 apaisado
  const pageHeight = 595;
  const margin = 40;
  const rowHeight = 16;
  const fontSize = 8;

  const colCount = table.headers.length;
  const colWidth = (pageWidth - margin * 2) / colCount;

  const sanitize = (value: string): string =>
    // Helvetica (WinAnsi) no soporta todos los caracteres; se degradan los no soportados.
    value.replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑüÜ°$€£%().,;:¿?¡!'"\/+\-–—\s]/g, "?");

  const truncate = (value: string, width: number): string => {
    let text = sanitize(value);
    while (font.widthOfTextAtSize(text, fontSize) > width - 6 && text.length > 1) {
      text = text.slice(0, -2) + "…";
    }
    return text;
  };

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawText(sanitize(table.title), { x: margin, y, size: 14, font: bold });
    y -= 18;
    page.drawText(sanitize(table.period), {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 22;
    table.headers.forEach((header, i) => {
      page.drawText(truncate(header, colWidth), {
        x: margin + i * colWidth,
        y,
        size: fontSize,
        font: bold,
      });
    });
    y -= 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= rowHeight;
  };

  drawHeader();

  for (const row of table.rows) {
    if (y < margin + rowHeight) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }
    row.forEach((cell, i) => {
      const text = cell === null ? "" : String(cell);
      page.drawText(truncate(text, colWidth), {
        x: margin + i * colWidth,
        y,
        size: fontSize,
        font,
      });
    });
    y -= rowHeight;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
